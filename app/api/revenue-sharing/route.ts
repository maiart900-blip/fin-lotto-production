import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Revenue Sharing API
 * คำนวณและแจกจ่ายส่วนแบ่งรายได้ให้กับสายงานเมื่อมีการเดิมพัน
 */

interface RevenueShareConfig {
  level: number;
  sharePercent: number;
  commissionPercent: number;
}

// Default revenue sharing rates
const DEFAULT_SHARE_CONFIG: RevenueShareConfig[] = [
  { level: 1, sharePercent: 50, commissionPercent: 5 },
  { level: 2, sharePercent: 30, commissionPercent: 2 },
  { level: 3, sharePercent: 15, commissionPercent: 1 },
  { level: 4, sharePercent: 5, commissionPercent: 0.5 },
];

export async function POST(request: Request) {
  try {
    const {
      bet_id,
      bet_amount,
      member_id,
      win_amount = 0,
      lottery_id,
      entry_type,
    } = await request.json();

    if (!bet_amount || bet_amount <= 0) {
      return NextResponse.json(
        { error: 'จำนวนเงินเดิมพันไม่ถูกต้อง' },
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

    // Get member and their upline chain
    const { data: member, error: memberError } = await supabase
      .from('users')
      .select(
        'id, username, referred_by, parent_agent_id, hierarchy_level'
      )
      .eq('id', member_id)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลสมาชิก' },
        { status: 404 }
      );
    }

    const numericBetAmount = Number(bet_amount) || 0;
    const numericWinAmount = Number(win_amount) || 0;

    // Calculate house profit
    const houseProfit = numericBetAmount - numericWinAmount;

    const revenueShares: Array<{
      agent_id: string;
      level: number;
      share_amount: number;
      commission_amount: number;
      share_percent: number;
      commission_percent: number;
    }> = [];

    let currentUserId =
      member.referred_by || member.parent_agent_id;

    let currentLevel = 1;
    let totalShareDistributed = 0;
    let totalCommissionDistributed = 0;

    while (currentUserId && currentLevel <= 4) {
      const { data: uplineUser } = await supabase
        .from('users')
        .select(
          'id, referred_by, parent_agent_id, share_percent, commission_percent, role, credit_balance'
        )
        .eq('id', currentUserId)
        .single();

      if (!uplineUser) break;

      const levelConfig = DEFAULT_SHARE_CONFIG.find(
        (config) => config.level === currentLevel
      );

      const customSharePercent =
        Number(uplineUser.share_percent) || 0;

      const customCommissionPercent =
        Number(uplineUser.commission_percent) || 0;

      const sharePercent =
        customSharePercent > 0
          ? customSharePercent
          : levelConfig?.sharePercent || 0;

      const commissionPercent =
        customCommissionPercent > 0
          ? customCommissionPercent
          : levelConfig?.commissionPercent || 0;

      // ส่วนแบ่ง PT จากกำไรบ้าน
      const shareAmount =
        houseProfit > 0
          ? (houseProfit * sharePercent) / 100
          : 0;

      // ค่าคอมจากยอดเดิมพัน
      const commissionAmount =
        (numericBetAmount * commissionPercent) / 100;

      if (shareAmount > 0 || commissionAmount > 0) {
        revenueShares.push({
          agent_id: uplineUser.id,
          level: currentLevel,
          share_amount: shareAmount,
          commission_amount: commissionAmount,
          share_percent: sharePercent,
          commission_percent: commissionPercent,
        });

        totalShareDistributed += shareAmount;
        totalCommissionDistributed += commissionAmount;

        // Create commission log for share
        if (shareAmount > 0) {
          await supabase
            .from('commission_logs')
            .insert({
              agent_id: uplineUser.id,
              from_member_id: member_id,
              bet_id: bet_id || null,
              amount: shareAmount,
              commission_type: 'bet',
              hierarchy_level: currentLevel,
              description: `ส่วนแบ่ง PT ${sharePercent}% จากกำไร ${houseProfit.toLocaleString()} บาท (Level ${currentLevel})`,
              status: 'pending',
            });
        }

        // Create commission log for commission
        if (commissionAmount > 0) {
          await supabase
            .from('commission_logs')
            .insert({
              agent_id: uplineUser.id,
              from_member_id: member_id,
              bet_id: bet_id || null,
              amount: commissionAmount,
              commission_type: 'bet',
              hierarchy_level: currentLevel,
              description: `ค่าคอม ${commissionPercent}% จากยอดเดิมพัน ${numericBetAmount.toLocaleString()} บาท (Level ${currentLevel})`,
              status: 'pending',
            });
        }

        const totalCredit =
          shareAmount + commissionAmount;

        if (totalCredit > 0) {
          // อ่านยอดเครดิตปัจจุบันแล้วอัปเดต
          // ใช้แทน supabase.sql ซึ่งไม่มีใน Supabase JS client
          const currentCredit =
            Number(uplineUser.credit_balance) || 0;

          const newCredit =
            currentCredit + totalCredit;

          const { error: updateError } = await supabase
            .from('users')
            .update({
              credit_balance: newCredit,
            })
            .eq('id', uplineUser.id);

          if (updateError) {
            // Fallback RPC
            try {
              const { error: rpcError } = await supabase.rpc(
                'increment_customer_balance',
                {
                  customer_id: uplineUser.id,
                  amount: totalCredit,
                }
              );

              if (rpcError) {
                console.error(
                  `[revenue-sharing] Failed to update credit for user ${uplineUser.id}:`,
                  rpcError
                );
              }
            } catch (rpcError) {
              console.error(
                `[revenue-sharing] Failed to update credit for user ${uplineUser.id}:`,
                rpcError
              );
            }
          }
        }
      }

      // If super_admin, stop here
      if (uplineUser.role === 'super_admin') {
        break;
      }

      currentUserId =
        uplineUser.referred_by ||
        uplineUser.parent_agent_id;

      currentLevel++;
    }

    // Calculate remaining house profit
    const remainingProfit =
      houseProfit - totalShareDistributed;

    return NextResponse.json({
      success: true,
      message: 'คำนวณส่วนแบ่งรายได้สำเร็จ',
      data: {
        bet_id,
        bet_amount: numericBetAmount,
        win_amount: numericWinAmount,
        lottery_id,
        entry_type,
        house_profit: houseProfit,
        revenue_shares: revenueShares,
        summary: {
          total_share_distributed:
            totalShareDistributed,
          total_commission_distributed:
            totalCommissionDistributed,
          remaining_profit: remainingProfit,
          agents_paid: revenueShares.length,
        },
      },
    });
  } catch (error) {
    console.error('Revenue sharing error:', error);

    return NextResponse.json(
      {
        error:
          'เกิดข้อผิดพลาดในการคำนวณส่วนแบ่งรายได้',
      },
      { status: 500 }
    );
  }
}

