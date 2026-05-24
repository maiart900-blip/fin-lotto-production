import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Fetch auto slips with pagination
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // Pagination params
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    
    // Filter params
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all'; // all, pending, won, lost, cancelled
    const lotteryId = searchParams.get('lottery_id') || '';
    const customerId = searchParams.get('customer_id') || '';
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';
    
    // Build query - fetch bets where source_type = 'auto'
    let query = supabase
      .from('bets')
      .select(`
        id,
        total_amount,
        total_win_amount,
        status,
        created_at,
        customer_id,
        lottery_id,
        source_type,
        customers:customers!bets_customer_id_fkey (
          id,
          name,
          phone,
          source_type,
          system_type
        ),
        lotteries (
          id,
          name
        ),
        bet_items (
          id,
          number,
          bet_type,
          amount_top,
          amount_bottom,
          amount_tod,
          status,
          win_amount,
          payout_rate
        )
      `, { count: 'exact' })
      .or('source_type.eq.auto,source_type.is.null') // Auto slips or legacy null
      .order('created_at', { ascending: false });
    
    // Apply filters
    if (status !== 'all') {
      if (status === 'pending') {
        query = query.in('status', ['pending', 'confirmed']);
      } else if (status === 'cancelled') {
        query = query.eq('status', 'cancelled');
      } else {
        query = query.eq('status', status);
      }
    }
    
    if (lotteryId) {
      query = query.eq('lottery_id', lotteryId);
    }
    
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    
    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00`);
    }
    
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59`);
    }
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1);
    
    const { data: bets, error, count } = await query;
    
    if (error) {
      console.error('[v0] Error fetching auto slips:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Filter only auto customers (additional filter since source_type might be null)
    const autoSlips = bets?.filter(bet => {
      const customer = bet.customers as { source_type?: string; system_type?: string } | null;
      // Include if bet.source_type is 'auto' OR customer is auto
      return bet.source_type === 'auto' || 
             customer?.source_type === 'auto' || 
             customer?.system_type === 'auto' ||
             // Legacy: include if source_type is null and customer system_type is auto
             (bet.source_type === null && customer?.system_type === 'auto');
    }) || [];
    
    // Apply search filter (client-side for now)
    const filteredSlips = search 
      ? autoSlips.filter(bet => {
          const customer = bet.customers as { name?: string; phone?: string } | null;
          const lottery = bet.lotteries as { name?: string } | null;
          const searchLower = search.toLowerCase();
          
          return bet.id.toLowerCase().includes(searchLower) ||
                 customer?.name?.toLowerCase().includes(searchLower) ||
                 customer?.phone?.includes(search) ||
                 lottery?.name?.toLowerCase().includes(searchLower);
        })
      : autoSlips;
    
    // Transform to slip format
    const slips = filteredSlips.map(bet => {
      const customer = bet.customers as { id: string; name?: string; phone?: string } | null;
      const lottery = bet.lotteries as { id: string; name?: string } | null;
      const items = bet.bet_items as Array<{
        id: string;
        number: string;
        bet_type: string;
        amount_top?: number;
        amount_bottom?: number;
        amount_tod?: number;
        status?: string;
        win_amount?: number;
        payout_rate?: number;
      }> | null;
      
      // Calculate totals from items
      const itemsCount = items?.length || 0;
      const totalBetAmount = items?.reduce((sum, item) => 
        sum + (Number(item.amount_top) || 0) + (Number(item.amount_bottom) || 0) + (Number(item.amount_tod) || 0), 0
      ) || Number(bet.total_amount) || 0;
      const totalWinAmount = items?.reduce((sum, item) => sum + (Number(item.win_amount) || 0), 0) || Number(bet.total_win_amount) || 0;
      
      // Determine result status based on items
      const hasWinner = items?.some(item => item.status === 'won');
      const allChecked = items?.every(item => item.status === 'won' || item.status === 'lost');
      
      let resultStatus: 'pending' | 'won' | 'lost' | 'partial' = 'pending';
      if (allChecked && items && items.length > 0) {
        resultStatus = hasWinner ? 'won' : 'lost';
      } else if (hasWinner) {
        resultStatus = 'partial';
      }
      
      return {
        slipId: bet.id,
        customerId: customer?.id || null,
        customerName: customer?.name || 'ไม่ระบุ',
        customerPhone: customer?.phone || null,
        lotteryId: lottery?.id || null,
        lotteryName: lottery?.name || 'ไม่ระบุ',
        itemsCount,
        totalBetAmount,
        totalWinAmount,
        status: bet.status,
        resultStatus,
        createdAt: bet.created_at,
        items: items?.map(item => ({
          id: item.id,
          number: item.number,
          betType: item.bet_type,
          amountTop: Number(item.amount_top) || 0,
          amountBottom: Number(item.amount_bottom) || 0,
          amountTod: Number(item.amount_tod) || 0,
          totalAmount: (Number(item.amount_top) || 0) + (Number(item.amount_bottom) || 0) + (Number(item.amount_tod) || 0),
          status: item.status || 'pending',
          winAmount: Number(item.win_amount) || 0,
          payoutRate: Number(item.payout_rate) || 0,
        })) || [],
      };
    });
    
    // Calculate summary stats (from all filtered slips, not just current page)
    // For accurate totals, we need a separate count query
    const { data: statsData } = await supabase
      .from('bets')
      .select('status, total_amount, total_win_amount, source_type')
      .or('source_type.eq.auto,source_type.is.null');
    
    const autoStats = statsData?.filter(bet => bet.source_type === 'auto') || [];
    
    const summary = {
      totalSlips: count || slips.length,
      totalBetsAmount: autoStats.reduce((sum, bet) => sum + (Number(bet.total_amount) || 0), 0),
      totalWinAmount: autoStats.reduce((sum, bet) => sum + (Number(bet.total_win_amount) || 0), 0),
      pendingCount: autoStats.filter(bet => bet.status === 'pending' || bet.status === 'confirmed').length,
      wonCount: autoStats.filter(bet => bet.status === 'won').length,
      lostCount: autoStats.filter(bet => bet.status === 'lost').length,
      cancelledCount: autoStats.filter(bet => bet.status === 'cancelled').length,
    };
    
    return NextResponse.json({
      success: true,
      slips,
      pagination: {
        page,
        limit,
        total: count || slips.length,
        totalPages: Math.ceil((count || slips.length) / limit),
      },
      summary,
    });
    
  } catch (error) {
    console.error('[v0] Auto slips API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
