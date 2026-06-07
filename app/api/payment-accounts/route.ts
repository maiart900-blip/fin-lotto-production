import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');
    const accountType = searchParams.get('account_type') || 'deposit';
    const includeDeleted = searchParams.get('include_deleted') === 'true';
    
    const supabase = await createClient();
    let query = supabase
      .from('payment_accounts')
      .select('*')
      .order('sort_order', { ascending: true });

    // Filter by tenant if specified
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    
    // Filter by account type
    if (accountType) {
      query = query.eq('account_type', accountType);
    }
    
    // Filter out soft-deleted accounts unless explicitly requested
    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Payment accounts GET error:', error.message);
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Payment accounts GET exception:', err);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      account_name, 
      bank_name, 
      account_number, 
      promptpay_number, 
      qr_image_url, 
      note, 
      is_active, 
      is_qr_only,
      merchant_id,
      phone_number,
      qr_mode,
      gateway_provider,
      display_mode,
      tenant_id,
      account_type
    } = body;

    // Validation แยกตาม qr_mode
    if (!account_name) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อบัญชี/ร้านค้า' }, { status: 400 });
    }

    const mode = qr_mode || 'upload';

    if (mode === 'upload') {
      // Upload mode - ต้องการแค่ชื่อ + QR เท่านั้น (ไม่บังคับเลขบัญชี/พร้อมเพย์)
      if (!qr_image_url) {
        return NextResponse.json({ error: 'กรุณาใส่ URL รูป QR Code' }, { status: 400 });
      }
      // เลขบัญชี, พร้อมเพย์, Merchant ID เป็น optional ทั้งหมด
    } else if (mode === 'merchant_id') {
      // Merchant ID mode - ต้องมี Merchant ID
      if (!merchant_id) {
        return NextResponse.json({ error: 'กรุณากรอก Merchant ID' }, { status: 400 });
      }
    } else if (mode === 'promptpay') {
      // PromptPay mode - ต้องมีเบอร์โทรหรือเลขบัตรประชาชน
      if (!promptpay_number && !phone_number) {
        return NextResponse.json({ error: 'กรุณากรอกเบอร์โทรหรือเลขบัตรประชาชนสำหรับ PromptPay' }, { status: 400 });
      }
    }

    const supabase = await createClient();

    // Get max sort_order
    const { data: maxOrder } = await supabase
      .from('payment_accounts')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const newSortOrder = (maxOrder?.sort_order || 0) + 1;

    const { data, error } = await supabase
      .from('payment_accounts')
      .insert({
        account_name,
        bank_name: bank_name || (mode === 'promptpay' ? 'promptpay' : 'scb'),
        account_number: account_number || null,
        promptpay_number: promptpay_number || phone_number || null,
        qr_image_url: qr_image_url || null,
        note: note || null,
        is_active: is_active ?? true,
        is_qr_only: is_qr_only ?? (mode !== 'upload'),
        merchant_id: merchant_id || null,
        phone_number: phone_number || null,
        qr_mode: mode,
        gateway_provider: gateway_provider || null,
        display_mode: display_mode || (mode === 'upload' && !account_number ? 'qr_only' : 'qr_with_bank'),
        sort_order: newSortOrder,
        tenant_id: tenant_id || null,
        account_type: account_type || 'deposit',
      })
      .select()
      .single();

    if (error) {
      console.error('Payment accounts POST error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Payment accounts POST exception:', err);
    return NextResponse.json({ error: 'Failed to create payment account' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { 
      id, 
      account_name, 
      bank_name, 
      account_number, 
      promptpay_number, 
      qr_image_url, 
      note, 
      is_active, 
      is_qr_only, 
      sort_order,
      merchant_id,
      phone_number,
      qr_mode,
      gateway_provider,
      display_mode
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const updateData: Record<string, unknown> = {};
    if (account_name !== undefined) updateData.account_name = account_name;
    if (bank_name !== undefined) updateData.bank_name = bank_name;
    if (account_number !== undefined) updateData.account_number = account_number || null;
    if (promptpay_number !== undefined) updateData.promptpay_number = promptpay_number || null;
    if (qr_image_url !== undefined) updateData.qr_image_url = qr_image_url || null;
    if (note !== undefined) updateData.note = note || null;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (is_qr_only !== undefined) updateData.is_qr_only = is_qr_only;
    if (sort_order !== undefined) updateData.sort_order = sort_order;
    if (merchant_id !== undefined) updateData.merchant_id = merchant_id || null;
    if (phone_number !== undefined) updateData.phone_number = phone_number || null;
    if (qr_mode !== undefined) updateData.qr_mode = qr_mode;
    if (gateway_provider !== undefined) updateData.gateway_provider = gateway_provider || null;
    if (display_mode !== undefined) updateData.display_mode = display_mode;

    const { data, error } = await supabase
      .from('payment_accounts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Payment accounts PUT error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Payment accounts PUT exception:', err);
    return NextResponse.json({ error: 'Failed to update payment account' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // SOFT DELETE: Instead of deleting, mark as deleted
    // This preserves foreign key relationships with topup_requests
    const { data, error } = await supabase
      .from('payment_accounts')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Payment accounts SOFT DELETE error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'บัญชีถูกปิดใช้งานเรียบร้อย (Soft Delete)' });
  } catch (err) {
    console.error('Payment accounts DELETE exception:', err);
    return NextResponse.json({ error: 'Failed to delete payment account' }, { status: 500 });
  }
}
