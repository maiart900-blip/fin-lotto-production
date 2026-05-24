import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET - Get tenant payment settings
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('tenant_payment_settings')
      .select('*')
      .eq('tenant_id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    // Return default settings if not found
    if (!data) {
      return NextResponse.json({
        tenant_id: id,
        use_master_gateway: true,
        deposit_fee_percent: 1.5,
        withdraw_fee_percent: 1.0,
        min_deposit: 100,
        max_deposit: 50000,
        min_withdraw: 100,
        max_withdraw: 50000,
        auto_approve_deposit: true,
        auto_approve_withdraw: false,
        is_active: true,
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Get tenant payment error:', err);
    return NextResponse.json({ error: 'ไม่สามารถโหลดการตั้งค่าได้' }, { status: 500 });
  }
}

// POST - Create/Update tenant payment settings
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();

    const settings = {
      tenant_id: id,
      use_master_gateway: body.use_master_gateway ?? true,
      deposit_fee_percent: body.deposit_fee_percent ?? 1.5,
      withdraw_fee_percent: body.withdraw_fee_percent ?? 1.0,
      min_deposit: body.min_deposit ?? 100,
      max_deposit: body.max_deposit ?? 50000,
      min_withdraw: body.min_withdraw ?? 100,
      max_withdraw: body.max_withdraw ?? 50000,
      auto_approve_deposit: body.auto_approve_deposit ?? true,
      auto_approve_withdraw: body.auto_approve_withdraw ?? false,
      is_active: body.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('tenant_payment_settings')
      .upsert(settings, { onConflict: 'tenant_id' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error('Update tenant payment error:', err);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกการตั้งค่าได้' }, { status: 500 });
  }
}
