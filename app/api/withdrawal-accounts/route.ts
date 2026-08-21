import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');
    
    const supabase = await createClient();
    let query = supabase
      .from('withdrawal_accounts')
      .select('*')
      .order('sort_order', { ascending: true });

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[v0] Withdrawal accounts GET error:', error.message);
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('[v0] Withdrawal accounts GET exception:', err);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      account_name, 
      account_number, 
      bank_name, 
      bank_code,
      branch_name,
      qr_image_url, 
      is_active, 
      is_default,
      min_amount,
      max_amount,
      daily_limit,
      notes,
      tenant_id
    } = body;

    if (!account_name || !account_number || !bank_name) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get max sort_order
    const { data: maxOrder } = await supabase
      .from('withdrawal_accounts')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const newSortOrder = (maxOrder?.sort_order || 0) + 1;

    // If setting as default, unset other defaults
    if (is_default) {
      await supabase
        .from('withdrawal_accounts')
        .update({ is_default: false })
        .eq('tenant_id', tenant_id || null);
    }

    const { data, error } = await supabase
      .from('withdrawal_accounts')
      .insert({
        account_name,
        account_number,
        bank_name,
        bank_code: bank_code || null,
        branch_name: branch_name || null,
        qr_image_url: qr_image_url || null,
        is_active: is_active ?? true,
        is_default: is_default ?? false,
        min_amount: min_amount || 0,
        max_amount: max_amount || 1000000,
        daily_limit: daily_limit || null,
        notes: notes || null,
        tenant_id: tenant_id || null,
        sort_order: newSortOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('[v0] Withdrawal accounts POST error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[v0] Withdrawal accounts POST exception:', err);
    return NextResponse.json({ error: 'Failed to create withdrawal account' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { 
      id, 
      account_name, 
      account_number, 
      bank_name, 
      bank_code,
      branch_name,
      qr_image_url, 
      is_active, 
      is_default,
      min_amount,
      max_amount,
      daily_limit,
      notes,
      sort_order,
      tenant_id
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // If setting as default, unset other defaults
    if (is_default) {
      await supabase
        .from('withdrawal_accounts')
        .update({ is_default: false })
        .neq('id', id);
    }

    const updateData: Record<string, unknown> = {};
    if (account_name !== undefined) updateData.account_name = account_name;
    if (account_number !== undefined) updateData.account_number = account_number;
    if (bank_name !== undefined) updateData.bank_name = bank_name;
    if (bank_code !== undefined) updateData.bank_code = bank_code || null;
    if (branch_name !== undefined) updateData.branch_name = branch_name || null;
    if (qr_image_url !== undefined) updateData.qr_image_url = qr_image_url || null;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (is_default !== undefined) updateData.is_default = is_default;
    if (min_amount !== undefined) updateData.min_amount = min_amount;
    if (max_amount !== undefined) updateData.max_amount = max_amount;
    if (daily_limit !== undefined) updateData.daily_limit = daily_limit;
    if (notes !== undefined) updateData.notes = notes || null;
    if (sort_order !== undefined) updateData.sort_order = sort_order;
    if (tenant_id !== undefined) updateData.tenant_id = tenant_id || null;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('withdrawal_accounts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[v0] Withdrawal accounts PUT error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[v0] Withdrawal accounts PUT exception:', err);
    return NextResponse.json({ error: 'Failed to update withdrawal account' }, { status: 500 });
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

    const { error } = await supabase
      .from('withdrawal_accounts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[v0] Withdrawal accounts DELETE error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[v0] Withdrawal accounts DELETE exception:', err);
    return NextResponse.json({ error: 'Failed to delete withdrawal account' }, { status: 500 });
  }
}
