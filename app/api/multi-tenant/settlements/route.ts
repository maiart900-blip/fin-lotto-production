import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';

    // Build query
    let query = supabase
      .from('settlements')
      .select(`
        *,
        tenant:tenants(id, name, slug)
      `)
      .order('submitted_at', { ascending: false });

    // Filter by status
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    // Search
    if (search) {
      query = query.or(`id.ilike.%${search}%`);
    }

    const { data: settlements, error } = await query.limit(100);

    if (error) {
      console.error('Error fetching settlements:', error);
      // Return empty data instead of error
      return NextResponse.json({
        settlements: [],
        stats: {
          totalSettlements: 0,
          pendingCount: 0,
          approvedCount: 0,
          paidCount: 0,
          totalAmount: 0,
          pendingAmount: 0,
        },
      });
    }

    // Calculate stats
    const allSettlements = settlements || [];
    const stats = {
      totalSettlements: allSettlements.length,
      pendingCount: allSettlements.filter(s => s.status === 'pending').length,
      approvedCount: allSettlements.filter(s => s.status === 'approved').length,
      paidCount: allSettlements.filter(s => s.status === 'paid').length,
      totalAmount: allSettlements.reduce((sum, s) => sum + (s.settlement_amount || 0), 0),
      pendingAmount: allSettlements
        .filter(s => s.status === 'pending' || s.status === 'approved')
        .reduce((sum, s) => sum + (s.settlement_amount || 0), 0),
    };

    return NextResponse.json({ settlements: allSettlements, stats });
  } catch (error) {
    console.error('Settlements API error:', error);
    return NextResponse.json({
      settlements: [],
      stats: {
        totalSettlements: 0,
        pendingCount: 0,
        approvedCount: 0,
        paidCount: 0,
        totalAmount: 0,
        pendingAmount: 0,
      },
    });
  }
}

// Create new settlement
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { tenant_id, period_start, period_end, total_bets, total_wins, commission_rate } = body;

    if (!tenant_id || !period_start || !period_end) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const net_profit = total_bets - total_wins;
    const commission_amount = net_profit * (commission_rate || 0.1);
    const settlement_amount = net_profit - commission_amount;

    const { data, error } = await supabase
      .from('settlements')
      .insert({
        tenant_id,
        period_start,
        period_end,
        total_bets: total_bets || 0,
        total_wins: total_wins || 0,
        net_profit,
        commission_amount,
        settlement_amount,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating settlement:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Create settlement error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
