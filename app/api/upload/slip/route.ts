import { put } from '@vercel/blob';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only images are allowed.' }, { status: 400 });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Max 5MB allowed.' }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `slips/${timestamp}-${Math.random().toString(36).substring(7)}.${ext}`;

    // Upload to Vercel Blob (private access - use proxy API to serve)
    const blob = await put(filename, file, {
      access: 'private',
    });

    // Get base URL for proxy
    const baseUrl = request.nextUrl.origin;
    const proxyUrl = `${baseUrl}/api/image?pathname=${encodeURIComponent(blob.pathname)}`;

    return NextResponse.json({ 
      success: true,
      url: proxyUrl,
      pathname: blob.pathname,
    });
  } catch (error) {
    console.error('[v0] Slip upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
