import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { serializePublicCustomer, type PublicCustomerResponse } from '@/lib/api-serializers';

/**
 * Customer self-service API - returns own profile data
 * Uses PUBLIC serializer because this is customer-facing
 * Additional fields (balance, bank) are explicitly added for self-access
 */
interface CustomerMeResponse extends PublicCustomerResponse {
  phone: string | null;
  credit_balance: number;
  is_active: boolean;
  referral_code: string | null;
  bank_code: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  created_at: string;
  total_bets: number | null;
}

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
      .select('id, name, phone, username, credit_balance, is_active, referral_code, bank_code, bank_account_number, bank_account_name, created_at, total_bets')
      .eq('id', customerId)
      .single();

    if (error || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Return serialized response with self-access fields
    // Uses public serializer base + additional fields for self-view
    const response: CustomerMeResponse = {
      ...serializePublicCustomer(customer),
      phone: customer.phone,
      credit_balance: customer.credit_balance,
      is_active: customer.is_active,
      referral_code: customer.referral_code,
      bank_code: customer.bank_code,
      bank_account_number: customer.bank_account_number,
      bank_account_name: customer.bank_account_name,
      created_at: customer.created_at,
      total_bets: customer.total_bets,
    };

    return NextResponse.json(response);
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
