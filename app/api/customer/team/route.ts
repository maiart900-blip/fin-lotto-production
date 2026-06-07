import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const supabase = await createClient();
    const cookieStore = await cookies();
    const customerId = cookieStore.get('customer_id')?.value;
    
    if (!customerId) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    
    // Get current customer info
    const { data: customer } = await supabase
      .from('customers')
      .select('referral_code, agent_level, commission_rate, total_commission, pending_commission')
      .eq('id', customerId)
      .single();
    
    if (!customer) {
      return NextResponse.json({ 
        totalMembers: 0, 
        totalCommission: 0, 
        commissionRate: 5,
        members: [] 
      });
    }
    
    // Get team members (downline) - ใช้ทั้ง referred_by และ upline_id
    let members: Array<{
      id: string;
      name: string;
      username: string;
      phone: string;
      agent_level: string;
      created_at: string;
      total_bets?: number;
    }> = [];
    
    // ดึงจาก upline_id (ระบบสายงานใหม่)
    const { data: downlineMembers } = await supabase
      .from('customers')
      .select('id, name, username, phone, agent_level, created_at')
      .eq('upline_id', customerId)
      .order('created_at', { ascending: false });
    
    if (downlineMembers && downlineMembers.length > 0) {
      members = downlineMembers;
    } else if (customer.referral_code) {
      // Fallback: ดึงจาก referred_by (ระบบ referral เดิม)
      const { data: referredMembers } = await supabase
        .from('customers')
        .select('id, name, username, phone, agent_level, created_at')
        .eq('referred_by', customer.referral_code)
        .order('created_at', { ascending: false });
      
      members = referredMembers || [];
    }
    
    // Calculate total bets for each member
    const membersWithBets = await Promise.all(
      members.map(async (member) => {
        const { data: entries } = await supabase
          .from('entries')
          .select('total_amount')
          .eq('customer_id', member.id);
        
        const totalBets = (entries || []).reduce((sum, e) => sum + Number(e.total_amount || 0), 0);
        return { ...member, total_bets: totalBets };
      })
    );
    
    return NextResponse.json({
      totalMembers: members.length,
      totalCommission: customer.total_commission || 0,
      pendingCommission: customer.pending_commission || 0,
      commissionRate: customer.commission_rate || 5,
      agentLevel: customer.agent_level || 'member',
      members: membersWithBets,
    });
  } catch (error) {
    console.error('Team API error:', error);
    return NextResponse.json({ 
      totalMembers: 0, 
      totalCommission: 0, 
      commissionRate: 5,
      members: [] 
    });
  }
}
