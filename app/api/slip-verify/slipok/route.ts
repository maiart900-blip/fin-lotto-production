import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// SlipOK API Integration
// https://slipok.com/

interface SlipOKResponse {
  success: boolean;
  data?: {
    transRef: string;
    transDate: string;
    transTime: string;
    amount: number;
    sendingBank: string;
    senderAccount: string;
    senderName: string;
    receivingBank: string;
    receiverAccount: string;
    receiverName: string;
  };
  error?: string;
  message?: string;
}

// POST - ตรวจสอบสลิปผ่าน SlipOK API
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const base64Image = formData.get('base64') as string | null;
    const slipUploadId = formData.get('slip_upload_id') as string | null;
    
    const branchId = process.env.SLIPOK_BRANCH_ID;
    const apiKey = process.env.SLIPOK_API_KEY;
    
    if (!branchId || !apiKey) {
      return NextResponse.json({
        success: false,
        error: 'SLIPOK_NOT_CONFIGURED',
        message: 'กรุณาตั้งค่า SLIPOK_BRANCH_ID และ SLIPOK_API_KEY ใน Environment Variables',
      }, { status: 400 });
    }
    
    if (!file && !base64Image) {
      return NextResponse.json({
        success: false,
        error: 'No image provided',
        message: 'กรุณาอัปโหลดรูปสลิป',
      }, { status: 400 });
    }
    
    // Prepare form data for SlipOK API
    const slipOKFormData = new FormData();
    
    if (file) {
      slipOKFormData.append('files', file);
    } else if (base64Image) {
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const blob = new Blob([buffer], { type: 'image/png' });
      slipOKFormData.append('files', blob, 'slip.png');
    }
    
    // Call SlipOK API
    const response = await fetch(`https://api.slipok.com/api/line/apikey/${branchId}`, {
      method: 'POST',
      headers: {
        'x-authorization': apiKey,
      },
      body: slipOKFormData,
    });
    
    const result: SlipOKResponse = await response.json();
    
    if (!result.success || !result.data) {
      if (slipUploadId) {
        await supabase
          .from('slip_uploads')
          .update({
            has_error: true,
            reject_reason: result.message || result.error || 'ไม่สามารถตรวจสอบสลิปได้',
            updated_at: new Date().toISOString(),
          })
          .eq('id', slipUploadId);
      }
      
      return NextResponse.json({
        success: false,
        error: result.error || 'VERIFICATION_FAILED',
        message: result.message || 'ไม่สามารถตรวจสอบสลิปได้',
      });
    }
    
    const slipData = result.data;
    
    // Check for duplicate slip
    const { data: existingSlip } = await supabase
      .from('slip_uploads')
      .select('id, customer_id, amount, created_at')
      .eq('slip_hash', slipData.transRef)
      .single();
    
    if (existingSlip) {
      return NextResponse.json({
        success: false,
        error: 'DUPLICATE_SLIP',
        message: 'สลิปนี้เคยถูกใช้แล้ว',
        duplicate: {
          id: existingSlip.id,
          amount: existingSlip.amount,
          created_at: existingSlip.created_at,
        },
      });
    }
    
    // Parse datetime
    const slipDateTime = new Date(`${slipData.transDate}T${slipData.transTime}`);
    
    // Update slip_uploads
    if (slipUploadId) {
      await supabase
        .from('slip_uploads')
        .update({
          slip_hash: slipData.transRef,
          detected_amount: slipData.amount,
          detected_datetime: slipDateTime.toISOString(),
          detected_sender_name: slipData.senderName,
          bank_name: slipData.sendingBank,
          has_error: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', slipUploadId);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        transRef: slipData.transRef,
        amount: slipData.amount,
        datetime: slipDateTime.toISOString(),
        sender: {
          name: slipData.senderName,
          bank: slipData.sendingBank,
          accountNumber: slipData.senderAccount,
        },
        receiver: {
          name: slipData.receiverName,
          bank: slipData.receivingBank,
          accountNumber: slipData.receiverAccount,
        },
      },
    });
    
  } catch (error) {
    console.error('[SlipOK API] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'เกิดข้อผิดพลาดในการตรวจสอบสลิป',
    }, { status: 500 });
  }
}

// GET - ตรวจสอบสถานะ API
export async function GET() {
  const branchId = process.env.SLIPOK_BRANCH_ID;
  const apiKey = process.env.SLIPOK_API_KEY;
  const configured = !!(branchId && apiKey);
  
  return NextResponse.json({
    configured,
    provider: 'SlipOK',
    status: configured ? 'ready' : 'not_configured',
    message: configured 
      ? 'SlipOK API พร้อมใช้งาน' 
      : 'กรุณาตั้งค่า SLIPOK_BRANCH_ID และ SLIPOK_API_KEY',
    branchIdPreview: branchId ? `${branchId.slice(0, 4)}...` : null,
  });
}
