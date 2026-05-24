import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('referrals')
      .select(`
        *,
        referrer:users!referrer_id(id, username, display_name, referral_code),
        customer:customers!referred_customer_id(id, name, phone)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Referrals GET error:', error.message);
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Referrals GET exception:', err);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  
  // Verify referral code exists
  const { data: referrer } = await supabase
    .from('users')
    .select('id, referral_code')
    .eq('referral_code', body.referralCode.toUpperCase())
    .single();

  if (!referrer) {
    return NextResponse.json({ error: 'รหัสแนะนำไม่ถูกต้อง' }, { status: 400 });
  }

  // Check if customer already has a referrer
  const { data: existingReferral } = await supabase
    .from('referrals')
    .select('id')
    .eq('referred_customer_id', body.customerId)
    .single();

  if (existingReferral) {
    return NextResponse.json({ error: 'ลูกค้านี้มีผู้แนะนำแล้ว' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('referrals')
    .insert({
      referrer_id: referrer.id,
      referred_customer_id: body.customerId,
      referral_code: body.referralCode.toUpperCase(),
      commission_percent: body.commissionPercent || 5,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
