import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET - Dashboard สถิติรวมสำหรับเว็บกลาง
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'dashboard';

    // Dashboard Overview
    if (action === 'dashboard') {
      // ดึงข้อมูล tenants ทั้งหมด (ไม่รวม master)
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, name, slug, domain, is_active, owner_id, created_at')
        .or('is_master.is.null,is_master.eq.false')
        .order('created_at', { ascending: false });

      // ดึงยอด settlements pending
      const { data: pendingSettlements } = await supabase
        .from('tenant_settlements')
        .select('id, tenant_id, settlement_amount, status')
        .eq('status', 'pending');

      // ดึงยอด settlements approved วันนี้
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: approvedToday } = await supabase
        .from('tenant_settlements')
        .select('id, settlement_amount')
        .eq('status', 'approved')
        .gte('approved_at', today.toISOString());

      // ดึงยอดรวมทั้งหมดที่ approved
      const { data: totalApproved } = await supabase
        .from('tenant_settlements')
        .select('settlement_amount')
        .eq('status', 'approved');

      // คำนวณสถิติ
      const totalTenants = tenants?.length || 0;
      const activeTenants = tenants?.filter(t => t.is_active !== false).length || 0;
      const pendingCount = pendingSettlements?.length || 0;
      const pendingAmount = pendingSettlements?.reduce((sum, s) => sum + Number(s.settlement_amount || 0), 0) || 0;
      const approvedTodayCount = approvedToday?.length || 0;
      const approvedTodayAmount = approvedToday?.reduce((sum, s) => sum + Number(s.settlement_amount || 0), 0) || 0;
      const totalApprovedAmount = totalApproved?.reduce((sum, s) => sum + Number(s.settlement_amount || 0), 0) || 0;

      return NextResponse.json({
        tenants,
        stats: {
          totalTenants,
          activeTenants,
          pendingCount,
          pendingAmount,
          approvedTodayCount,
          approvedTodayAmount,
          totalApprovedAmount
        }
      });
    }

    // รายการ settlements ทั้งหมด
    if (action === 'settlements') {
      const status = searchParams.get('status');
      
      let query = supabase
        .from('tenant_settlements')
        .select(`
          *,
          tenant:tenants(id, name, slug)
        `)
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data: settlements, error } = await query.limit(100);

      if (error) throw error;

      return NextResponse.json({ settlements });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching master dashboard:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

// PUT - อนุมัติหรือปฏิเสธ settlement
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { settlement_id, action, approved_by, notes } = body;

    if (!settlement_id || !action) {
      return NextResponse.json({ error: 'settlement_id and action required' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use approve or reject' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      status: action === 'approve' ? 'approved' : 'rejected',
      approved_at: new Date().toISOString(),
      approved_by
    };

    if (notes) {
      updateData.notes = notes;
    }

    const { data, error } = await supabase
      .from('tenant_settlements')
      .update(updateData)
      .eq('id', settlement_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, settlement: data });
  } catch (error) {
    console.error('Error updating settlement:', error);
    return NextResponse.json({ error: 'Failed to update settlement' }, { status: 500 });
  }
}
