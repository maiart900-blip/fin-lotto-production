import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET - Get tenant details with full stats
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select(`
        *,
        tenant_stats (
          total_bets,
          total_payouts,
          total_deposits,
          total_withdrawals,
          profit_loss,
          active_users,
          new_users,
          stat_date
        ),
        tenant_alerts (
          id,
          alert_type,
          title,
          message,
          is_read,
          created_at
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Get users for this tenant
    const { data: users, count } = await supabase
      .from('users')
      .select('id, username, display_name, role, credit_balance, is_active, created_at', { count: 'exact' })
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .limit(100);

    return NextResponse.json({
      ...tenant,
      users: users || [],
      user_count: count || 0
    });
  } catch (err) {
    console.error('Get tenant error:', err);
    return NextResponse.json({ error: 'ไม่พบข้อมูลเว็บลูก' }, { status: 404 });
  }
}

// PUT - Update tenant
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      domain,
      is_active,
      sync_payout_rates,
      sync_blocked_numbers,
      sync_lottery_status,
      theme_config
    } = body;

    const supabase = await createClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) updateData.name = name;
    if (domain !== undefined) updateData.domain = domain;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (sync_payout_rates !== undefined) updateData.sync_payout_rates = sync_payout_rates;
    if (sync_blocked_numbers !== undefined) updateData.sync_blocked_numbers = sync_blocked_numbers;
    if (sync_lottery_status !== undefined) updateData.sync_lottery_status = sync_lottery_status;
    if (theme_config !== undefined) updateData.theme_config = theme_config;

    const { data: tenant, error } = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(tenant);
  } catch (err) {
    console.error('Update tenant error:', err);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตเว็บลูกได้' }, { status: 500 });
  }
}

// DELETE - Delete tenant (soft delete by setting is_active = false)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check if it's master tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('is_master')
      .eq('id', id)
      .single();

    if (tenant?.is_master) {
      return NextResponse.json(
        { error: 'ไม่สามารถลบเว็บแม่ได้' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('tenants')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete tenant error:', err);
    return NextResponse.json({ error: 'ไม่สามารถลบเว็บลูกได้' }, { status: 500 });
  }
}
