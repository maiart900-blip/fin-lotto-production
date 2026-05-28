import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const customerId = cookieStore.get('customer_id')?.value;
    
    if (!customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('topup_requests')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) {
      console.error('[v0] Customer topup GET error:', error.message);
      return NextResponse.json([]);
    }
    
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('[v0] Customer topup GET exception:', err);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const customerId = cookieStore.get('customer_id')?.value;
    
    if (!customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { amount, bank_name, slip_url, payment_account_id } = body;
    
    // Validation
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'กรุณากรอกจำนวนเงินที่ถูกต้อง' },
        { status: 400 }
      );
    }
    
    if (!slip_url) {
      return NextResponse.json(
        { error: 'กรุณาแนบสลิปการโอนเงิน' },
        { status: 400 }
      );
    }
    
    if (!payment_account_id) {
      return NextResponse.json(
        { error: 'กรุณาเลือกบัญชีรับเงิน' },
        { status: 400 }
      );
    }
    
    if (amount < 1) {
      return NextResponse.json(
        { error: 'ยอดเติมขั้นต่ำ 1 บาท' },
        { status: 400 }
      );
    }
    
    const supabase = await createClient();
    
    // Generate slip hash for duplicate detection
    let slipHash: string | null = null;
    try {
      // Generate hash from slip URL
      const hash = crypto.createHash('sha256').update(slip_url).digest('hex').slice(0, 32);
      slipHash = `slip_${hash}`;
      
      // Check for duplicate slip in slip_hashes table
      const { data: existingSlip } = await supabase
        .from('slip_hashes')
        .select('id, topup_request_id')
        .eq('hash', slipHash)
        .maybeSingle();
      
      if (existingSlip) {
        return NextResponse.json(
          { error: 'สลิปนี้เคยใช้แจ้งเติมเงินแล้ว กรุณาใช้สลิปใหม่' },
          { status: 400 }
        );
      }
    } catch (hashErr) {
      console.error('[v0] Slip hash generation error:', hashErr);
      // Continue without hash - don't block the transaction
    }
    
    // Get customer info
    const { data: customer } = await supabase
      .from('customers')
      .select('name, phone')
      .eq('id', customerId)
      .single();
    
    // Check for pending requests
    const { data: pendingRequests } = await supabase
      .from('topup_requests')
      .select('id')
      .eq('customer_id', customerId)
      .eq('status', 'pending');
    
    if (pendingRequests && pendingRequests.length >= 5) {
      return NextResponse.json(
        { error: 'คุณมีคำขอรอดำเนินการครบ 5 รายการแล้ว กรุณารอการอนุมัติก่อน' },
        { status: 400 }
      );
    }
    
    const { data, error } = await supabase
      .from('topup_requests')
      .insert({
        customer_id: customerId,
        customer_name: customer?.name || null,
        customer_phone: customer?.phone || null,
        amount,
        bank_name: bank_name || 'unknown',
        payment_account_id,
        slip_image_url: slip_url,
        slip_hash: slipHash,
        status: 'pending',
      })
      .select()
      .single();
    
    // Store slip hash for future duplicate detection
    if (slipHash && data?.id) {
      await supabase
        .from('slip_hashes')
        .insert({
          hash: slipHash,
          topup_request_id: data.id,
          image_url: slip_url,
        })
        .select()
        .single();
    }
    
    if (error) {
      console.error('[v0] Customer topup POST error:', error.message);
      return NextResponse.json(
        { error: 'ไม่สามารถสร้างคำขอเติมเงินได้' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data);
  } catch (err) {
    console.error('[v0] Customer topup POST exception:', err);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
