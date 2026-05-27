import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = getSupabase();
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    const cookieStore = await cookies();
    const token = cookieStore.get('tenant_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { id: string };

    // Get tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const history: any[] = [];

    // Get bets
    if (type === 'all' || type === 'bet') {
      const { data: bets } = await supabase
        .from('bets')
        .select('id, number, bet_type, amount, status, created_at')
        .eq('customer_id', decoded.id)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(50);

      (bets || []).forEach((bet: any) => {
        history.push({
          id: bet.id,
          type: 'bet',
          amount: bet.amount,
          status: bet.status,
          description: `แทง ${bet.bet_type} เลข ${bet.number}`,
          created_at: bet.created_at,
        });
      });
    }

    // Get deposits
    if (type === 'all' || type === 'deposit') {
      const { data: deposits } = await supabase
        .from('tenant_topup_requests')
        .select('id, amount, status, created_at')
        .eq('customer_id', decoded.id)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(50);

      (deposits || []).forEach((d: any) => {
        history.push({
          id: d.id,
          type: 'deposit',
          amount: d.amount,
          status: d.status,
          description: 'ฝากเงิน',
          created_at: d.created_at,
        });
      });
    }

    // Get withdrawals
    if (type === 'all' || type === 'withdraw') {
      const { data: withdrawals } = await supabase
        .from('tenant_withdraw_requests')
        .select('id, amount, status, created_at')
        .eq('customer_id', decoded.id)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(50);

      (withdrawals || []).forEach((w: any) => {
        history.push({
          id: w.id,
          type: 'withdraw',
          amount: w.amount,
          status: w.status,
          description: 'ถอนเงิน',
          created_at: w.created_at,
        });
      });
    }

    // Sort by date
    history.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ history: history.slice(0, 100) });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
