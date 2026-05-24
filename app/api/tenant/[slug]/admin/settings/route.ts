import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();

    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, name, slug, domain, logo_url, theme_config, is_active')
      .eq('slug', slug)
      .single();

    if (error || !tenant) {
      return NextResponse.json({ error: 'ไม่พบเว็บไซต์' }, { status: 404 });
    }

    return NextResponse.json(tenant);
  } catch (error) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const { name, domain, logo_url, welcome_message, contact_line, contact_phone, theme_config } = body;

    // Get tenant id first
    const { data: tenant, error: findError } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (findError || !tenant) {
      return NextResponse.json({ error: 'ไม่พบเว็บไซต์' }, { status: 404 });
    }

    // Update tenant
    const { data: updated, error: updateError } = await supabase
      .from('tenants')
      .update({
        name,
        domain,
        logo_url,
        theme_config,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenant.id)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Settings API error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
