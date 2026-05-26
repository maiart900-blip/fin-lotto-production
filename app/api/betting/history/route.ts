import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAgentOrHigher } from '@/lib/api-auth';

/**
 * Betting Transactions API
 * ONLY gameplay activity: lottery bets, casino bets, slot bets, sports bets
 * NOT money movement
 */

export type BettingTransactionType = 
  | 'lottery_bet'
  | 'casino_bet'
  | 'slot_bet'
  | 'sports_bet'
  | 'cancelled_bet'
  | 'rollback_bet'
  | 'win_payout';

export type GameType = 'lottery' | 'casino' | 'slots' | 'sports';

interface BettingTransaction {
  id: string;
  type: BettingTransactionType;
  game_type: GameType;
  amount: number;
  potential_win?: number;
  actual_win?: number;
  status: string;
  description?: string;
  bet_details?: string;
  lottery_type?: string;
  number?: string;
  bet_type?: string;
  provider_id?: string;
  provider_name?: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  tenant_id?: string;
  round_id?: string;
  game_id?: string;
  exposure?: number;
  created_at: string;
  settled_at?: string;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const gameType = searchParams.get('game_type');
    const providerId = searchParams.get('provider_id');
    const customerId = searchParams.get('customer_id');
    const tenantId = searchParams.get('tenant_id');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const lotteryType = searchParams.get('lottery_type');

    const transactions: BettingTransaction[] = [];

    // 1. Lottery entries
    const { data: entries } = await supabase
      .from('entries')
      .select(`
        id, number, bet_type, amount, status, created_at,
        customer_id, lottery_type, payout, won_amount, settled_at,
        tenant_id
      `)
      .order('created_at', { ascending: false })
      .limit(limit * 2);

    if (entries) {
      transactions.push(...entries.map(e => ({
        id: `entry-${e.id}`,
        type: (e.status === 'cancelled' ? 'cancelled_bet' : 
               e.status === 'won' ? 'win_payout' : 'lottery_bet') as BettingTransactionType,
        game_type: 'lottery' as GameType,
        amount: Number(e.amount) || 0,
        potential_win: Number(e.payout) || 0,
        actual_win: e.status === 'won' ? Number(e.won_amount) || 0 : undefined,
        status: e.status || 'pending',
        description: `${e.bet_type}: ${e.number}`,
        bet_details: `${e.bet_type} - ${e.number}`,
        lottery_type: e.lottery_type,
        number: e.number,
        bet_type: e.bet_type,
        customer_id: e.customer_id,
        tenant_id: e.tenant_id,
        created_at: e.created_at,
        settled_at: e.settled_at,
      })));
    }

