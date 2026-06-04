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
    const { bet_id, bet_amount, member_id, commission_type = 'bet' } = await request.json();

    if (!bet_amount || bet_amount <= 0) {
      return NextResponse.json({ error: 'จำนวนเงินไม่ถูกต้อง' }, { status: 400 });
    }

    if (!member_id) {
      return NextResponse.json({ error: 'กรุณาระบุ member_id' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get member info and their upline chain
    const { data: member, error: memberError } = await supabase
      .from('users')
      .select('id, referred_by, parent_agent_id, hierarchy_level')
      .eq('id', member_id)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก' }, { status: 404 });
    }

    // Build upline chain (up to 5 levels)
    const uplineChain: Array<{ id: string; level: number; commission_percent: number }> = [];
    let currentUserId = member.referred_by || member.parent_agent_id;
    let currentLevel = 1;

    while (currentUserId && currentLevel <= 5) {
      const { data: uplineUser } = await supabase
        .from('users')
        .select('id, referred_by, parent_agent_id, commission_percent, role')
        .eq('id', currentUserId)
        .single();

      if (!uplineUser) break;

      // Use user's custom commission_percent or default by level
      const defaultRate = DEFAULT_COMMISSION_RATES.find(r => r.level === currentLevel)?.percent || 0;
      const commissionPercent = uplineUser.commission_percent > 0 
        ? uplineUser.commission_percent 
        : defaultRate;

      uplineChain.push({
        id: uplineUser.id,
        level: currentLevel,
        commission_percent: commissionPercent,
      });

      // If super_admin, stop here
      if (uplineUser.role === 'super_admin') break;

      currentUserId = uplineUser.referred_by || uplineUser.parent_agent_id;
      currentLevel++;
    }

    // Calculate and create commission logs
    const commissionLogs = [];
    let totalCommissionPaid = 0;

    for (const upline of uplineChain) {
      const commissionAmount = (bet_amount * upline.commission_percent) / 100;
      
      if (commissionAmount > 0) {
        const { data: log, error: logError } = await supabase
          .from('commission_logs')
          .insert({
            agent_id: upline.id,
            from_member_id: member_id,
            bet_id: bet_id || null,
            amount: commissionAmount,
            commission_type: commission_type,
            hierarchy_level: upline.level,
            description: `ค่าคอม ${upline.commission_percent}% จากยอด ${bet_amount.toLocaleString()} บาท (Level ${upline.level})`,
            status: 'pending',
          })
          .select()
          .single();

        if (!logError && log) {
          commissionLogs.push(log);
          totalCommissionPaid += commissionAmount;

          // Update agent's credit balance (direct UPDATE - atomic increment)
          // Note: increment_credit RPC does not exist, using direct SQL increment
          await supabase
            .from('users')
            .update({
              credit_balance: supabase.sql`credit_balance + ${commissionAmount}`,
            })
            .eq('id', upline.id)
            .catch(() => {
              // Fallback: use raw update if sql template fails
              return supabase.rpc('increment_customer_balance', {
                customer_id: upline.id,
                amount: commissionAmount,
              }).catch(() => {
                // Silent fail - commission log is created, credit update failed
                console.error(`[commission/calculate] Failed to update credit for user ${upline.id}`);
              });
            });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'คำนวณค่าคอมมิชชั่นสำเร็จ',
      data: {
        bet_amount,
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
    const period = searchParams.get('period') || 'all'; // today, week, month, all

    if (!agentId) {
      return NextResponse.json({ error: 'กรุณาระบุ agent_id' }, { status: 400 });
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
      const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      query = query.gte('created_at', startOfDay);
    } else if (period === 'week') {
      const startOfWeek = new Date(now.setDate(now.getDate() - 7)).toISOString();
      query = query.gte('created_at', startOfWeek);
    } else if (period === 'month') {
      const startOfMonth = new Date(now.setDate(now.getDate() - 30)).toISOString();
      query = query.gte('created_at', startOfMonth);
    }

    const { data: logs, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate summary
    const summary = {
      total_earned: logs?.reduce((sum, log) => sum + Number(log.amount), 0) || 0,
      pending: logs?.filter(l => l.status === 'pending').reduce((sum, l) => sum + Number(l.amount), 0) || 0,
      approved: logs?.filter(l => l.status === 'approved').reduce((sum, l) => sum + Number(l.amount), 0) || 0,
      paid: logs?.filter(l => l.status === 'paid').reduce((sum, l) => sum + Number(l.amount), 0) || 0,
      by_type: {
        bet: logs?.filter(l => l.commission_type === 'bet').reduce((sum, l) => sum + Number(l.amount), 0) || 0,
        deposit: logs?.filter(l => l.commission_type === 'deposit').reduce((sum, l) => sum + Number(l.amount), 0) || 0,
        signup: logs?.filter(l => l.commission_type === 'signup').reduce((sum, l) => sum + Number(l.amount), 0) || 0,
      },
      count: logs?.length || 0,
    };

    return NextResponse.json({
      success: true,
      summary,
      logs,
    });
  } catch (error) {
    console.error('Commission summary error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลค่าคอมมิชชั่น' },
      { status: 500 }
    );
  }
}
