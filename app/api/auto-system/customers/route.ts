import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const vipLevel = searchParams.get('vip_level');
    
    const offset = (page - 1) * limit;

    // Debug log
    console.log('Auto Customers API - params:', { page, limit, search, status, vipLevel });
    
    // Build query - filter for auto customers only (source_type = 'auto' OR system_type = 'auto')
    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .or('source_type.eq.auto,system_type.eq.auto')
      .order('created_at', { ascending: false });
    
    // Apply filters
    if (search) {
      query = query.or(`username.ilike.%${search}%,name.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    
    if (status && status !== 'all') {
      if (status === 'online') {
        query = query.eq('is_active', true);
      } else if (status === 'offline') {
        query = query.eq('is_active', false);
      } else if (status === 'new') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.gte('created_at', today.toISOString());
      }
    }
    
    if (vipLevel && vipLevel !== 'all') {
      query = query.eq('agent_level', vipLevel);
    }
    
    // Pagination
    query = query.range(offset, offset + limit - 1);
    
    const { data: customers, error, count } = await query;

    console.log('Auto Customers Query Result:', { 
      count, 
      fetched: customers?.length,
      sample: customers?.slice(0, 2),
      error 
    });
    
    if (error) {
      console.error('Error fetching auto customers:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get today's bets for each customer
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const customerIds = customers?.map(c => c.id) || [];
    
    // Fetch bets for these customers today
    let customerBetsMap: Record<string, number> = {};
    if (customerIds.length > 0) {
      const { data: betsData } = await supabase
        .from('bets')
        .select('customer_id, total_amount')
        .in('customer_id', customerIds)
        .gte('created_at', today.toISOString());
      
      customerBetsMap = (betsData || []).reduce((acc, bet) => {
        acc[bet.customer_id] = (acc[bet.customer_id] || 0) + Number(bet.total_amount || 0);
        return acc;
      }, {} as Record<string, number>);
    }
    
    // Transform data for frontend
    const transformedCustomers = (customers || []).map(customer => ({
      id: customer.id,
      username: customer.username || customer.phone || 'N/A',
      display_name: customer.name || 'ไม่ระบุชื่อ',
      phone: customer.phone || '',
      email: customer.email || '',
      credit_balance: Number(customer.credit_balance || 0),
      vip_level: customer.agent_level || 'member',
      status: customer.is_active ? 'active' : 'inactive',
      is_online: customer.is_active || false,
      last_activity_at: customer.last_login || customer.updated_at,
      total_bets_today: customerBetsMap[customer.id] || 0,
      total_deposits: Number(customer.total_turnover || 0),
      total_withdrawals: 0,
      created_at: customer.created_at,
      referral_code: customer.referral_code || '',
      source_type: customer.source_type,
      system_type: customer.system_type,
    }));
    
    const totalPages = Math.ceil((count || 0) / limit);

    console.log('Auto Customers Transformed:', { 
      total: count,
      transformed: transformedCustomers.length,
      sample: transformedCustomers.slice(0, 2) 
    });
    
    return NextResponse.json({
      customers: transformedCustomers,
      total: count || 0,
      page,
      limit,
      totalPages,
    });
  } catch (error: unknown) {
    console.error('Error in auto-system customers API:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}
