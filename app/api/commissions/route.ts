import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  let query = supabase
    .from('commissions')
    .select(`
      *,
      referral:referrals!referral_id(
        id,
        referrer_id,
        commission_percent,
        referrer:users!referrer_id(id, username, display_name),
        customer:customers!referred_customer_id(id, name)
      ),
      entry:entries!entry_id(id, number, bet_type, amount)
    `)
    .order('created_at', { ascending: false });

  if (userId) {
    // Filter by referrer
    const { data: referrals } = await supabase
      .from('referrals')
      .select('id')
      .eq('referrer_id', userId);
    
    if (referrals && referrals.length > 0) {
      const referralIds = referrals.map(r => r.id);
      query = query.in('referral_id', referralIds);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('[v0] Commissions GET error:', error.message);
    return NextResponse.json([]);
  }

  return NextResponse.json(data || []);
}

// Calculate commission for an entry
export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  
  // Get entry details
  const { data: entry } = await supabase
    .from('entries')
    .select('id, amount, customer_id')
    .eq('id', body.entryId)
    .single();

  if (!entry || !entry.customer_id) {
    return NextResponse.json({ error: 'Entry not found or no customer' }, { status: 400 });
  }

  // Check if customer has a referrer
  const { data: referral } = await supabase
    .from('referrals')
    .select('id, commission_percent')
    .eq('referred_customer_id', entry.customer_id)
    .single();

  if (!referral) {
    return NextResponse.json({ error: 'No referral for this customer' }, { status: 400 });
  }

  // Calculate commission
  const commissionAmount = (entry.amount * Number(referral.commission_percent)) / 100;

  const { data, error } = await supabase
    .from('commissions')
    .insert({
      referral_id: referral.id,
      entry_id: entry.id,
      amount: entry.amount,
      commission_amount: commissionAmount,
    })
    .select()
    .single();

  if (error) {
    // If duplicate, just return success
    if (error.code === '23505') {
      return NextResponse.json({ message: 'Commission already calculated' });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
