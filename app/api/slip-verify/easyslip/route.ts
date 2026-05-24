import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// EasySlip API Integration
// https://developer.easyslip.com/

interface EasySlipResponse {
  success: boolean;
  data?: {
    transRef: string;
    date: string;
    time: string;
    amount: number;
    sender: {
      bank: {
        id: string;
        name: string;
        short: string;
      };
      account: {
        name: {
          th: string;
          en: string;
        };
        bank: {
          type: string;
          account: string;
        };
      };
    };
    receiver: {
      bank: {
        id: string;
        name: string;
        short: string;
      };
      account: {
        name: {
          th: string;
          en: string;
        };
        bank: {
          type: string;
          account: string;
        };
      };
    };
    ref1?: string;
    ref2?: string;
    ref3?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

// POST - ตรวจสอบสลิปผ่าน EasySlip API
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const base64Image = formData.get('base64') as string | null;
    const slipUploadId = formData.get('slip_upload_id') as string | null;
    
    const apiKey = process.env.EASYSLIP_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'EASYSLIP_API_KEY not configured',
        message: 'กรุณาตั้งค่า EASYSLIP_API_KEY ใน Environment Variables',
      }, { status: 400 });
    }
    
    if (!file && !base64Image) {
      return NextResponse.json({
        success: false,
        error: 'No image provided',
        message: 'กรุณาอัปโหลดรูปสลิป',
      }, { status: 400 });
    }
    
    // Prepare form data for EasySlip API
    const easySlipFormData = new FormData();
    
    if (file) {
      easySlipFormData.append('file', file);
    } else if (base64Image) {
      // Convert base64 to blob
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const blob = new Blob([buffer], { type: 'image/png' });
      easySlipFormData.append('file', blob, 'slip.png');
    }
    
    // Call EasySlip API
    const response = await fetch('https://developer.easyslip.com/api/v1/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: easySlipFormData,
    });
    
    const result: EasySlipResponse = await response.json();
    
    if (!result.success || !result.data) {
      // Log failed verification
      if (slipUploadId) {
        await supabase
          .from('slip_uploads')
          .update({
            has_error: true,
            reject_reason: result.error?.message || 'ไม่สามารถตรวจสอบสลิปได้',
            updated_at: new Date().toISOString(),
          })
          .eq('id', slipUploadId);
      }
      
      return NextResponse.json({
        success: false,
        error: result.error?.code || 'VERIFICATION_FAILED',
        message: result.error?.message || 'ไม่สามารถตรวจสอบสลิปได้',
      });
    }
    
    const slipData = result.data;
    
    // Check for duplicate slip using transRef
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
    const slipDateTime = new Date(`${slipData.date}T${slipData.time}`);
    
    // Update slip_uploads with verified data
    if (slipUploadId) {
      await supabase
        .from('slip_uploads')
        .update({
          slip_hash: slipData.transRef,
          detected_amount: slipData.amount,
          detected_datetime: slipDateTime.toISOString(),
          detected_sender_name: slipData.sender.account.name.th || slipData.sender.account.name.en,
          bank_name: slipData.sender.bank.name,
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
          name: slipData.sender.account.name.th || slipData.sender.account.name.en,
          bank: slipData.sender.bank.name,
          accountNumber: slipData.sender.account.bank.account,
        },
        receiver: {
          name: slipData.receiver.account.name.th || slipData.receiver.account.name.en,
          bank: slipData.receiver.bank.name,
          accountNumber: slipData.receiver.account.bank.account,
        },
      },
    });
    
  } catch (error) {
    console.error('[EasySlip API] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'เกิดข้อผิดพลาดในการตรวจสอบสลิป',
    }, { status: 500 });
  }
}

// GET - ตรวจสอบสถานะ API
export async function GET() {
  const apiKey = process.env.EASYSLIP_API_KEY;
  
  return NextResponse.json({
    configured: !!apiKey,
    provider: 'EasySlip',
    status: apiKey ? 'ready' : 'not_configured',
    message: apiKey 
      ? 'EasySlip API พร้อมใช้งาน' 
      : 'กรุณาตั้งค่า EASYSLIP_API_KEY',
    apiKeyPreview: apiKey ? `${apiKey.slice(0, 8)}...` : null,
  });
}
