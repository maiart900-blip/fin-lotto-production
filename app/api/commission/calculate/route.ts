import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface CommissionConfig {
  level: number;
  percent: number;
}

// Default commission rates by hierarchy level
const DEFAULT_COMMISSION_RATES: CommissionConfig[] = [
  { level: 0, percent: 0 },    // Super Admin (receives all remaining)
  { level: 1, percent: 5 },    // Direct referrer
  { level: 2, percent: 2 },    // 2nd level
  { level: 3, percent: 1 },    // 3rd level
  { level: 4, percent: 0.5 },  // 4th level
  { level: 5, percent: 0.25 }, // 5th level
];

export async function POST(request: Request) {
  try {
    const {
      bet_id,
      bet_amount,
      member_id,
      commission_type = 'bet',
    } = await request.json();

    const numericBetAmount = Number(bet_amount);

    if (!Number.isFinite(numericBetAmount) || numericBetAmount <= 0) {
      return NextResponse.json(
        { error: 'จำนวนเงินไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    if (!member_id) {
      return NextResponse.json(
        { error: 'กรุณาระบุ member_id' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get member info and their upline chain
    const { data: member, error: memberError } = await supabase
      .from('users')
      .select('id, referred_by, parent_agent_id, hierarchy_level')
      .eq('id', member_id)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลสมาชิก' },
        { status: 404 }
      );
    }

    // Build upline chain (up to 5 levels)
    const uplineChain: Array<{
      id: string;
      level: number;
      commission_percent: number;
    }> = [];

    let currentUserId = member.referred_by || member.parent_agent_id;
    let currentLevel = 1;

    while (currentUserId && currentLevel <= 5) {
      const { data: uplineUser } = await supabase
        .from('users')
        .select(
          'id, referred_by, parent_agent_id, commission_percent, role'
        )
        .eq('id', currentUserId)
        .single();

      if (!uplineUser) break;

      const defaultRate =
        DEFAULT_COMMISSION_RATES.find(
          (rate) => rate.level === currentLevel
        )?.percent || 0;

      const customPercent = Number(uplineUser.commission_percent) || 0;
      const commissionPercent =
        customPercent > 0 ? customPercent : defaultRate;

      uplineChain.push({
        id: uplineUser.id,
        level: currentLevel,
        commission_percent: commissionPercent,
      });

      // If super_admin, stop here
      if (uplineUser.role === 'super_admin') {
        break;
      }

      currentUserId =
        uplineUser.referred_by || uplineUser.parent_agent_id;

      currentLevel += 1;
    }

    // Calculate and create commission logs
    const commissionLogs = [];
    let totalCommissionPaid = 0;

    for (const upline of uplineChain) {
      const commissionAmount =
        (numericBetAmount * upline.commission_percent) / 100;

      if (commissionAmount <= 0) {
        continue;
      }

      const { data: log, error: logError } = await supabase
        .from('commission_logs')
        .insert({
          agent_id: upline.id,
          from_member_id: member_id,
          bet_id: bet_id || null,
          amount: commissionAmount,
          commission_type,
          hierarchy_level: upline.level,
          description: `ค่าคอม ${upline.commission_percent}% จากยอด ${numericBetAmount.toLocaleString()} บาท (Level ${upline.level})`,
          status: 'pending',
        })
        .select()
        .single();

      if (logError || !log) {
        console.error(
          `[commission/calculate] Failed to create commission log for user ${upline.id}:`,
          logError
        );
        continue;
      }

      commissionLogs.push(log);
      totalCommissionPaid += commissionAmount;

      // Supabase client ตัวนี้ไม่มี supabase.sql และ query builder ต่อ .catch() ไม่ได้
      // อ่านเครดิตปัจจุบันก่อน แล้ว update เป็นค่าที่คำนวณแล้ว
      const { data: currentUser, error: currentUserError } =
        await supabase
          .from('users')
          .select('credit_balance')
          .eq('id', upline.id)
          .single();

      if (currentUserError || !currentUser) {
        console.error(
          `[commission/calculate] Failed to read credit for user ${upline.id}:`,
          currentUserError
        );
        continue;
      }

      const currentBalance =
        Number(currentUser.credit_balance) || 0;
      const newBalance =
        currentBalance + commissionAmount;

      const { error: creditUpdateError } = await supabase
        .from('users')
        .update({
          credit_balance: newBalance,
        })
        .eq('id', upline.id);

      if (creditUpdateError) {
        console.error(
          `[commission/calculate] Failed to update credit for user ${upline.id}:`,
          creditUpdateError
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'คำนวณค่าคอมมิชชั่นสำเร็จ',
      data: {
        bet_amount: numericBetAmount,
        total_commission_paid: totalCommissionPaid,
        commission_breakdown: commissionLogs,
        upline_chain: uplineChain,
      },
    });
  } catch (error) {
    console.error('Commission calculation error:', error);

    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการคำนวณค่าคอมมิชชั่น' },
      { status: 500 }
    );
  }
}

// Get commission summary for an agent
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const period = searchParams.get('period') || 'all';

    if (!agentId) {
      return NextResponse.json(
        { error: 'กรุณาระบุ agent_id' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    let query = supabase
      .from('commission_logs')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    // Apply date filter
    const now = new Date();

    if (period === 'today') {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      query = query.gte(
        'created_at',
        startOfDay.toISOString()
      );
    } else if (period === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(startOfWeek.getDate() - 7);

      query = query.gte(
        'created_at',
        startOfWeek.toISOString()
      );
    } else if (period === 'month') {
      const startOfMonth = new Date(now);
      startOfMonth.setDate(startOfMonth.getDate() - 30);

      query = query.gte(
        'created_at',
        startOfMonth.toISOString()
      );
    }

    const { data: logs, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const safeLogs = logs || [];

    // Calculate summary
    const summary = {
      total_earned: safeLogs.reduce(
        (sum, log) => sum + Number(log.amount || 0),
        0
      ),
      pending: safeLogs
        .filter((log) => log.status === 'pending')
        .reduce(
          (sum, log) => sum + Number(log.amount || 0),
          0
        ),
      approved: safeLogs
        .filter((log) => log.status === 'approved')
        .reduce(
          (sum, log) => sum + Number(log.amount || 0),
          0
        ),
      paid: safeLogs
        .filter((log) => log.status === 'paid')
        .reduce(
          (sum, log) => sum + Number(log.amount || 0),
          0
        ),
      by_type: {
        bet: safeLogs
          .filter(
            (log) => log.commission_type === 'bet'
          )
          .reduce(
            (sum, log) => sum + Number(log.amount || 0),
            0
          ),
        deposit: safeLogs
          .filter(
            (log) => log.commission_type === 'deposit'
          )
          .reduce(
            (sum, log) => sum + Number(log.amount || 0),
            0
          ),
        signup: safeLogs
          .filter(
            (log) => log.commission_type === 'signup'
          )
          .reduce(
            (sum, log) => sum + Number(log.amount || 0),
            0
          ),
      },
      count: safeLogs.length,
    };

    return NextResponse.json({
      success: true,
      summary,
      logs: safeLogs,
    });
  } catch (error) {
    console.error('Commission summary error:', error);

    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลค่าคอมมิชชั่น' },
      { status: 500 }
    );
  }
}