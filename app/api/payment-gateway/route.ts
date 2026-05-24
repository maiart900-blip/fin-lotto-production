import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - ดึงการตั้งค่า Payment Gateway
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: settings, error } = await supabase
      .from('payment_gateway_configs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      // ถ้าตารางยังไม่มี ให้ return array ว่าง
      if (error.code === '42P01') {
        return NextResponse.json([]);
      }
      throw error;
    }

    return NextResponse.json(settings || []);
  } catch (error) {
    console.error('Error fetching payment gateway settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// POST - เพิ่มการตั้งค่า Payment Gateway ใหม่
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      provider,
      name,
      api_key,
      secret_key,
      merchant_id,
      promptpay_id,
      callback_url,
      auto_deposit,
      auto_withdraw,
      auto_withdraw_limit,
      daily_limit,
      min_deposit,
      max_deposit,
      min_withdraw,
      max_withdraw,
    } = body;

    const { data, error } = await supabase
      .from('payment_gateway_configs')
      .insert({
        provider,
        name,
        api_key,
        secret_key,
        merchant_id,
        promptpay_id,
        callback_url,
        auto_deposit: auto_deposit ?? true,
        auto_withdraw: auto_withdraw ?? false,
        auto_withdraw_limit: auto_withdraw_limit ?? 5000,
        daily_limit: daily_limit ?? 100000,
        min_deposit: min_deposit ?? 100,
        max_deposit: max_deposit ?? 50000,
        min_withdraw: min_withdraw ?? 100,
        max_withdraw: max_withdraw ?? 50000,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating payment gateway settings:', error);
    return NextResponse.json({ error: 'Failed to create settings' }, { status: 500 });
  }
}

// PUT - อัพเดทการตั้งค่า Payment Gateway
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('payment_gateway_configs')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating payment gateway settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

// DELETE - ลบการตั้งค่า Payment Gateway
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('payment_gateway_configs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment gateway settings:', error);
    return NextResponse.json({ error: 'Failed to delete settings' }, { status: 500 });
  }
}
