import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// Generate hash from slip image URL for duplicate detection
function generateSlipHash(slipUrl: string, amount?: number): string {
  const data = `${slipUrl}-${amount || 'unknown'}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
}

// POST - Verify slip and check for duplicates
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { slip_url, amount, topup_request_id } = body;
    
    if (!slip_url) {
      return NextResponse.json({ error: 'Missing slip URL' }, { status: 400 });
    }
    
    // Generate hash for duplicate detection
    const slipHash = generateSlipHash(slip_url, amount);
    
    // Check if this slip hash already exists
    const { data: existingHash } = await supabase
      .from('slip_hashes')
      .select('*, topup_requests(*)')
      .eq('hash', slipHash)
      .single();
    
    if (existingHash) {
      return NextResponse.json({
        is_duplicate: true,
        message: 'สลิปนี้เคยถูกใช้งานแล้ว',
        original_request: existingHash.topup_request_id,
        original_date: existingHash.created_at,
      });
    }
    
    // If topup_request_id provided, save the hash
    if (topup_request_id) {
      await supabase
        .from('slip_hashes')
        .insert({
          hash: slipHash,
          topup_request_id,
        });
      
      // Update topup request with hash
      await supabase
        .from('topup_requests')
        .update({ slip_hash: slipHash })
        .eq('id', topup_request_id);
    }
    
    return NextResponse.json({
      is_duplicate: false,
      hash: slipHash,
      message: 'สลิปนี้ยังไม่เคยถูกใช้งาน',
    });
  } catch (error) {
    console.error('Error verifying slip:', error);
    return NextResponse.json({ error: 'Failed to verify slip' }, { status: 500 });
  }
}

// GET - Get slip verification history
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get('hash');
    
    if (hash) {
      const { data, error } = await supabase
        .from('slip_hashes')
        .select('*, topup_requests(*, customers(name, phone))')
        .eq('hash', hash)
        .single();
      
      if (error) throw error;
      return NextResponse.json(data);
    }
    
    // Return recent slip hashes
    const { data, error } = await supabase
      .from('slip_hashes')
      .select('*, topup_requests(amount, status, customers(name))')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching slip history:', error);
    return NextResponse.json({ error: 'Failed to fetch slip history' }, { status: 500 });
  }
}
