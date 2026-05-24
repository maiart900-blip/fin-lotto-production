'use client';

import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface ImageUrlUploadProps {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  folder?: string;
}

export function ImageUrlUpload({ value, onChange, placeholder, folder = 'lottery-images' }: ImageUrlUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('รองรับเฉพาะไฟล์ PNG, JPG, WebP, GIF');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('ไฟล์ใหญ่เกินไป (สูงสุด 2MB)');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to Vercel Blob
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Upload failed');
      }

      const { url } = await response.json();
      onChange(url);
      setPreview(null);
      toast.success('อัปโหลดสำเร็จ');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ');
      setPreview(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClear = () => {
    onChange('');
    setPreview(null);
  };

  const getDisplayUrl = (url: string) => {
    if (!url) return '';
    // For private Vercel Blob, serve through API
    if (url.includes('private.blob.vercel-storage.com')) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname.slice(1);
        return `/api/image?pathname=${encodeURIComponent(pathname)}`;
      } catch {
        return url;
      }
    }
    return url;
  };

  const hasImage = value || preview;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'URL รูปภาพ หรือกดอัปโหลด'}
          className="flex-1"
          disabled={uploading}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="อัปโหลดรูป"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        </Button>
        {hasImage && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleClear}
            disabled={uploading}
            title="ลบรูป"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
      
      {/* Preview */}
      {(preview || value) && (
        <div className="relative w-full h-24 bg-muted rounded-md overflow-hidden border">
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <img
              src={preview || getDisplayUrl(value)}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
        </div>
      )}
      
      {!hasImage && (
        <div className="w-full h-24 bg-muted/50 rounded-md border border-dashed flex items-center justify-center">
          <div className="text-center text-muted-foreground text-xs">
            <ImageIcon className="size-6 mx-auto mb-1 opacity-50" />
            <span>ยังไม่มีรูปภาพ</span>
          </div>
        </div>
      )}
    </div>
  );
}
