import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Unified Slip Verification API
// รองรับทั้ง EasySlip และ SlipOK

interface SlipVerificationResult {
  success: boolean;
  provider?: string;
  data?: {
    transRef: string;
    amount: number;
    datetime: string;
    sender: {
      name: string;
      bank: string;
      accountNumber?: string;
    };
    receiver: {
      name: string;
      bank: string;
      accountNumber?: string;
    };
  };
  error?: string;
  message?: string;
  duplicate?: {
    id: string;
    amount: number;
    created_at: string;
  };
}

// POST - ตรวจสอบสลิปอัตโนมัติ (เลือก provider ที่ตั้งค่าไว้)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const base64Image = formData.get('base64') as string | null;
    const slipUploadId = formData.get('slip_upload_id') as string | null;
    const preferredProvider = formData.get('provider') as string | null;
    
    // Check available providers
    const easySlipKey = process.env.EASYSLIP_API_KEY;
    const slipOKBranchId = process.env.SLIPOK_BRANCH_ID;
    const slipOKApiKey = process.env.SLIPOK_API_KEY;
    
    const easySlipAvailable = !!easySlipKey;
    const slipOKAvailable = !!(slipOKBranchId && slipOKApiKey);
    
    if (!easySlipAvailable && !slipOKAvailable) {
      return NextResponse.json({
        success: false,
        error: 'NO_PROVIDER_CONFIGURED',
        message: 'ยังไม่ได้ตั้งค่า Slip Verification API (EasySlip หรือ SlipOK)',
        providers: {
          easyslip: { configured: false },
          slipok: { configured: false },
        },
      }, { status: 400 });
    }
    
    if (!file && !base64Image) {
      return NextResponse.json({
        success: false,
        error: 'NO_IMAGE',
        message: 'กรุณาอัปโหลดรูปสลิป',
      }, { status: 400 });
    }
    
    // Determine which provider to use
    let provider = preferredProvider;
    if (!provider) {
      // Priority: EasySlip > SlipOK
      provider = easySlipAvailable ? 'easyslip' : 'slipok';
    }
    
    // Validate provider availability
    if (provider === 'easyslip' && !easySlipAvailable) {
      provider = slipOKAvailable ? 'slipok' : null;
    } else if (provider === 'slipok' && !slipOKAvailable) {
      provider = easySlipAvailable ? 'easyslip' : null;
    }
    
    if (!provider) {
      return NextResponse.json({
        success: false,
        error: 'PROVIDER_NOT_AVAILABLE',
        message: 'Provider ที่เลือกไม่พร้อมใช้งาน',
      }, { status: 400 });
    }
    
    // Forward to specific provider
    const baseUrl = request.nextUrl.origin;
    const providerUrl = `${baseUrl}/api/slip-verify/${provider}`;
    
    const providerFormData = new FormData();
    if (file) {
      providerFormData.append('file', file);
    } else if (base64Image) {
      providerFormData.append('base64', base64Image);
    }
    if (slipUploadId) {
      providerFormData.append('slip_upload_id', slipUploadId);
    }
    
    const response = await fetch(providerUrl, {
      method: 'POST',
      body: providerFormData,
    });
    
    const result: SlipVerificationResult = await response.json();
    
    // Add provider info to response
    return NextResponse.json({
      ...result,
      provider,
    });
    
  } catch (error) {
    console.error('[Unified Slip Verify] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'เกิดข้อผิดพลาดในการตรวจสอบสลิป',
    }, { status: 500 });
  }
}

// GET - ตรวจสอบสถานะ providers ทั้งหมด
export async function GET() {
  const easySlipKey = process.env.EASYSLIP_API_KEY;
  const slipOKBranchId = process.env.SLIPOK_BRANCH_ID;
  const slipOKApiKey = process.env.SLIPOK_API_KEY;
  
  const easySlipAvailable = !!easySlipKey;
  const slipOKAvailable = !!(slipOKBranchId && slipOKApiKey);
  
  return NextResponse.json({
    configured: easySlipAvailable || slipOKAvailable,
    defaultProvider: easySlipAvailable ? 'easyslip' : (slipOKAvailable ? 'slipok' : null),
    providers: {
      easyslip: {
        configured: easySlipAvailable,
        status: easySlipAvailable ? 'ready' : 'not_configured',
        apiKeyPreview: easySlipKey ? `${easySlipKey.slice(0, 8)}...` : null,
      },
      slipok: {
        configured: slipOKAvailable,
        status: slipOKAvailable ? 'ready' : 'not_configured',
        branchIdPreview: slipOKBranchId ? `${slipOKBranchId.slice(0, 4)}...` : null,
      },
    },
    message: easySlipAvailable || slipOKAvailable 
      ? 'ระบบตรวจสลิปพร้อมใช้งาน'
      : 'กรุณาตั้งค่า EASYSLIP_API_KEY หรือ SLIPOK_BRANCH_ID + SLIPOK_API_KEY',
  });
}
