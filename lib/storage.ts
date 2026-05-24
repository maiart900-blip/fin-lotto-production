import { put, del, list } from '@vercel/blob';
import { ENV } from './env';

// Fallback images
export const FALLBACK_IMAGES = {
  avatar: '/images/default-avatar.png',
  slip: '/images/default-slip.png',
  banner: '/images/default-banner.png',
  logo: '/icon-512.png',
  empty: '/images/empty-state.png',
};

// Upload file to Vercel Blob
export async function uploadFile(
  file: File | Blob,
  options: {
    folder?: string;
    filename?: string;
    access?: 'public';
  } = {}
): Promise<{ url: string; success: boolean; error?: string }> {
  try {
    if (!ENV.BLOB_READ_WRITE_TOKEN) {
      console.warn('[Storage] BLOB_READ_WRITE_TOKEN not set, using fallback');
      return { url: FALLBACK_IMAGES.slip, success: true };
    }

    const folder = options.folder || 'uploads';
    const filename = options.filename || `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const pathname = `${folder}/${filename}`;

    const blob = await put(pathname, file, {
      access: options.access || 'public',
      token: ENV.BLOB_READ_WRITE_TOKEN,
    });

    return { url: blob.url, success: true };
  } catch (error) {
    console.error('[Storage] Upload error:', error);
    return { 
      url: FALLBACK_IMAGES.slip, 
      success: false, 
      error: error instanceof Error ? error.message : 'Upload failed' 
    };
  }
}

// Delete file from Vercel Blob
export async function deleteFile(url: string): Promise<boolean> {
  try {
    if (!ENV.BLOB_READ_WRITE_TOKEN) return false;
    await del(url, { token: ENV.BLOB_READ_WRITE_TOKEN });
    return true;
  } catch (error) {
    console.error('[Storage] Delete error:', error);
    return false;
  }
}

// List files in folder
export async function listFiles(folder: string): Promise<string[]> {
  try {
    if (!ENV.BLOB_READ_WRITE_TOKEN) return [];
    const { blobs } = await list({ prefix: folder, token: ENV.BLOB_READ_WRITE_TOKEN });
    return blobs.map(b => b.url);
  } catch (error) {
    console.error('[Storage] List error:', error);
    return [];
  }
}

// Get image URL with fallback
export function getImageUrl(url: string | null | undefined, fallback: keyof typeof FALLBACK_IMAGES = 'empty'): string {
  if (!url) return FALLBACK_IMAGES[fallback];
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return url;
  return FALLBACK_IMAGES[fallback];
}

// Validate and process uploaded image
export async function processUploadedImage(
  file: File,
  options: {
    maxSize?: number;
    folder?: string;
  } = {}
): Promise<{ url: string; success: boolean; error?: string }> {
  const maxSize = options.maxSize || 5 * 1024 * 1024; // 5MB default

  // Validate size
  if (file.size > maxSize) {
    return { 
      url: '', 
      success: false, 
      error: `ไฟล์ใหญ่เกิน ${maxSize / 1024 / 1024}MB` 
    };
  }

  // Validate type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return { 
      url: '', 
      success: false, 
      error: 'รองรับเฉพาะไฟล์ JPG, PNG, WebP, GIF' 
    };
  }

  return uploadFile(file, { folder: options.folder || 'images' });
}
