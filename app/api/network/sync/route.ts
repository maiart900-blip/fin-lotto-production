import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Multi-Site Network Sync API
 * 
 * เว็บแม่ Push ข้อมูลไปยังเว็บลูกทั้งหมดแบบ Real-time
 * - Lottery Status (เปิด/ปิดรับ)
 * - Payout Rates (เรทจ่าย)
 * - Blocked Numbers (เลขอั้น)
 * - Market Settings (ตั้งค่าตลาด)
 */

interface ChildSite {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
  status: 'active' | 'inactive' | 'maintenance';
  last_sync: string | null;
}

interface SyncPayload {
  type: 'lottery_status' | 'payout_rates' | 'blocked_numbers' | 'market_close' | 'full_sync';
  data: Record<string, any>;
  timestamp: string;
  master_site_id: string;
}

// GET - ดึงรายชื่อเว็บลูกทั้งหมด
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: childSites, error } = await supabase
      .from('child_sites')
      .select('*')
      .order('name');

    if (error) throw error;

    // คำนวณสถิติ
    const stats = {
      total: childSites?.length || 0,
      active: childSites?.filter(s => s.status === 'active').length || 0,
      inactive: childSites?.filter(s => s.status === 'inactive').length || 0,
      maintenance: childSites?.filter(s => s.status === 'maintenance').length || 0,
    };

    return NextResponse.json({
      sites: childSites || [],
      stats,
    });
  } catch (error) {
    console.error('Error fetching child sites:', error);
    return NextResponse.json({ error: 'Failed to fetch child sites' }, { status: 500 });
  }
}

// POST - Push ข้อมูลไปยังเว็บลูกทั้งหมด
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { type, data, targetSites } = body;

    // ดึงรายชื่อเว็บลูกที่ต้อง sync
    let query = supabase
      .from('child_sites')
      .select('*')
      .eq('status', 'active');
    
    if (targetSites?.length > 0) {
      query = query.in('id', targetSites);
    }

    const { data: childSites, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!childSites?.length) {
      return NextResponse.json({ 
        success: true, 
        message: 'No active child sites to sync',
        synced: 0 
      });
    }

    // สร้าง Sync Payload
    const payload: SyncPayload = {
      type,
      data,
      timestamp: new Date().toISOString(),
      master_site_id: process.env.MASTER_SITE_ID || 'master-001',
    };

    // Push ไปยังเว็บลูกทั้งหมดแบบ Parallel
    const syncResults = await Promise.allSettled(
      childSites.map(async (site) => {
        try {
          const response = await fetch(`${site.api_url}/api/network/receive`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': site.api_key,
              'X-Master-Site': payload.master_site_id,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000), // 10s timeout
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          // อัปเดต last_sync
          await supabase
            .from('child_sites')
            .update({ 
              last_sync: payload.timestamp,
              sync_status: 'success',
            })
            .eq('id', site.id);

          return { siteId: site.id, siteName: site.name, success: true };
        } catch (err: any) {
          // บันทึก error
          await supabase
            .from('child_sites')
            .update({ 
              sync_status: 'error',
              last_error: err.message,
            })
            .eq('id', site.id);

          return { siteId: site.id, siteName: site.name, success: false, error: err.message };
        }
      })
    );

    // สรุปผล
    const successful = syncResults.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
    const failed = syncResults.length - successful;

    // บันทึก Sync Log
    await supabase.from('network_sync_logs').insert({
      sync_type: type,
      payload: data,
      total_sites: childSites.length,
      successful,
      failed,
      results: syncResults.map(r => r.status === 'fulfilled' ? r.value : { error: 'Promise rejected' }),
      created_at: payload.timestamp,
    });

    return NextResponse.json({
      success: true,
      message: `Synced to ${successful}/${childSites.length} sites`,
      synced: successful,
      failed,
      details: syncResults.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean),
    });
  } catch (error: any) {
    console.error('Error syncing to child sites:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - อัปเดตการตั้งค่าเว็บลูก
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { siteId, updates } = body;

    const { data, error } = await supabase
      .from('child_sites')
      .update(updates)
      .eq('id', siteId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating child site:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
