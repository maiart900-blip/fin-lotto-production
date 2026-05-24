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
  { level: 1, sharePercent: 50, commissionPercent: 5 },   // Direct upline
  { level: 2, sharePercent: 30, commissionPercent: 2 },   // 2nd level
  { level: 3, sharePercent: 15, commissionPercent: 1 },   // 3rd level
  { level: 4, sharePercent: 5, commissionPercent: 0.5 },  // 4th level
];

export async function POST(request: Request) {
  try {
    const { 
      bet_id, 
      bet_amount, 
      member_id, 
      win_amount = 0,
      lottery_id,
      entry_type 
    } = await request.json();

    if (!bet_amount || bet_amount <= 0) {
      return NextResponse.json({ error: 'จำนวนเงินเดิมพันไม่ถูกต้อง' }, { status: 400 });
    }

    if (!member_id) {
      return NextResponse.json({ error: 'กรุณาระบุ member_id' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get member and their upline chain
    const { data: member, error: memberError } = await supabase
      .from('users')
      .select('id, username, referred_by, parent_agent_id, hierarchy_level')
      .eq('id', member_id)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก' }, { status: 404 });
    }

    // Calculate house profit (ยอดเดิมพัน - ยอดจ่าย)
    const houseProfit = bet_amount - win_amount;
    
    // Build upline chain and calculate revenue sharing
    const revenueShares: Array<{
      agent_id: string;
      level: number;
      share_amount: number;
      commission_amount: number;
      share_percent: number;
      commission_percent: number;
    }> = [];

    let currentUserId = member.referred_by || member.parent_agent_id;
    let currentLevel = 1;
    let totalShareDistributed = 0;
    let totalCommissionDistributed = 0;

    while (currentUserId && currentLevel <= 4) {
      const { data: uplineUser } = await supabase
        .from('users')
        .select('id, referred_by, parent_agent_id, share_percent, commission_percent, role')
        .eq('id', currentUserId)
        .single();

      if (!uplineUser) break;

      // Get config for this level
      const levelConfig = DEFAULT_SHARE_CONFIG.find(c => c.level === currentLevel);
      
      // Use user's custom rates or default
      const sharePercent = uplineUser.share_percent > 0 
        ? uplineUser.share_percent 
        : levelConfig?.sharePercent || 0;
      
      const commissionPercent = uplineUser.commission_percent > 0 
        ? uplineUser.commission_percent 
        : levelConfig?.commissionPercent || 0;

      // Calculate amounts
      // ส่วนแบ่ง PT (จากกำไรบ้าน)
      const shareAmount = houseProfit > 0 ? (houseProfit * sharePercent) / 100 : 0;
      // ค่าคอม (จากยอดเดิมพัน)
      const commissionAmount = (bet_amount * commissionPercent) / 100;

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
              bet_id: bet_id,
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
              bet_id: bet_id,
              amount: commissionAmount,
              commission_type: 'bet',
              hierarchy_level: currentLevel,
              description: `ค่าคอม ${commissionPercent}% จากยอดเดิมพัน ${bet_amount.toLocaleString()} บาท (Level ${currentLevel})`,
              status: 'pending',
            });
        }

        // Update agent's credit balance
        const totalCredit = shareAmount + commissionAmount;
        if (totalCredit > 0) {
          await supabase
            .from('users')
            .update({
              credit_balance: supabase.rpc('increment_credit_simple', {
                user_id_param: uplineUser.id,
                amount_param: totalCredit,
              }),
            })
            .eq('id', uplineUser.id);
        }
      }

      // If super_admin, stop here
      if (uplineUser.role === 'super_admin') break;

      currentUserId = uplineUser.referred_by || uplineUser.parent_agent_id;
      currentLevel++;
    }

    // Calculate remaining house profit (goes to super admin / company)
    const remainingProfit = houseProfit - totalShareDistributed;

    return NextResponse.json({
      success: true,
      message: 'คำนวณส่วนแบ่งรายได้สำเร็จ',
      data: {
        bet_id,
        bet_amount,
        win_amount,
        house_profit: houseProfit,
        revenue_shares: revenueShares,
        summary: {
          total_share_distributed: totalShareDistributed,
          total_commission_distributed: totalCommissionDistributed,
          remaining_profit: remainingProfit,
          agents_paid: revenueShares.length,
        },
      },
    });
  } catch (error) {
    console.error('Revenue sharing error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการคำนวณส่วนแบ่งรายได้' },
      { status: 500 }
    );
  }
}

// Get revenue sharing summary for an agent
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const period = searchParams.get('period') || 'month';

    if (!agentId) {
      return NextResponse.json({ error: 'กรุณาระบุ agent_id' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get date range
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setDate(now.getDate() - 30));
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Get commission logs
    const { data: logs, error } = await supabase
      .from('commission_logs')
      .select('*')
      .eq('agent_id', agentId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get downline count
    const { count: downlineCount } = await supabase
      .from('users')
      .select('id', { count: 'exact' })
      .or(`referred_by.eq.${agentId},parent_agent_id.eq.${agentId}`);

    // Calculate summary
    const summary = {
      period,
      total_revenue: logs?.reduce((sum, l) => sum + Number(l.amount), 0) || 0,
      pending_amount: logs?.filter(l => l.status === 'pending').reduce((sum, l) => sum + Number(l.amount), 0) || 0,
      paid_amount: logs?.filter(l => l.status === 'paid').reduce((sum, l) => sum + Number(l.amount), 0) || 0,
      transaction_count: logs?.length || 0,
      downline_count: downlineCount || 0,
      by_level: {
        level_1: logs?.filter(l => l.hierarchy_level === 1).reduce((sum, l) => sum + Number(l.amount), 0) || 0,
        level_2: logs?.filter(l => l.hierarchy_level === 2).reduce((sum, l) => sum + Number(l.amount), 0) || 0,
        level_3: logs?.filter(l => l.hierarchy_level === 3).reduce((sum, l) => sum + Number(l.amount), 0) || 0,
        level_4: logs?.filter(l => l.hierarchy_level === 4).reduce((sum, l) => sum + Number(l.amount), 0) || 0,
      },
    };

    return NextResponse.json({
      success: true,
      summary,
      recent_transactions: logs?.slice(0, 20) || [],
    });
  } catch (error) {
    console.error('Revenue summary error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลส่วนแบ่งรายได้' },
      { status: 500 }
    );
  }
}
