import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();

    // Get tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Get settlements
    const { data: settlements } = await supabase
      .from('tenant_settlements')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(50);

    // Calculate stats
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get pending amount (profit not yet settled)
    const { data: betsData } = await supabase
      .from('entries')
      .select('total_amount, prize_amount, status')
      .eq('tenant_id', tenant.id)
      .in('status', ['pending', 'won', 'lost']);

    const totalBets = betsData?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
    const totalPayout = betsData?.filter(b => b.status === 'won').reduce((sum, b) => sum + (b.prize_amount || 0), 0) || 0;
    const profit = totalBets - totalPayout;

    // Get already settled amount
    const settledAmount = settlements?.filter(s => s.status !== 'rejected').reduce((sum, s) => sum + (s.amount || 0), 0) || 0;
    const pendingAmount = Math.max(0, profit - settledAmount);

    // Get total sent this month
    const totalSentThisMonth = settlements
      ?.filter(s => new Date(s.created_at) >= firstDayOfMonth && s.status !== 'rejected')
      .reduce((sum, s) => sum + (s.amount || 0), 0) || 0;

    return NextResponse.json({
      settlements: settlements || [],
      stats: {
        pendingAmount,
        totalSentThisMonth,
        lastSettlementDate: settlements?.[0]?.created_at || null,
      },
    });
  } catch (error) {
    console.error('Get tenant settlements error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { amount } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('slug', slug)
      .single();

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Create settlement record
    const today = new Date();
    const periodStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const { data: settlement, error } = await supabase
      .from('tenant_settlements')
      .insert({
        tenant_id: tenant.id,
        amount,
        status: 'pending',
        period_start: periodStart.toISOString(),
        period_end: today.toISOString(),
        notes: `ส่งยอดจาก ${tenant.name}`,
      })
      .select()
      .single();

    if (error) {
      // Check if table doesn't exist
      if (error.code === '42P01') {
        return NextResponse.json({ 
          error: 'Settlement system not configured',
          message: 'กรุณาติดต่อผู้ดูแลระบบ' 
        }, { status: 500 });
      }
      throw error;
    }

    return NextResponse.json({ 
      success: true, 
      settlement,
      message: 'ส่งยอดสำเร็จ รอเว็บกลางอนุมัติ' 
    });
  } catch (error) {
    console.error('Create settlement error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
