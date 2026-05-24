import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

// GET - ดึงข้อมูลสาขาเดียว
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth guard - require admin
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const { id } = await params;

    const { data, error } = await supabase
      .from('branches')
      .select(`
        *,
        branch_settings (*),
        branch_finance (*),
        branch_domains (*),
        branch_commissions (*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    return NextResponse.json({ branch: data });
  } catch (error) {
    console.error('Error fetching branch:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - อัปเดตสาขา
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();

    const { name, branch_type, is_active, settings, finance, domains } = body;

    // Update branch
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (branch_type !== undefined) updateData.branch_type = branch_type;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (branchError) {
      return NextResponse.json({ error: branchError.message }, { status: 500 });
    }

    // Update settings if provided
    if (settings) {
      await supabase
        .from('branch_settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString(),
        })
        .eq('branch_id', id);
    }

    // Update finance if provided
    if (finance) {
      await supabase
        .from('branch_finance')
        .update({
          ...finance,
          updated_at: new Date().toISOString(),
        })
        .eq('branch_id', id);
    }

    // Update domains if provided
    if (domains) {
      // Delete existing domains
      await supabase.from('branch_domains').delete().eq('branch_id', id);
      
      // Insert new domains
      if (domains.length > 0) {
        const domainInserts = domains.map((d: { domain: string; domain_type?: string; is_primary?: boolean }) => ({
          branch_id: id,
          domain: d.domain,
          domain_type: d.domain_type || 'subdomain',
          is_primary: d.is_primary || false,
        }));
        await supabase.from('branch_domains').insert(domainInserts);
      }
    }

    return NextResponse.json({ branch, success: true });
  } catch (error) {
    console.error('Error updating branch:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - ลบสาขา
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Check if branch is master
    const { data: branch } = await supabase
      .from('branches')
      .select('is_master')
      .eq('id', id)
      .single();

    if (branch?.is_master) {
      return NextResponse.json(
        { error: 'Cannot delete master branch' },
        { status: 400 }
      );
    }

    // Delete branch (cascade will delete related records)
    const { error } = await supabase.from('branches').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting branch:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
