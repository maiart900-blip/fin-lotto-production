import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
    }

    // Get customer data
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, referral_code')
      .eq('id', customerId)
      .single();

    if (customerError) {
      return NextResponse.json({ 
        referral_code: customerId.slice(0, 8).toUpperCase(),
        referral_count: 0,
        total_commission: 0,
      });
    }

    // Get referral count
    const { count: referralCount } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('referred_by', customerId);

    // Get total commission
    const { data: commissions } = await supabase
      .from('commission_transactions')
      .select('amount')
      .eq('customer_id', customerId);

    const totalCommission = commissions?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

    return NextResponse.json({
      referral_code: customer?.referral_code || customerId.slice(0, 8).toUpperCase(),
      referral_count: referralCount || 0,
      total_commission: totalCommission,
    });
  } catch (error) {
    console.error('Error fetching referral data:', error);
    return NextResponse.json({ 
      referral_code: 'ERROR',
      referral_count: 0,
      total_commission: 0,
    });
  }
}
