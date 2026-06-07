import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

// GET - ดึงข้อมูล partner ของลูกค้า
export async function GET() {
  try {
    const supabase = await createClient();
    const cookieStore = await cookies();
    const customerId = cookieStore.get('customer_id')?.value;
    
    if (!customerId) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    
    // ดึงข้อมูลลูกค้าพร้อม partner info
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select(`
        id,
        name,
        phone,
        referral_code,
        agent_level,
        upline_id,
        commission_rate,
        is_partner,
        total_commission,
        pending_commission,
        credit_balance
      `)
      .eq('id', customerId)
      .single();
    
    if (customerError || !customer) {
      return NextResponse.json({ 
        isPartner: false,
        sharePercent: 0,
        totalSales: 0,
        totalEarnings: 0,
        monthlySummary: []
      });
    }
    
    // ถ้าไม่ใช่ partner
    if (!customer.is_partner && customer.agent_level === 'member') {
      return NextResponse.json({
        isPartner: false,
        sharePercent: 0,
        totalSales: 0,
        totalEarnings: 0,
        monthlySummary: [],
        customer: {
          id: customer.id,
          name: customer.name,
          referral_code: customer.referral_code,
        },
      });
    }
    
    // นับจำนวนทีม (downline)
    const { count: totalTeam } = await supabase
      .from('customers')
      .select('id', { count: 'exact' })
      .eq('upline_id', customerId);
    
    // ดึงประวัติคอมมิชชั่นล่าสุด (commission_transactions ใช้ user_id)
    const { data: commissions } = await supabase
      .from('commission_transactions')
      .select('*')
      .eq('user_id', customerId)
      .order('created_at', { ascending: false })
      .limit(12);
    
    // สร้าง monthly summary จาก commissions
    const monthlySummary = (commissions || []).map(c => ({
      period: new Date(c.created_at).toLocaleDateString('th-TH', { month: 'short', year: 'numeric' }),
      sales: Number(c.amount || 0),
      earnings: Number(c.amount || 0) * (Number(c.percent || 0) / 100),
    }));
    
    return NextResponse.json({
      isPartner: true,
      sharePercent: customer.commission_rate || 5,
      totalSales: 0, // จะคำนวณจาก entries ของ downline
      totalEarnings: customer.total_commission || 0,
      pendingEarnings: customer.pending_commission || 0,
      totalTeam: totalTeam || 0,
      monthlySummary,
      customer: {
        id: customer.id,
        name: customer.name,
        referral_code: customer.referral_code,
        agent_level: customer.agent_level,
        commission_rate: customer.commission_rate,
      },
    });
  } catch (error) {
    console.error('Partner API error:', error);
    return NextResponse.json({ 
      isPartner: false,
      sharePercent: 0,
      totalSales: 0,
      totalEarnings: 0,
      monthlySummary: []
    });
  }
}

// POST - สมัครเป็น partner
export async function POST() {
  try {
    const supabase = await createClient();
    const cookieStore = await cookies();
    const customerId = cookieStore.get('customer_id')?.value;
    
    if (!customerId) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    
    // ตรวจสอบว่าเป็น partner แล้วหรือยัง
    const { data: customer } = await supabase
      .from('customers')
      .select('is_partner, agent_level')
      .eq('id', customerId)
      .single();
    
    if (customer?.is_partner || (customer?.agent_level && customer.agent_level !== 'member')) {
      return NextResponse.json({ error: 'คุณเป็น partner อยู่แล้ว' }, { status: 400 });
    }
    
    // อัพเดทเป็น partner (ระดับ agent)
    const { error } = await supabase
      .from('customers')
      .update({
        is_partner: true,
        agent_level: 'agent',
        commission_rate: 5,
      })
      .eq('id', customerId);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, message: 'สมัครเป็น partner สำเร็จ' });
  } catch (error) {
    console.error('Partner POST error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
