import { put } from '@vercel/blob';
import { type NextRequest, NextResponse } from 'next/server';

// Allowed file types for QR images
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'กรุณาเลือกไฟล์รูป QR' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'รองรับเฉพาะไฟล์ PNG, JPG, JPEG, WEBP เท่านั้น' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'ไฟล์ใหญ่เกิน 5MB' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const ext = file.name.split('.').pop() || 'png';
    const filename = `qr-codes/${timestamp}-${Math.random().toString(36).substring(7)}.${ext}`;

    // Upload to Vercel Blob (private access - use proxy API to serve)
    const blob = await put(filename, file, {
      access: 'private',
    });

    // Get base URL for proxy
    const baseUrl = request.nextUrl.origin;
    const pathname = blob.pathname;
    
    // Return proxied URL that can be displayed
    const proxyUrl = `${baseUrl}/api/image?pathname=${encodeURIComponent(pathname)}`;

    return NextResponse.json({
      success: true,
      url: proxyUrl,
      pathname: blob.pathname,
      originalUrl: blob.url,
    });
  } catch (error) {
    console.error('Upload QR error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่', details: errorMessage },
      { status: 500 }
    );
  }
}
