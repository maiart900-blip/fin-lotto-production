import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

// GET - ดึงรายการสาขาทั้งหมด
export async function GET(request: NextRequest) {
  try {
    // Auth guard - require admin
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const branch_type = searchParams.get('branch_type');
    const is_active = searchParams.get('is_active');
    const search = searchParams.get('search');

    let query = supabase
      .from('branches')
      .select(`
        *,
        branch_settings (*),
        branch_finance (*),
        branch_domains (*)
      `)
      .order('created_at', { ascending: false });

    if (branch_type) {
      query = query.eq('branch_type', branch_type);
    }

    if (is_active !== null && is_active !== '') {
      query = query.eq('is_active', is_active === 'true');
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ branches: data });
  } catch (error) {
    console.error('Error fetching branches:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - สร้างสาขาใหม่
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      code,
      name,
      branch_type = 'branch',
      owner_id,
      parent_branch_id,
      settings,
      finance,
      domains
    } = body;

    // Validate required fields
    if (!code || !name) {
      return NextResponse.json(
        { error: 'Code and name are required' },
        { status: 400 }
      );
    }

    // Check if code already exists
    const { data: existing } = await supabase
      .from('branches')
      .select('id')
      .eq('code', code)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Branch code already exists' },
        { status: 400 }
      );
    }

    // Create branch
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .insert({
        code,
        name,
        branch_type,
        owner_id,
        parent_branch_id,
        is_master: branch_type === 'master',
      })
      .select()
      .single();

    if (branchError) {
      return NextResponse.json({ error: branchError.message }, { status: 500 });
    }

    // Create branch settings
    if (settings || true) {
      await supabase.from('branch_settings').insert({
        branch_id: branch.id,
        site_name: settings?.site_name || name,
        logo_url: settings?.logo_url,
        primary_color: settings?.primary_color || '#f59e0b',
        secondary_color: settings?.secondary_color || '#1f2937',
        line_id: settings?.line_id,
        support_phone: settings?.support_phone,
      });
    }

    // Create branch finance
    await supabase.from('branch_finance').insert({
      branch_id: branch.id,
      credit_limit: finance?.credit_limit || 0,
      revenue_share_percent: finance?.revenue_share_percent || 0,
      monthly_fee: finance?.monthly_fee || 0,
      system_fee_percent: finance?.system_fee_percent || 5,
    });

    // Create domains if provided
    if (domains && domains.length > 0) {
      const domainInserts = domains.map((d: { domain: string; domain_type?: string; is_primary?: boolean }) => ({
        branch_id: branch.id,
        domain: d.domain,
        domain_type: d.domain_type || 'subdomain',
        is_primary: d.is_primary || false,
      }));
      await supabase.from('branch_domains').insert(domainInserts);
    }

    return NextResponse.json({ branch, success: true });
  } catch (error) {
    console.error('Error creating branch:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
