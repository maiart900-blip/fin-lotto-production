import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - List all SCB Maemanee accounts
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: accounts, error } = await supabase
      .from('scb_maemanee_settings')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return NextResponse.json(accounts);
  } catch (error) {
    console.error('Error fetching SCB Maemanee accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

// POST - Create new SCB Maemanee account
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('scb_maemanee_settings')
      .insert({
        shop_name: body.shop_name,
        account_name: body.account_name,
        bank_name: body.bank_name || 'ธนาคารไทยพาณิชย์',
        account_number: body.account_number,
        promptpay_id: body.promptpay_id,
        merchant_id: body.merchant_id,
        phone: body.phone,
        qr_image_url: body.qr_image_url,
        is_active: body.is_active ?? true,
        note: body.note,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating SCB Maemanee account:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}

// PUT - Update SCB Maemanee account
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    if (!body.id) {
      return NextResponse.json({ error: 'Missing account ID' }, { status: 400 });
    }
    
    const updateData: Record<string, unknown> = {};
    if (body.shop_name !== undefined) updateData.shop_name = body.shop_name;
    if (body.account_name !== undefined) updateData.account_name = body.account_name;
    if (body.bank_name !== undefined) updateData.bank_name = body.bank_name;
    if (body.account_number !== undefined) updateData.account_number = body.account_number;
    if (body.promptpay_id !== undefined) updateData.promptpay_id = body.promptpay_id;
    if (body.merchant_id !== undefined) updateData.merchant_id = body.merchant_id;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.qr_image_url !== undefined) updateData.qr_image_url = body.qr_image_url;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.note !== undefined) updateData.note = body.note;
    
    const { data, error } = await supabase
      .from('scb_maemanee_settings')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating SCB Maemanee account:', error);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}

// DELETE - Delete SCB Maemanee account
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Missing account ID' }, { status: 400 });
    }
    
    const { error } = await supabase
      .from('scb_maemanee_settings')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting SCB Maemanee account:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
