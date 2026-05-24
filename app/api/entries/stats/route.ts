import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');

    // สร้าง base query
    let entriesQuery = supabase
      .from('entries')
      .select('id, total_amount, status, payout_amount, customer_id');

    // ถ้าเลือก agent เฉพาะ - filter by customer's upline
    if (agentId && agentId !== 'all') {
      // ดึง customer ids ที่มี upline เป็น agent นี้
      const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .eq('upline_id', agentId);
      
      const customerIds = customers?.map(c => c.id) || [];
      if (customerIds.length > 0) {
        entriesQuery = entriesQuery.in('customer_id', customerIds);
      } else {
        // ไม่มีลูกค้าในสายงาน
        return NextResponse.json({
          total_entries: 0,
          total_amount: 0,
          win_rate: 0,
          avg_amount: 0,
          total_payout: 0,
          by_agent: []
        });
      }
    }

    const { data: entries, error: entriesError } = await entriesQuery;

    if (entriesError) {
      console.error('Error fetching entries:', entriesError);
      return NextResponse.json({ error: entriesError.message }, { status: 500 });
    }

    // คำนวณสถิติรวม
    const totalEntries = entries?.length || 0;
    const totalAmount = entries?.reduce((sum, e) => sum + (e.total_amount || 0), 0) || 0;
    const winEntries = entries?.filter(e => e.status === 'won') || [];
    const winCount = winEntries.length;
    const winRate = totalEntries > 0 ? (winCount / totalEntries) * 100 : 0;
    const avgAmount = totalEntries > 0 ? totalAmount / totalEntries : 0;
    const totalPayout = entries?.reduce((sum, e) => sum + (e.payout_amount || 0), 0) || 0;

    // คำนวณสถิติแยกตาม agent
    // ดึง agents ทั้งหมด
    const { data: agents } = await supabase
      .from('customers')
      .select('id, username, display_name')
      .eq('role', 'agent');

    const byAgent = await Promise.all((agents || []).map(async (agent) => {
      // ดึง customer ids ในสายงาน agent นี้
      const { data: downlineCustomers } = await supabase
        .from('customers')
        .select('id')
        .eq('upline_id', agent.id);
      
      const customerIds = downlineCustomers?.map(c => c.id) || [];
      
      if (customerIds.length === 0) {
        return {
          agent_id: agent.id,
          agent_name: agent.display_name || agent.username,
          total_entries: 0,
          total_amount: 0,
          win_count: 0,
          total_payout: 0
        };
      }

      const { data: agentEntries } = await supabase
        .from('entries')
        .select('id, total_amount, status, payout_amount')
        .in('customer_id', customerIds);

      const agentTotalEntries = agentEntries?.length || 0;
      const agentTotalAmount = agentEntries?.reduce((sum, e) => sum + (e.total_amount || 0), 0) || 0;
      const agentWinCount = agentEntries?.filter(e => e.status === 'won').length || 0;
      const agentTotalPayout = agentEntries?.reduce((sum, e) => sum + (e.payout_amount || 0), 0) || 0;

      return {
        agent_id: agent.id,
        agent_name: agent.display_name || agent.username,
        total_entries: agentTotalEntries,
        total_amount: agentTotalAmount,
        win_count: agentWinCount,
        total_payout: agentTotalPayout
      };
    }));

    // กรองเฉพาะ agent ที่มีข้อมูล
    const filteredByAgent = byAgent.filter(a => a.total_entries > 0);

    return NextResponse.json({
      total_entries: totalEntries,
      total_amount: totalAmount,
      win_rate: winRate,
      avg_amount: avgAmount,
      total_payout: totalPayout,
      by_agent: filteredByAgent
    });

  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
