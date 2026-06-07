import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const customerId = cookieStore.get('customer_id')?.value;
    
    if (!customerId) {
      return NextResponse.json({ 
        authenticated: false,
        customer: null 
      });
    }
    
    const supabase = await createClient();
    
    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, name, username, phone, credit_balance, referral_code, is_partner, is_active, created_at')
      .eq('id', customerId)
      .single();
    
    if (error || !customer) {
      // Clear invalid cookie
      return NextResponse.json({ 
        authenticated: false,
        customer: null 
      });
    }
    
    return NextResponse.json({
      authenticated: true,
      customer: {
        id: customer.id,
        name: customer.name,
        username: customer.username,
        phone: customer.phone,
        credit_balance: customer.credit_balance,
        referral_code: customer.referral_code,
        is_partner: customer.is_partner,
        is_active: customer.is_active,
        created_at: customer.created_at,
      }
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ 
      authenticated: false,
      customer: null 
    });
  }
}