    // 2. Auto entries (automated lottery bets)
    const { data: autoEntries } = await supabase
      .from('auto_entries')
      .select(`
        id, number, bet_type, amount, status, created_at,
        customer_id, lottery_type, payout, won_amount, settled_at,
        tenant_id
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (autoEntries) {
      transactions.push(...autoEntries.map(e => ({
        id: `auto-entry-${e.id}`,
        type: (e.status === 'cancelled' ? 'cancelled_bet' : 
               e.status === 'won' ? 'win_payout' : 'lottery_bet') as BettingTransactionType,
        game_type: 'lottery' as GameType,
        amount: Number(e.amount) || 0,
        potential_win: Number(e.payout) || 0,
        actual_win: e.status === 'won' ? Number(e.won_amount) || 0 : undefined,
        status: e.status || 'pending',
        description: `[ออโต้] ${e.bet_type}: ${e.number}`,
        bet_details: `${e.bet_type} - ${e.number}`,
        lottery_type: e.lottery_type,
        number: e.number,
        bet_type: e.bet_type,
        customer_id: e.customer_id,
        tenant_id: e.tenant_id,
        created_at: e.created_at,
        settled_at: e.settled_at,
      })));
    }

    // 3. Provider bets (casino/slots/sports from external providers)
    const { data: providerBets } = await supabase
      .from('provider_bets')
      .select(`
        id, game_type, bet_amount, win_amount, status, created_at,
        customer_id, provider_id, game_id, round_id, settled_at,
        tenant_id, provider:provider_plugins(name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (providerBets) {
      transactions.push(...providerBets.map(b => ({
        id: `provider-bet-${b.id}`,
        type: (b.status === 'cancelled' ? 'cancelled_bet' :
               b.status === 'rollback' ? 'rollback_bet' :
               b.win_amount && b.win_amount > 0 ? 'win_payout' :
               `${b.game_type}_bet`) as BettingTransactionType,
        game_type: b.game_type as GameType,
        amount: Number(b.bet_amount) || 0,
        actual_win: Number(b.win_amount) || 0,
        status: b.status || 'pending',
        description: `${b.game_type} bet`,
        provider_id: b.provider_id,
        provider_name: (b.provider as any)?.name,
        customer_id: b.customer_id,
        tenant_id: b.tenant_id,
        game_id: b.game_id,
        round_id: b.round_id,
        created_at: b.created_at,
        settled_at: b.settled_at,
      })));
    }

    // Apply filters
    let filtered = transactions;

    if (gameType) {
      filtered = filtered.filter(t => t.game_type === gameType);
    }
    if (providerId) {
      filtered = filtered.filter(t => t.provider_id === providerId);
    }
    if (customerId) {
      filtered = filtered.filter(t => t.customer_id === customerId);
    }
    if (tenantId) {
      filtered = filtered.filter(t => t.tenant_id === tenantId);
    }
    if (status) {
      filtered = filtered.filter(t => t.status === status);
    }
    if (dateFrom) {
      filtered = filtered.filter(t => new Date(t.created_at) >= new Date(dateFrom));
    }
    if (dateTo) {
      filtered = filtered.filter(t => new Date(t.created_at) <= new Date(dateTo));
    }
    if (lotteryType) {
      filtered = filtered.filter(t => t.lottery_type === lotteryType);
    }

    // Sort by date
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Paginate
    const paginated = filtered.slice(offset, offset + limit);

    // Calculate dashboard stats
    const today = new Date().toISOString().split('T')[0];
    const todayBets = filtered.filter(t => t.created_at.startsWith(today));
    const activeBets = filtered.filter(t => t.status === 'pending' || t.status === 'active');

    const totalBetAmount = filtered.reduce((sum, t) => sum + t.amount, 0);
    const totalWinAmount = filtered.reduce((sum, t) => sum + (t.actual_win || 0), 0);

    const stats = {
      totalBets: filtered.length,
      activeBets: activeBets.length,
      totalTurnover: totalBetAmount,
      totalWins: totalWinAmount,
      totalLoss: totalBetAmount - totalWinAmount,
      payoutRatio: totalBetAmount > 0 ? ((totalWinAmount / totalBetAmount) * 100).toFixed(2) : 0,
      todayBets: todayBets.length,
      todayTurnover: todayBets.reduce((sum, t) => sum + t.amount, 0),
      todayWins: todayBets.reduce((sum, t) => sum + (t.actual_win || 0), 0),
      currentExposure: activeBets.reduce((sum, t) => sum + (t.potential_win || t.amount * 10), 0),
      byGameType: {
        lottery: filtered.filter(t => t.game_type === 'lottery').length,
        casino: filtered.filter(t => t.game_type === 'casino').length,
        slots: filtered.filter(t => t.game_type === 'slots').length,
        sports: filtered.filter(t => t.game_type === 'sports').length,
      },
    };

    return NextResponse.json({
      success: true,
      transactions: paginated,
      total: filtered.length,
      stats,
    });
  } catch (error) {
    console.error('Betting Transactions API error:', error);
    return NextResponse.json({ 
      success: false,
      transactions: [],
      total: 0,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { action } = body;

    // Export functionality
    if (action === 'export') {
      const { format = 'csv', ...filters } = body;
      
      const response = await fetch(`${request.url}?${new URLSearchParams(filters).toString()}`);
      const data = await response.json();
      
      if (format === 'csv') {
        const headers = ['ID', 'Type', 'Game', 'Amount', 'Win', 'Status', 'Description', 'Date'];
        const rows = data.transactions.map((t: BettingTransaction) => [
          t.id,
          t.type,
          t.game_type,
          t.amount,
          t.actual_win || 0,
          t.status,
          t.description || '',
          t.created_at,
        ]);
        
        const csv = [headers.join(','), ...rows.map((r: (string | number)[]) => r.join(','))].join('\n');
        
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="betting-transactions-${new Date().toISOString().split('T')[0]}.csv"`,
          },
        });
      }
      
      return NextResponse.json(data);
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Betting Transactions POST error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
