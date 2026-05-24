import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const customerId = searchParams.get('customer_id');
    const type = searchParams.get('type');

    let query = supabase
      .from('credit_transactions')
      .select(`
        *,
        customer:customers(id, name, phone),
        creator:users!credit_transactions_created_by_fkey(id, display_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[v0] Credit transactions fetch error:', error);
      // Return empty array on error
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[v0] Credit transactions GET error:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { customer_id, type, amount, note, created_by } = body;

    if (!customer_id || !type || amount === undefined) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    // Get customer current balance (database uses credit_balance column)
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, credit_balance')
      .eq('id', customer_id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลลูกค้า' },
        { status: 404 }
      );
    }

    const currentBalance = Number(customer.credit_balance || 0);
    const newBalance = currentBalance + Number(amount);

    if (newBalance < 0) {
      return NextResponse.json(
        { error: 'ยอดเครดิตไม่เพียงพอ' },
        { status: 400 }
      );
    }

    // Create transaction record
    const { data: transaction, error: txError } = await supabase
      .from('credit_transactions')
      .insert({
        customer_id,
        type,
        amount: Number(amount),
        balance_before: currentBalance,
        balance_after: newBalance,
        note,
        created_by,
      })
      .select()
      .single();

    if (txError) {
      console.error('[v0] Credit transaction insert error:', txError);
      return NextResponse.json(
        { error: 'ไม่สามารถบันทึกรายการได้' },
        { status: 500 }
      );
    }

    // Update customer balance (database uses credit_balance column)
    const { error: updateError } = await supabase
      .from('customers')
      .update({ credit_balance: newBalance })
      .eq('id', customer_id);

    if (updateError) {
      console.error('Customer balance update error:', updateError);
      // Don't fail the request, transaction was already created
    }

    return NextResponse.json({
      success: true,
      transaction,
      balance_before: currentBalance,
      balance_after: newBalance,
    });
  } catch (error) {
    console.error('Credit transactions POST error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการปรับยอดเครดิต' },
      { status: 500 }
    );
  }
}
