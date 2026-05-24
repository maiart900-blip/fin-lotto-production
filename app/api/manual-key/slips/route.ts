import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: ดึงรายการโพยคีย์หวย (ระดับ slip ไม่แตกเป็น items)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // Query params
    const userId = searchParams.get('user_id'); // Current user ID
    const userRole = searchParams.get('user_role'); // key_staff, agent_key, super_admin
    const parentAgentId = searchParams.get('parent_agent_id'); // สำหรับ agent_key ดูลูกทีม
    const search = searchParams.get('search');
    const status = searchParams.get('status'); // confirmed, pending, cancelled
    const resultStatus = searchParams.get('result_status'); // pending, won, lost
    const payoutStatus = searchParams.get('payout_status'); // pending, paid
    const lotteryId = searchParams.get('lottery_id');
    const drawDate = searchParams.get('draw_date');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    
    // Build query - ดึงจาก bets table พร้อม bet_items
    let query = supabase
      .from('bets')
      .select(`
        id,
        customer_id,
        customer_name,
        lottery_id,
        total_amount,
        total_win_amount,
        status,
        is_checked,
        source_type,
        created_by,
        cancel_deadline,
        created_at,
        updated_at,
        lottery:lotteries(id, name),
        bet_items(
          id, number, bet_type, amount_top, amount_bottom, amount_tod, 
          payout_rate, win_amount, status
        ),
        customer:customers!bets_customer_id_fkey(id, name, phone, agent_id, parent_agent_id)
      `)
      .eq('source_type', 'manual_key') // เฉพาะโพยคีย์หวย
      .order('created_at', { ascending: false });
    
    // Filter by role permission
    if (userRole === 'key_staff' && userId) {
      // พนักงานคีย์หวย: เห็นเฉพาะโพยที่ตัวเองคีย์
      query = query.eq('created_by', userId);
    } else if (userRole === 'agent_key' && parentAgentId) {
      // หัวเอเย่นคีย์: เห็นโพยของลูกทีมทั้งหมด
      // ต้อง filter ผ่าน customer.parent_agent_id หรือ customer.agent_id
      // Supabase ไม่รองรับ filter nested directly, ใช้ RPC หรือ filter หลัง fetch
    }
    // super_admin: เห็นทั้งหมด (ไม่ต้อง filter)
    
    // Filter by status
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    // Filter by lottery
    if (lotteryId) {
      query = query.eq('lottery_id', lotteryId);
    }
    
    // Filter by date range
    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00`);
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59`);
    }
    
    // Default: today's slips if no date specified
    if (!startDate && !endDate) {
      const today = new Date().toISOString().split('T')[0];
      query = query.gte('created_at', `${today}T00:00:00`);
    }
    
    // Limit
    query = query.limit(200);
    
    const { data: bets, error } = await query;
    
    if (error) {
      console.error('[API] Error fetching manual-key slips:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Transform data to slip format
    const slips = (bets || []).map((bet: any) => {
      const betItems = bet.bet_items || [];
      const customer = bet.customer;
      const lottery = bet.lottery;
      
      // Calculate totals from bet_items
      const itemsCount = betItems.length;
      const totalBetAmount = betItems.reduce((sum: number, item: any) => 
        sum + (Number(item.amount_top) || 0) + (Number(item.amount_bottom) || 0) + (Number(item.amount_tod) || 0), 0
      );
      const totalWinAmount = betItems.reduce((sum: number, item: any) => 
        sum + (Number(item.win_amount) || 0), 0
      );
      
      // Determine result status
      const hasWon = betItems.some((item: any) => item.status === 'won');
      const allChecked = bet.is_checked;
      let resultStatus = 'pending'; // รอผล
      if (allChecked) {
        resultStatus = hasWon ? 'won' : 'lost';
      }
      
      // Determine payout status
      let payoutStatus = 'none'; // ไม่มีรางวัล
      if (hasWon && totalWinAmount > 0) {
        // TODO: ตรวจสอบจาก payout_transactions table
        payoutStatus = 'pending'; // รอจ่าย
      }
      
      return {
        slipId: bet.id,
        slipSource: 'manual_key',
        
        // Customer info
        customerId: bet.customer_id,
        customerName: bet.customer_name || customer?.name || '-',
        customerPhone: customer?.phone || '-',
        
        // Agent info
        keyBy: bet.created_by,
        keyByName: null, // TODO: join with staff/agent table
        agentId: customer?.agent_id || null,
        agentName: null,
        ownerId: customer?.parent_agent_id || null,
        
        // Lottery info
        lotteryId: bet.lottery_id,
        lotteryName: lottery?.name || '-',
        roundDate: null, // TODO: from lottery_results or bet metadata
        drawTime: null,
        
        // Bet items summary
        itemsCount,
        totalAmount: bet.total_amount || totalBetAmount,
        
        // Status
        status: bet.status, // confirmed, pending, cancelled
        resultStatus, // pending, won, lost
        winAmount: totalWinAmount,
        payoutStatus, // none, pending, paid
        
        // Timestamps
        createdAt: bet.created_at,
        updatedAt: bet.updated_at,
        cancelDeadline: bet.cancel_deadline,
        
        // Full bet items for detail view
        betItems: betItems.map((item: any) => ({
          id: item.id,
          number: item.number,
          betType: item.bet_type,
          amountTop: Number(item.amount_top) || 0,
          amountBottom: Number(item.amount_bottom) || 0,
          amountTod: Number(item.amount_tod) || 0,
          payoutRate: Number(item.payout_rate) || 0,
          winAmount: Number(item.win_amount) || 0,
          status: item.status || 'pending',
        })),
      };
    });
    
    // Filter by agent permission (post-fetch for agent_key role)
    let filteredSlips = slips;
    if (userRole === 'agent_key' && parentAgentId) {
      filteredSlips = slips.filter((slip: any) => 
        slip.ownerId === parentAgentId || slip.agentId === parentAgentId
      );
    }
    
    // Search filter (post-fetch)
    if (search) {
      const searchLower = search.toLowerCase();
      filteredSlips = filteredSlips.filter((slip: any) =>
        slip.slipId.toLowerCase().includes(searchLower) ||
        slip.customerName.toLowerCase().includes(searchLower) ||
        slip.customerPhone.includes(search) ||
        slip.lotteryName.toLowerCase().includes(searchLower)
      );
    }
    
    // Result status filter (post-fetch)
    if (resultStatus && resultStatus !== 'all') {
      filteredSlips = filteredSlips.filter((slip: any) => slip.resultStatus === resultStatus);
    }
    
    // Payout status filter (post-fetch)
    if (payoutStatus && payoutStatus !== 'all') {
      filteredSlips = filteredSlips.filter((slip: any) => slip.payoutStatus === payoutStatus);
    }
    
    // Calculate summary
    const summary = {
      totalSlips: filteredSlips.length,
      totalBetsAmount: filteredSlips.reduce((sum: number, s: any) => sum + s.totalAmount, 0),
      totalWinAmount: filteredSlips.reduce((sum: number, s: any) => sum + s.winAmount, 0),
      pendingCount: filteredSlips.filter((s: any) => s.resultStatus === 'pending').length,
      wonCount: filteredSlips.filter((s: any) => s.resultStatus === 'won').length,
      lostCount: filteredSlips.filter((s: any) => s.resultStatus === 'lost').length,
      pendingPayoutCount: filteredSlips.filter((s: any) => s.payoutStatus === 'pending').length,
    };
    
    return NextResponse.json({
      success: true,
      slips: filteredSlips,
      summary,
    });
    
  } catch (error) {
    console.error('[API] Manual-key slips error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
