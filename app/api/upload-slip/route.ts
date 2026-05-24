import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { put } from '@vercel/blob';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ 
        error: 'Content-Type ต้องเป็น multipart/form-data' 
      }, { status: 400 });
    }
    
    const supabase = await createClient();
    const formData = await request.formData();
    
    const file = formData.get('file') as File;
    const withdrawId = formData.get('withdraw_id') as string;
    const depositId = formData.get('deposit_id') as string;
    const amount = formData.get('amount') as string;
    const type = formData.get('type') as string;
    const note = formData.get('note') as string;

    if (!file) {
      return NextResponse.json({ error: 'ไม่มีไฟล์' }, { status: 400 });
    }

    // Upload file to Vercel Blob
    const timestamp = Date.now();
    const fileName = `slips/${type || 'general'}/${timestamp}_${file.name}`;
    
    const blob = await put(fileName, file, {
      access: 'private',
      addRandomSuffix: true,
    });

    // If this is a withdraw slip, update the withdraw request
    if (withdrawId) {
      const { error: updateError } = await supabase
        .from('withdraw_requests')
        .update({
          slip_url: blob.pathname,
          updated_at: new Date().toISOString(),
        })
        .eq('id', withdrawId);

      if (updateError) {
        console.error('Update withdraw slip error:', updateError);
      }

      return NextResponse.json({ 
        success: true, 
        url: blob.pathname,
        message: 'อัปโหลดสลิปถอนเงินสำเร็จ'
      });
    }

    // If this is a deposit slip, update the deposit request
    if (depositId) {
      const { error: updateError } = await supabase
        .from('deposit_requests')
        .update({
          slip_url: blob.pathname,
          updated_at: new Date().toISOString(),
        })
        .eq('id', depositId);

      if (updateError) {
        console.error('Update deposit slip error:', updateError);
      }

      return NextResponse.json({ 
        success: true, 
        url: blob.pathname,
        message: 'อัปโหลดสลิปฝากเงินสำเร็จ'
      });
    }

    // General slip upload (for manual records)
    const { data, error } = await supabase
      .from('slip_uploads')
      .insert({
        type: type || 'general',
        amount: amount ? parseFloat(amount) : null,
        status: 'pending',
        slip_url: blob.pathname,
        note: note || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Slip upload record error:', error);
      // Still return success since file was uploaded
      return NextResponse.json({ 
        success: true, 
        url: blob.pathname,
        warning: 'ไฟล์อัปโหลดสำเร็จ แต่ไม่สามารถบันทึกข้อมูลได้'
      });
    }

    return NextResponse.json({ 
      success: true, 
      url: blob.pathname,
      data 
    });
  } catch (err) {
    console.error('Upload slip error:', err);
    const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอัปโหลด';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
