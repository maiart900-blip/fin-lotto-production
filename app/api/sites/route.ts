import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentOrHigher } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET: ดึงรายการเว็บลูกทั้งหมด
export async function GET() {
  try {
    // Auth guard - require agent or higher
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    
    // Try to get sites from sites table
    const { data: sites, error } = await supabase
      .from('sites')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === '42P01') {
        return NextResponse.json({
          success: true,
          sites: [],
          message: 'ยังไม่มีเว็บลูกในระบบ',
        });
      }
      throw error;
    }
    
    return NextResponse.json({
      success: true,
      sites: sites || [],
      totalSites: sites?.length || 0,
    });
  } catch (error: any) {
    console.error('[API] sites error:', error);
    return NextResponse.json({ 
      success: true,
      sites: [],
      totalSites: 0,
      message: 'ยังไม่มีเว็บลูกในระบบ',
    });
  }
}

// POST: สร้างเว็บลูกใหม่
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { name, domain, primaryColor, commission, useGlobalRates, useGlobalLimits } = body;
    
    if (!name || !domain) {
      return NextResponse.json({ 
        success: false, 
        error: 'กรุณากรอกชื่อเว็บและ domain' 
      }, { status: 400 });
    }
    
    // Generate API key
    const apiKey = 'sk_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const { data: newSite, error } = await supabase
      .from('sites')
      .insert({
        name,
        domain,
        api_key: apiKey,
        status: 'active',
        theme: { primary: primaryColor || '#F59E0B' },
        settings: {
          useGlobalRates: useGlobalRates ?? true,
          useGlobalLimits: useGlobalLimits ?? true,
          commission: commission || 20,
        },
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true,
      site: newSite,
      apiKey,
    });
  } catch (error: any) {
    console.error('[API] create site error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'เกิดข้อผิดพลาดในการสร้างเว็บลูก' 
    }, { status: 500 });
  }
}