// Get revenue sharing summary for an agent
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const period =
      searchParams.get('period') || 'month';

    if (!agentId) {
      return NextResponse.json(
        { error: 'กรุณาระบุ agent_id' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;

      case 'week':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;

      case 'month':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        break;

      default:
        startDate = new Date(0);
        break;
    }

    // Get commission logs
    const { data: logs, error } = await supabase
      .from('commission_logs')
      .select('*')
      .eq('agent_id', agentId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Get downline count
    const { count: downlineCount } = await supabase
      .from('users')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .or(
        `referred_by.eq.${agentId},parent_agent_id.eq.${agentId}`
      );

    const safeLogs = logs || [];

    // Calculate summary
    const summary = {
      period,

      total_revenue: safeLogs.reduce(
        (sum, log) =>
          sum + (Number(log.amount) || 0),
        0
      ),

      pending_amount: safeLogs
        .filter((log) => log.status === 'pending')
        .reduce(
          (sum, log) =>
            sum + (Number(log.amount) || 0),
          0
        ),

      paid_amount: safeLogs
        .filter((log) => log.status === 'paid')
        .reduce(
          (sum, log) =>
            sum + (Number(log.amount) || 0),
          0
        ),

      transaction_count: safeLogs.length,

      downline_count: downlineCount || 0,

      by_level: {
        level_1: safeLogs
          .filter(
            (log) => log.hierarchy_level === 1
          )
          .reduce(
            (sum, log) =>
              sum + (Number(log.amount) || 0),
            0
          ),

        level_2: safeLogs
          .filter(
            (log) => log.hierarchy_level === 2
          )
          .reduce(
            (sum, log) =>
              sum + (Number(log.amount) || 0),
            0
          ),

        level_3: safeLogs
          .filter(
            (log) => log.hierarchy_level === 3
          )
          .reduce(
            (sum, log) =>
              sum + (Number(log.amount) || 0),
            0
          ),

        level_4: safeLogs
          .filter(
            (log) => log.hierarchy_level === 4
          )
          .reduce(
            (sum, log) =>
              sum + (Number(log.amount) || 0),
            0
          ),
      },
    };

    return NextResponse.json({
      success: true,
      summary,
      recent_transactions: safeLogs.slice(0, 20),
    });
  } catch (error) {
    console.error(
      'Revenue summary error:',
      error
    );

    return NextResponse.json(
      {
        error:
          'เกิดข้อผิดพลาดในการดึงข้อมูลส่วนแบ่งรายได้',
      },
      { status: 500 }
    );
  }
}