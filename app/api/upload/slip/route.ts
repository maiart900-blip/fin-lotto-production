import { put } from '@vercel/blob';
import { type NextRequest, NextResponse } from 'next/server';
import { imageOptimizer } from '@/lib/storage/image-optimizer';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const category = formData.get('category') as string || 'deposit';
    const customerId = formData.get('customer_id') as string || undefined;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only images are allowed.' }, { status: 400 });
    }

    // Validate file size (max 10MB before compression)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Max 10MB allowed.' }, { status: 400 });
    }

    // Upload with automatic compression (target: 200-300KB)
    const result = await imageOptimizer.uploadSlip(
      file,
      category as 'deposit' | 'withdraw' | 'payment',
      customerId
    );

    // Get base URL for proxy
    const baseUrl = request.nextUrl.origin;
    const proxyUrl = `${baseUrl}/api/image?pathname=${encodeURIComponent(result.pathname)}`;

    return NextResponse.json({ 
      success: true,
      url: proxyUrl,
      pathname: result.pathname,
      compression: {
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        ratio: `${result.compressionRatio.toFixed(1)}%`,
      },
    });
  } catch (error) {
    console.error('Slip upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
