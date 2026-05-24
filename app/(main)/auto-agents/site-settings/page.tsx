'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Palette,
  Image as ImageIcon,
  Globe,
  Save,
  Loader2,
  Upload,
  X,
  CheckCircle2,
  ExternalLink,
  Copy,
  Eye,
} from 'lucide-react';

interface AgentSiteSettings {
  id?: string;
  agent_id?: string;
  site_name: string;
  site_description: string;
  logo_url: string;
  favicon_url: string;
  login_background_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  text_color: string;
  background_color: string;
  custom_domain: string;
  subdomain: string;
  is_active: boolean;
}

const defaultSettings: AgentSiteSettings = {
  site_name: '',
  site_description: '',
  logo_url: '',
  favicon_url: '',
  login_background_url: '',
  primary_color: '#f59e0b',
  secondary_color: '#1f2937',
  accent_color: '#10b981',
  text_color: '#ffffff',
  background_color: '#0a0a0a',
  custom_domain: '',
  subdomain: '',
  is_active: true,
};

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AgentSiteSettingsPage() {
  const { data: currentAgent } = useSWR('/api/auth/me', fetcher);
  const { data: settings, mutate } = useSWR<AgentSiteSettings>(
    currentAgent?.id ? `/api/agent-site-settings?agent_id=${currentAgent.id}` : null,
    fetcher
  );
  
  const [formData, setFormData] = useState<AgentSiteSettings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = {
    logo: useRef<HTMLInputElement>(null),
    favicon: useRef<HTMLInputElement>(null),
    background: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    if (settings && settings.id) {
      setFormData(settings);
    }
  }, [settings]);

  const handleUpload = async (field: 'logo_url' | 'favicon_url' | 'login_background_url', file: File) => {
    if (!file) return;
    
    // Validate file
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ไฟล์ใหญ่เกินไป (สูงสุด 5MB)');
      return;
    }
    
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast.error('รองรับเฉพาะไฟล์ PNG, JPG, WebP, SVG, ICO, GIF');
      return;
    }
    
    setUploading(field);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('folder', `agent-sites/${currentAgent?.id || 'unknown'}/${field.replace('_url', '')}`);
      
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formDataUpload,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      
      const { url } = await response.json();
      setFormData(prev => ({ ...prev, [field]: url }));
      toast.success('อัปโหลดสำเร็จ');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'อัปโหลดไม่สำเร็จ');
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    if (!currentAgent?.id) {
      toast.error('กรุณาเข้าสู่ระบบ');
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch('/api/agent-site-settings', {
        method: settings?.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          agent_id: currentAgent.id,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'บันทึกไม่สำเร็จ');
      }
      
      toast.success('บันทึกการตั้งค่าสำเร็จ');
      mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('คัดลอกแล้ว');
  };

  const siteUrl = formData.subdomain 
    ? `https://${formData.subdomain}.yourdomain.com` 
    : formData.custom_domain 
      ? `https://${formData.custom_domain}` 
      : null;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="size-6 text-amber-500" />
            ตั้งค่าเว็บลูก
          </h1>
          <p className="text-muted-foreground mt-1">
            ปรับแต่งรูปลักษณ์และการแสดงผลเว็บของคุณ
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-amber-500 hover:bg-amber-600">
          {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
          บันทึกการตั้งค่า
        </Button>
      </div>

      {/* Site Preview URL */}
      {siteUrl && (
        <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="size-5 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">URL เว็บของคุณ</p>
                <p className="font-medium">{siteUrl}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(siteUrl)}>
                <Copy className="size-4 mr-1" />
                คัดลอก
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={siteUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4 mr-1" />
                  เปิดเว็บ
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <Globe className="size-4" />
            <span className="hidden sm:inline">ข้อมูลเว็บ</span>
          </TabsTrigger>
          <TabsTrigger value="images" className="flex items-center gap-2">
            <ImageIcon className="size-4" />
            <span className="hidden sm:inline">รูปภาพ</span>
          </TabsTrigger>
          <TabsTrigger value="colors" className="flex items-center gap-2">
            <Palette className="size-4" />
            <span className="hidden sm:inline">สีธีม</span>
          </TabsTrigger>
        </TabsList>

        {/* Branding Tab */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลเว็บไซต์</CardTitle>
              <CardDescription>ตั้งค่าชื่อเว็บ, คำอธิบาย และโดเมน</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>ชื่อเว็บไซต์</Label>
                  <Input
                    value={formData.site_name}
                    onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
                    placeholder="เช่น Lotto Premium"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Subdomain</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={formData.subdomain}
                      onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                      placeholder="mysite"
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground">.yourdomain.com</span>
                  </div>
                </div>
              </div>
              <div>
                <Label>คำอธิบายเว็บ</Label>
                <Input
                  value={formData.site_description}
                  onChange={(e) => setFormData({ ...formData, site_description: e.target.value })}
                  placeholder="เว็บหวยออนไลน์ครบวงจร จ่ายจริง จ่ายไว"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>โดเมนของตัวเอง (ถ้ามี)</Label>
                <Input
                  value={formData.custom_domain}
                  onChange={(e) => setFormData({ ...formData, custom_domain: e.target.value })}
                  placeholder="www.mylottosite.com"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  ต้องตั้งค่า DNS ชี้มาที่เซิร์ฟเวอร์ก่อนจึงจะใช้งานได้
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Images Tab */}
        <TabsContent value="images">
          <Card>
            <CardHeader>
              <CardTitle>รูปภาพเว็บไซต์</CardTitle>
              <CardDescription>อัปโหลดโลโก้และรูปภาพพื้นหลัง (รูปจะไม่หมดอายุ)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                {/* Logo */}
                <div className="space-y-3">
                  <Label>โลโก้เว็บ</Label>
                  <p className="text-xs text-muted-foreground">แนะนำ: 200x60 px (PNG/SVG)</p>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    {formData.logo_url ? (
                      <div className="relative group">
                        <img src={formData.logo_url} alt="Logo" className="max-h-16 mx-auto" />
                        <button
                          onClick={() => setFormData({ ...formData, logo_url: '' })}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="size-3" />
                        </button>
                        <Badge className="mt-2 bg-green-500">ถาวร</Badge>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRefs.logo.current?.click()}
                        className="cursor-pointer py-4 hover:bg-muted/50 rounded transition-colors"
                      >
                        {uploading === 'logo_url' ? (
                          <Loader2 className="size-8 mx-auto animate-spin text-amber-500" />
                        ) : (
                          <>
                            <Upload className="size-8 mx-auto text-muted-foreground" />
                            <p className="text-sm text-muted-foreground mt-2">คลิกเพื่ออัปโหลด</p>
                          </>
                        )}
                      </div>
                    )}
                    <input
                      ref={fileInputRefs.logo}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleUpload('logo_url', e.target.files[0])}
                    />
                  </div>
                </div>

                {/* Favicon */}
                <div className="space-y-3">
                  <Label>Favicon</Label>
                  <p className="text-xs text-muted-foreground">แนะนำ: 32x32 หรือ 64x64 px (ICO/PNG)</p>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    {formData.favicon_url ? (
                      <div className="relative group">
                        <img src={formData.favicon_url} alt="Favicon" className="size-12 mx-auto" />
                        <button
                          onClick={() => setFormData({ ...formData, favicon_url: '' })}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="size-3" />
                        </button>
                        <Badge className="mt-2 bg-green-500">ถาวร</Badge>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRefs.favicon.current?.click()}
                        className="cursor-pointer py-4 hover:bg-muted/50 rounded transition-colors"
                      >
                        {uploading === 'favicon_url' ? (
                          <Loader2 className="size-8 mx-auto animate-spin text-amber-500" />
                        ) : (
                          <>
                            <Upload className="size-8 mx-auto text-muted-foreground" />
                            <p className="text-sm text-muted-foreground mt-2">คลิกเพื่ออัปโหลด</p>
                          </>
                        )}
                      </div>
                    )}
                    <input
                      ref={fileInputRefs.favicon}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleUpload('favicon_url', e.target.files[0])}
                    />
                  </div>
                </div>

                {/* Background */}
                <div className="space-y-3 sm:col-span-2">
                  <Label>พื้นหลังหน้าล็อกอิน</Label>
                  <p className="text-xs text-muted-foreground">แนะนำ: 1920x1080 px (JPG/WebP)</p>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    {formData.login_background_url ? (
                      <div className="relative group">
                        <img src={formData.login_background_url} alt="Background" className="max-h-32 mx-auto rounded" />
                        <button
                          onClick={() => setFormData({ ...formData, login_background_url: '' })}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="size-3" />
                        </button>
                        <Badge className="mt-2 bg-green-500">ถาวร</Badge>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRefs.background.current?.click()}
                        className="cursor-pointer py-6 hover:bg-muted/50 rounded transition-colors"
                      >
                        {uploading === 'login_background_url' ? (
                          <Loader2 className="size-8 mx-auto animate-spin text-amber-500" />
                        ) : (
                          <>
                            <Upload className="size-8 mx-auto text-muted-foreground" />
                            <p className="text-sm text-muted-foreground mt-2">คลิกเพื่ออัปโหลดพื้นหลัง</p>
                          </>
                        )}
                      </div>
                    )}
                    <input
                      ref={fileInputRefs.background}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleUpload('login_background_url', e.target.files[0])}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Colors Tab */}
        <TabsContent value="colors">
          <Card>
            <CardHeader>
              <CardTitle>สีธีม</CardTitle>
              <CardDescription>ปรับแต่งสีเว็บไซต์ตามแบรนด์ของคุณ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Label>สีหลัก (Primary)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="color"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="w-14 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label>สีรอง (Secondary)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="color"
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                      className="w-14 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label>สีเน้น (Accent)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="color"
                      value={formData.accent_color}
                      onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                      className="w-14 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={formData.accent_color}
                      onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label>สีตัวอักษร</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="color"
                      value={formData.text_color}
                      onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                      className="w-14 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={formData.text_color}
                      onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label>สีพื้นหลัง</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="color"
                      value={formData.background_color}
                      onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                      className="w-14 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={formData.background_color}
                      onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="mt-6">
                <Label className="mb-3 block">ตัวอย่างการแสดงผล</Label>
                <div 
                  className="rounded-lg p-6 border"
                  style={{ backgroundColor: formData.background_color }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    {formData.logo_url ? (
                      <img src={formData.logo_url} alt="Logo" className="h-8" />
                    ) : (
                      <div 
                        className="w-32 h-8 rounded flex items-center justify-center text-sm font-bold"
                        style={{ backgroundColor: formData.primary_color, color: formData.text_color }}
                      >
                        {formData.site_name || 'LOGO'}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      className="px-4 py-2 rounded font-medium text-sm"
                      style={{ backgroundColor: formData.primary_color, color: formData.text_color }}
                    >
                      ปุ่มหลัก
                    </button>
                    <button
                      className="px-4 py-2 rounded font-medium text-sm"
                      style={{ backgroundColor: formData.secondary_color, color: formData.text_color }}
                    >
                      ปุ่มรอง
                    </button>
                    <button
                      className="px-4 py-2 rounded font-medium text-sm"
                      style={{ backgroundColor: formData.accent_color, color: formData.text_color }}
                    >
                      ปุ่มเน้น
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Card */}
      <Card className="bg-blue-500/10 border-blue-500/20">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <CheckCircle2 className="size-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-500">การตั้งค่าบันทึกถาวร</p>
              <p className="text-muted-foreground mt-1">
                ทุกการตั้งค่าจะถูกบันทึกลงฐานข้อมูลถาวร รูปภาพที่อัปโหลดจะไม่หมดอายุ
                ลูกค้าที่เข้าเว็บของคุณจะเห็นการตั้งค่าที่คุณกำหนดทันที
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
