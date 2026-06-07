import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

/**
 * API สำหรับ Broadcast การเปลี่ยนแปลงหวยไปทุกเว็บลูก
 * ADMIN ONLY - ใช้สำหรับ sync ข้อมูลหวยไปยัง sub-sites
 */
export async function POST(request: Request) {
  try {
    // Auth guard - require admin for broadcasting
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const { action, lottery, lotteryId } = await request.json();
    
    // Get all active sub-sites
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, name, domain, sync_lottery_status')
      .eq('is_active', true)
      .eq('is_master', false);
    
    if (!tenants || tenants.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No active sub-sites to notify',
        notified: 0,
      });
    }
    
    // Create notification message based on action
    let alertTitle = '';
    let alertMessage = '';
    
    switch (action) {
      case 'created':
        alertTitle = 'หวยใหม่พร้อมใช้งาน';
        alertMessage = `หวย "${lottery?.name}" ถูกเพิ่มเข้าระบบแล้ว สามารถรับแทงได้ทันที`;
        break;
      case 'status_changed':
        alertTitle = lottery?.is_active ? 'เปิดรับแทงหวย' : 'ปิดรับแทงหวย';
        alertMessage = `หวย "${lottery?.name}" ${lottery?.is_active ? 'เปิด' : 'ปิด'}รับแทงแล้ว`;
        break;
      case 'time_changed':
        alertTitle = 'เปลี่ยนเวลารับแทง';
        alertMessage = `หวย "${lottery?.name}" เปลี่ยนเวลาเป็น ${lottery?.open_time} - ${lottery?.close_time}`;
        break;
      case 'rates_changed':
        alertTitle = 'เปลี่ยนอัตราจ่าย';
        alertMessage = `อัตราจ่ายหวย "${lottery?.name}" ถูกอัปเดตแล้ว`;
        break;
      default:
        alertTitle = 'อัปเดตข้อมูลหวย';
        alertMessage = `ข้อมูลหวย "${lottery?.name}" ถูกอัปเดตแล้ว`;
    }
    
    // Filter tenants that sync lottery status
    const tenantsToNotify = tenants.filter(t => t.sync_lottery_status);
    
    if (tenantsToNotify.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No sub-sites have lottery sync enabled',
        notified: 0,
      });
    }
    
    // Create alerts for each tenant
    const alerts = tenantsToNotify.map(tenant => ({
      tenant_id: tenant.id,
      alert_type: 'info',
      title: alertTitle,
      message: alertMessage,
    }));
    
    await supabase.from('tenant_alerts').insert(alerts);
    
    // Update last sync timestamp for all notified tenants
    await supabase
      .from('tenants')
      .update({ last_sync_at: new Date().toISOString() })
      .in('id', tenantsToNotify.map(t => t.id));
    
    return NextResponse.json({
      success: true,
      action,
      lottery: lottery?.name,
      notified: tenantsToNotify.length,
      message: `Notified ${tenantsToNotify.length} sub-sites`,
    });
  } catch (err) {
    console.error('Lottery broadcast error:', err);
    return NextResponse.json({ 
      success: false, 
      error: 'Broadcast failed' 
    }, { status: 500 });
  }
}

/**
 * GET: ดูสถานะ Sync ของทุกเว็บลูก - ADMIN ONLY
 */
export async function GET() {
  try {
    // Auth guard - require admin for viewing sync status
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    
    const { data: tenants } = await supabase
      .from('tenants')
      .select(`
        id, 
        name, 
        domain, 
        sync_lottery_status,
        sync_payout_rates,
        sync_blocked_numbers,
        last_sync_at,
        is_active
      `)
      .eq('is_master', false)
      .order('name');
    
    // Get count of active lotteries
    const { count: lotteryCount } = await supabase
      .from('lotteries')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    
    return NextResponse.json({
      success: true,
      activeLotteries: lotteryCount || 0,
      subSites: tenants || [],
      subSitesCount: tenants?.length || 0,
      syncEnabled: tenants?.filter(t => t.sync_lottery_status).length || 0,
    });
  } catch (err) {
    console.error('Broadcast status error:', err);
    return NextResponse.json({ success: false, error: 'Failed to get status' }, { status: 500 });
  }
}
