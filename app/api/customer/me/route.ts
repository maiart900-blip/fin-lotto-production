import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripSensitiveFields } from '@/lib/api-serializers';

/**
 * Customer self-service API - returns own profile data
 * Uses stripSensitiveFields to remove password_hash while keeping all self-access fields
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const customerId = cookieStore.get('customer_id')?.value;

    if (!customerId) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }

    const supabase = await createClient();
    
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Strip sensitive fields but return full self-access data
    return NextResponse.json(stripSensitiveFields(customer));
  } catch (error) {
    console.error('Error fetching customer:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const customerId = cookieStore.get('customer_id')?.value;

    if (!customerId) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }

    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('customers')
      .update({
        name: body.name,
        bank_code: body.bank_code,
        bank_account_number: body.bank_account_number,
        bank_account_name: body.bank_account_name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return only safe fields for self-update response
    return NextResponse.json({
      success: true,
      message: 'Profile updated',
      updated_fields: ['name', 'bank_code', 'bank_account_number', 'bank_account_name'],
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
