import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - ดึงข้อมูลเครือข่ายลูกสายทั้งหมดแบบ Real-time
export async function GET() {
  try {
    const supabase = await createClient();

    // ดึงลูกสายทั้งหมดจาก customers table
    const { data: agents, error: agentsError } = await supabase
      .from('customers')
      .select(`
        id, username, name, phone, is_active, 
        credit_balance, created_at, upline_id, agent_level, commission_rate
      `)
      .not('agent_level', 'is', null)
      .order('created_at', { ascending: false });

    if (agentsError) throw agentsError;

    const agentIds = agents?.map(a => a.id) || [];

    // ดึงยอดขายวันนี้ต่อ agent
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: todaySales } = await supabase
      .from('entries')
      .select('customer_id, amount, created_at')
      .in('customer_id', agentIds)
      .gte('created_at', today.toISOString());

    // ดึงยอดขายเดือนนี้
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const { data: monthSales } = await supabase
      .from('entries')
      .select('customer_id, amount')
      .in('customer_id', agentIds)
      .gte('created_at', monthStart.toISOString());

    // ดึงจำนวนลูกค้าต่อ agent (customers without agent_level)
    const { data: customerCounts } = await supabase
      .from('customers')
      .select('upline_id')
      .in('upline_id', agentIds)
      .is('agent_level', null);

    // Map ข้อมูลทั้งหมด
    const mappedAgents = agents?.map(agent => {
      const agentTodaySales = todaySales?.filter(s => s.customer_id === agent.id) || [];
      const agentMonthSales = monthSales?.filter(s => s.customer_id === agent.id) || [];
      const agentCustomers = customerCounts?.filter(c => c.upline_id === agent.id) || [];

      const todayAmount = agentTodaySales.reduce((sum, s) => sum + (s.amount || 0), 0);
      const monthAmount = agentMonthSales.reduce((sum, s) => sum + (s.amount || 0), 0);
      const lastActivity = agentTodaySales.length > 0 
        ? new Date(Math.max(...agentTodaySales.map(s => new Date(s.created_at).getTime())))
        : null;

      return {
        id: agent.id,
        username: agent.username,
        displayName: agent.name,
        phone: agent.phone,
        status: agent.is_active ? 'active' : 'suspended',
        isOnline: agent.is_active,
        creditLimit: 10000,
        creditBalance: agent.credit_balance || 0,
        creditUsed: 10000 - (agent.credit_balance || 0),
        customerCount: agentCustomers.length,
        todaySales: todayAmount,
        todayEntries: agentTodaySales.length,
        monthSales: monthAmount,
        commissionPercent: agent.commission_rate || 5,
        sharePercent: 0,
        lastActivity: lastActivity?.toISOString() || null,
        createdAt: agent.created_at,
      };
    }) || [];

    // สรุปสถิติรวม
    const summary = {
      totalAgents: mappedAgents.length,
      activeAgents: mappedAgents.filter(a => a.status === 'active').length,
      suspendedAgents: mappedAgents.filter(a => a.status === 'suspended').length,
      totalCredit: mappedAgents.reduce((sum, a) => sum + a.creditLimit, 0),
      totalCreditUsed: mappedAgents.reduce((sum, a) => sum + a.creditUsed, 0),
      totalTodaySales: mappedAgents.reduce((sum, a) => sum + a.todaySales, 0),
      totalMonthSales: mappedAgents.reduce((sum, a) => sum + a.monthSales, 0),
      totalCustomers: mappedAgents.reduce((sum, a) => sum + a.customerCount, 0),
    };

    return NextResponse.json({ 
      agents: mappedAgents, 
      summary,
      lastUpdated: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - ดำเนินการกับลูกสาย (เติม/ตัดเครดิต, ระงับ, etc.)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { action, agentId, ...data } = body;

    if (!agentId) {
      return NextResponse.json({ error: 'Missing agent ID' }, { status: 400 });
    }

    switch (action) {
      case 'add_credit': {
        const { amount, note } = data;
        if (!amount || amount <= 0) {
          return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
        }

        // ดึงเครดิตปัจจุบัน
        const { data: agent, error: fetchError } = await supabase
          .from('customers')
          .select('credit_balance')
          .eq('id', agentId)
          .single();

        if (fetchError) throw fetchError;

        const newBalance = (agent?.credit_balance || 0) + amount;

        await supabase
          .from('customers')
          .update({ credit_balance: newBalance })
          .eq('id', agentId);

        // บันทึก transaction
        await supabase.from('credit_transactions').insert({
          customer_id: agentId,
          type: 'deposit',
          amount,
          balance_after: newBalance,
          note: note || 'เติมเครดิตจาก Master',
        });

        return NextResponse.json({ success: true, newBalance });
      }

      case 'deduct_credit': {
        const { amount, note } = data;
        if (!amount || amount <= 0) {
          return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
        }

        const { data: agent } = await supabase
          .from('customers')
          .select('credit_balance')
          .eq('id', agentId)
          .single();

        if ((agent?.credit_balance || 0) < amount) {
          return NextResponse.json({ error: 'Insufficient credit' }, { status: 400 });
        }

        const newBalance = (agent?.credit_balance || 0) - amount;

        await supabase
          .from('customers')
          .update({ credit_balance: newBalance })
          .eq('id', agentId);

        await supabase.from('credit_transactions').insert({
          customer_id: agentId,
          type: 'withdraw',
          amount,
          balance_after: newBalance,
          note: note || 'หักเครดิตจาก Master',
        });

        return NextResponse.json({ success: true, newBalance });
      }

      case 'suspend': {
        await supabase
          .from('customers')
          .update({ is_active: false })
          .eq('id', agentId);

        return NextResponse.json({ success: true, message: 'Agent suspended' });
      }

      case 'activate': {
        await supabase
          .from('customers')
          .update({ is_active: true })
          .eq('id', agentId);

        return NextResponse.json({ success: true, message: 'Agent activated' });
      }

      case 'update_commission': {
        const { commissionPercent } = data;
        await supabase
          .from('customers')
          .update({ commission_rate: commissionPercent })
          .eq('id', agentId);

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
