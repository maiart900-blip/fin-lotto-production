import { put } from '@vercel/blob';
import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // ตรวจสอบ auth จาก cookie (ระบบลูกค้าใช้ cookie ไม่ใช่ Supabase Auth)
    const cookieStore = await cookies();
    const customerId = cookieStore.get('customer_id')?.value;
    
    
    if (!customerId) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'กรุณาเลือกไฟล์' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP)' }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'ไฟล์ใหญ่เกินไป (สูงสุด 5MB)' }, { status: 400 });
    }

    // Generate unique filename using customer_id
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `slips/${customerId}/${Date.now()}.${ext}`;


    // Upload to Blob (private access - use proxy API)
    const blob = await put(filename, file, {
      access: 'private',
    });

    // Get base URL for proxy
    const baseUrl = request.nextUrl.origin;
    const proxyUrl = `${baseUrl}/api/image?pathname=${encodeURIComponent(blob.pathname)}`;

    return NextResponse.json({ 
      url: proxyUrl,
      pathname: blob.pathname,
    });
  } catch (error) {
    console.error('[v0] Upload slip error:', error);
    return NextResponse.json({ error: 'อัพโหลดไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
  }
}
