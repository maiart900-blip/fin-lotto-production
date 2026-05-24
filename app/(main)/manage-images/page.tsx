'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useDynamicTheme } from '@/lib/dynamic-theme';
import { 
  Image as ImageIcon, 
  Upload, 
  Trash2, 
  Save, 
  RotateCcw,
  Loader2,
  Globe,
  Layout,
  Megaphone,
  Palette,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const CATEGORIES = [
  { key: 'branding', name: 'โลโก้และแบรนด์', icon: Globe },
  { key: 'background', name: 'พื้นหลัง', icon: Layout },
  { key: 'banner', name: 'แบนเนอร์', icon: Megaphone },
  { key: 'ui', name: 'UI Elements', icon: Palette },
];

interface WebImage {
  id: string;
  key: string;
  name: string;
  description: string;
  image_url: string | null;
  default_url: string | null;
  category: string;
  is_active: boolean;
}

export default function ManageImagesPage() {
  const { data: images, error, mutate } = useSWR<WebImage[]>('/api/web-images', fetcher);
  const { refreshWebImages } = useDynamicTheme();
  const [uploading, setUploading] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [saving, setSaving] = useState(false);

  const handleFileChange = (imageKey: string, file: File | null) => {
    if (!file) return;
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ไฟล์ใหญ่เกินไป (สูงสุด 5MB)');
      return;
    }
    
    // Check file type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast.error('รองรับเฉพาะไฟล์ PNG, JPG, WebP, SVG, ICO, GIF');
      return;
    }
    
    // Store file for upload
    setFiles(prev => ({ ...prev, [imageKey]: file }));
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviews(prev => ({ ...prev, [imageKey]: e.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (image: WebImage) => {
    const file = files[image.key];
    if (!file) {
      toast.error('กรุณาเลือกรูปภาพ');
      return;
    }
    
    setUploading(image.key);
    setSaving(true);
    try {
      // Upload to Vercel Blob for permanent storage
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', `site-images/${image.category}`);
      
      const uploadResponse = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || 'Upload failed');
      }
      
      const { url: blobUrl } = await uploadResponse.json();
      
      // Delete old blob if exists
      if (image.image_url && image.image_url.includes('vercel-storage.com')) {
        await fetch('/api/upload-image', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: image.image_url }),
        }).catch(() => {}); // Ignore errors
      }
      
      // Save new URL to database
      const response = await fetch('/api/web-images', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: image.id,
          image_url: blobUrl,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to save');
      
      toast.success('อัปโหลดและบันทึกสำเร็จ! (รูปจะไม่หมดอายุ)');
      mutate();
      await refreshWebImages();
      setPreviews(prev => {
        const newPreviews = { ...prev };
        delete newPreviews[image.key];
        return newPreviews;
      });
      setFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[image.key];
        return newFiles;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ไม่สามารถอัปโหลดได้');
    } finally {
      setSaving(false);
      setUploading(null);
    }
  };

  const handleReset = async (image: WebImage) => {
    setSaving(true);
    try {
      const response = await fetch('/api/web-images', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: image.id,
          image_url: image.default_url,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to reset');
      
      toast.success('รีเซ็ตเป็นค่าเริ่มต้นสำเร็จ - อัปเดตเว็บแล้ว');
      mutate();
      await refreshWebImages(); // Refresh theme images
      setPreviews(prev => {
        const newPreviews = { ...prev };
        delete newPreviews[image.key];
        return newPreviews;
      });
    } catch {
      toast.error('ไม่สามารถรีเซ็ตได้');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (image: WebImage) => {
    setSaving(true);
    try {
      const response = await fetch('/api/web-images', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: image.id,
          image_url: null,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to remove');
      
      toast.success('ลบรูปภาพสำเร็จ - อัปเดตเว็บแล้ว');
      mutate();
      await refreshWebImages(); // Refresh theme images
    } catch {
      toast.error('ไม่สามารถลบได้');
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center text-destructive">
            เกิดข้อผิดพลาดในการโหลดข้อมูล
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!images) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const groupedImages = CATEGORIES.map(cat => ({
    ...cat,
    images: images.filter(img => img.category === cat.key),
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">จัดการรูปภาพเว็บ</h1>
          <p className="text-muted-foreground">อัปโหลดและเปลี่ยนรูปภาพต่างๆ บนเว็บไซต์</p>
        </div>
      </div>

      <Tabs defaultValue="branding" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          {CATEGORIES.map(cat => (
            <TabsTrigger key={cat.key} value={cat.key} className="flex items-center gap-2">
              <cat.icon className="size-4" />
              <span className="hidden sm:inline">{cat.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {groupedImages.map(group => (
          <TabsContent key={group.key} value={group.key} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {group.images.map(image => (
                <Card key={image.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ImageIcon className="size-4" />
                      {image.name}
                    </CardTitle>
                    {image.description && (
                      <p className="text-sm text-muted-foreground">{image.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Preview */}
                    <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center border">
                      {previews[image.key] ? (
                        <img 
                          src={previews[image.key]} 
                          alt={image.name}
                          className="w-full h-full object-contain"
                        />
                      ) : image.image_url ? (
                        <img 
                          src={image.image_url} 
                          alt={image.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="text-muted-foreground text-sm">ยังไม่มีรูปภาพ</div>
                      )}
                    </div>

                    {/* Upload */}
                    <div>
                      <Label htmlFor={`file-${image.key}`} className="cursor-pointer">
                        <div className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-muted transition-colors">
                          <Upload className="size-4" />
                          <span className="text-sm">เลือกรูปภาพ</span>
                        </div>
                      </Label>
                      <Input
                        id={`file-${image.key}`}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={(e) => handleFileChange(image.key, e.target.files?.[0] || null)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP, SVG (สูงสุด 5MB)</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {previews[image.key] && (
                        <Button 
                          size="sm" 
                          onClick={() => handleSave(image)}
                          disabled={saving}
                        >
                          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                          <span className="ml-1">บันทึก</span>
                        </Button>
                      )}
                      {image.image_url && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleRemove(image)}
                          disabled={saving}
                        >
                          <Trash2 className="size-4" />
                          <span className="ml-1">ลบ</span>
                        </Button>
                      )}
                      {image.default_url && image.image_url !== image.default_url && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleReset(image)}
                          disabled={saving}
                        >
                          <RotateCcw className="size-4" />
                          <span className="ml-1">รีเซ็ต</span>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {group.images.length === 0 && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  ไม่มีรูปภาพในหมวดนี้
                </div>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
