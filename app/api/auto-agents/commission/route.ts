import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'daily';
    const status = searchParams.get('status') || 'all';

    let query = supabase
      .from('commission_transactions')
      .select('id, agent_id, period_type, period_start, period_end, total_sales, commission_rate, commission_amount, status, paid_at, created_at')
      .eq('source_type', 'auto')
      .order('created_at', { ascending: false });

    if (period !== 'all') query = query.eq('period_type', period);
    if (status !== 'all') query = query.eq('status', status);

    const { data: commissions, error } = await query.limit(100);
    if (error) throw error;

    const agentIds = [...new Set(commissions?.map(c => c.agent_id) || [])];
    const { data: agents } = await supabase.from('users').select('id, username, display_name').in('id', agentIds);

    const mappedCommissions = commissions?.map(comm => {
      const agent = agents?.find(a => a.id === comm.agent_id);
      return { ...comm, agent_name: agent?.display_name || 'Unknown', agent_username: agent?.username || 'unknown' };
    }) || [];

    const stats = {
      totalEarned: mappedCommissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0),
      pendingAmount: mappedCommissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + (c.commission_amount || 0), 0),
      paidAmount: mappedCommissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.commission_amount || 0), 0),
      totalAgents: new Set(mappedCommissions.map(c => c.agent_id)).size,
      avgCommission: mappedCommissions.length > 0 ? Math.round(mappedCommissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0) / mappedCommissions.length) : 0,
    };

    return NextResponse.json({ commissions: mappedCommissions, stats });
  } catch (error: any) {
    console.error('Error fetching commissions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { action, id, periodType } = body;

    if (action === 'approve') {
      await supabase.from('commission_transactions').update({ status: 'approved' }).eq('id', id);
      await supabase.from('audit_logs').insert({ action: 'approve_commission', entity_type: 'commission_transactions', entity_id: id });
      return NextResponse.json({ success: true });
    }

    if (action === 'pay') {
      await supabase.from('commission_transactions').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id);
      const { data: commission } = await supabase.from('commission_transactions').select('agent_id, commission_amount').eq('id', id).single();
      if (commission) {
        const { data: agent } = await supabase.from('users').select('credit_balance').eq('id', commission.agent_id).single();
        await supabase.from('users').update({ credit_balance: (agent?.credit_balance || 0) + commission.commission_amount }).eq('id', commission.agent_id);
      }
      await supabase.from('audit_logs').insert({ action: 'pay_commission', entity_type: 'commission_transactions', entity_id: id });
      return NextResponse.json({ success: true });
    }

    if (action === 'calculate') {
      const now = new Date();
      let periodStart: Date, periodEnd: Date;

      switch (periodType) {
        case 'daily':
          periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
          break;
        case 'weekly':
          const dayOfWeek = now.getDay();
          periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
          periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - dayOfWeek), 23, 59, 59);
          break;
        case 'monthly':
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
          break;
        default:
          periodStart = new Date(now.getFullYear(), 0, 1);
          periodEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      }

      const { data: agents } = await supabase.from('users').select('id').eq('role', 'agent').eq('source_type', 'auto').eq('status', 'active');
      const { data: settings } = await supabase.from('agent_commission_settings').select('agent_id, commission_percent');
      const { data: sales } = await supabase.from('entries').select('user_id, amount').eq('source_type', 'auto').gte('created_at', periodStart.toISOString()).lte('created_at', periodEnd.toISOString());

      const commissions: any[] = [];
      agents?.forEach(agent => {
        const agentSettings = settings?.find(s => s.agent_id === agent.id);
        const rate = agentSettings?.commission_percent || 5;
        const totalSales = sales?.filter(s => s.user_id === agent.id).reduce((sum, s) => sum + (s.amount || 0), 0) || 0;
        
        if (totalSales > 0) {
          commissions.push({
            agent_id: agent.id,
            source_type: 'auto',
            period_type: periodType,
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
            total_sales: totalSales,
            commission_rate: rate,
            commission_amount: Math.round(totalSales * rate / 100),
            status: 'pending',
          });
        }
      });

      if (commissions.length > 0) {
        await supabase.from('commission_transactions').insert(commissions);
      }

      return NextResponse.json({ success: true, count: commissions.length });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error processing commission:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
