'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Loader2, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface ImageUploadFieldProps {
  label: string;
  description?: string;
  value: string | null;
  onChange: (url: string) => void;
  folder?: string;
  placeholder?: string;
}

export function ImageUploadField({
  label,
  description,
  value,
  onChange,
  folder = 'site-images',
  placeholder = 'https://example.com/image.png หรือเลือกไฟล์อัปโหลด',
}: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast.error('รองรับเฉพาะไฟล์ PNG, JPG, WebP, SVG, ICO, GIF');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ไฟล์ใหญ่เกินไป (สูงสุด 5MB)');
      return;
    }

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
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const { url } = await response.json();
      onChange(url);
      toast.success('อัปโหลดสำเร็จ! (รูปจะไม่หมดอายุ)');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const isVercelBlob = value?.includes('vercel-storage.com');
  const hasValidImage = value && (value.startsWith('http') || value.startsWith('data:'));
  
  // For private blobs, we need to get the pathname and serve through our API
  const getImageSrc = (url: string | null) => {
    if (!url) return '';
    // External URLs or data URLs - use directly
    if (!url.includes('vercel-storage.com')) return url;
    // For Vercel Blob URLs, extract pathname and serve through our API
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.slice(1); // Remove leading slash
      return `/api/image?pathname=${encodeURIComponent(pathname)}`;
    } catch {
      return url;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Label>{label}</Label>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {isVercelBlob && (
          <span className="text-xs text-emerald-500 flex items-center gap-1">
            <CheckCircle className="size-3" />
            ถาวร
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
        </Button>
        {value && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onChange('')}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-3 text-center transition-colors
          ${dragOver ? 'border-amber-500 bg-amber-500/10' : 'border-muted hover:border-muted-foreground/50'}
          ${uploading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
        `}
        onClick={() => fileInputRef.current?.click()}
      >
        {hasValidImage ? (
          <div className="relative">
            <img
              src={getImageSrc(value)}
              alt={label}
              className="max-h-24 mx-auto rounded object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground py-2">
            <ImageIcon className="size-6" />
            <span className="text-xs">ลากรูปมาวาง หรือคลิกเลือกไฟล์</span>
          </div>
        )}
      </div>
    </div>
  );
}
