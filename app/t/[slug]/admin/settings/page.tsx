'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Palette, 
  Globe, 
  Image as ImageIcon, 
  Type, 
  Save, 
  Loader2,
  Upload,
  Eye,
  Moon,
  Sun,
  Smartphone,
  Monitor
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo_url: string | null;
  theme_config: {
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    background_color: string;
    text_color: string;
    mode: 'dark' | 'light';
  } | null;
  welcome_message: string | null;
  contact_line: string | null;
  contact_phone: string | null;
  is_active: boolean;
}

export default function TenantSettingsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  
  const { data: tenant, mutate, isLoading } = useSWR<TenantSettings>(
    `/api/tenant/${slug}/admin/settings`,
    fetcher
  );
  
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    logo_url: '',
    welcome_message: '',
    contact_line: '',
    contact_phone: '',
    primary_color: '#FFD700',
    secondary_color: '#1a1a2e',
    accent_color: '#00D4FF',
    background_color: '#0a0a1a',
    text_color: '#ffffff',
    theme_mode: 'dark' as 'dark' | 'light',
  });
  
  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || '',
        domain: tenant.domain || '',
        logo_url: tenant.logo_url || '',
        welcome_message: tenant.welcome_message || '',
        contact_line: tenant.contact_line || '',
        contact_phone: tenant.contact_phone || '',
        primary_color: tenant.theme_config?.primary_color || '#FFD700',
        secondary_color: tenant.theme_config?.secondary_color || '#1a1a2e',
        accent_color: tenant.theme_config?.accent_color || '#00D4FF',
        background_color: tenant.theme_config?.background_color || '#0a0a1a',
        text_color: tenant.theme_config?.text_color || '#ffffff',
        theme_mode: tenant.theme_config?.mode || 'dark',
      });
    }
  }, [tenant]);
  
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/tenant/${slug}/admin/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          domain: formData.domain || null,
          logo_url: formData.logo_url || null,
          welcome_message: formData.welcome_message || null,
          contact_line: formData.contact_line || null,
          contact_phone: formData.contact_phone || null,
          theme_config: {
            primary_color: formData.primary_color,
            secondary_color: formData.secondary_color,
            accent_color: formData.accent_color,
            background_color: formData.background_color,
            text_color: formData.text_color,
            mode: formData.theme_mode,
          },
        }),
      });
      
      if (!res.ok) throw new Error('บันทึกไม่สำเร็จ');
      
      toast.success('บันทึกการตั้งค่าสำเร็จ');
      mutate();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-yellow-500" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-yellow-500">ตั้งค่าเว็บไซต์</h1>
          <p className="text-gray-400">ปรับแต่งรูปลักษณ์และข้อมูลเว็บของคุณ</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-yellow-500 hover:bg-yellow-600 text-black"
        >
          {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
          บันทึกการตั้งค่า
        </Button>
      </div>
      
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-gray-800/50">
          <TabsTrigger value="general" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
            <Globe className="size-4 mr-2" />
            ทั่วไป
          </TabsTrigger>
          <TabsTrigger value="branding" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
            <ImageIcon className="size-4 mr-2" />
            โลโก้/แบรนด์
          </TabsTrigger>
          <TabsTrigger value="theme" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
            <Palette className="size-4 mr-2" />
            ธีม/สี
          </TabsTrigger>
          <TabsTrigger value="contact" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
            <Smartphone className="size-4 mr-2" />
            ติดต่อ
          </TabsTrigger>
        </TabsList>
        
        {/* General Settings */}
        <TabsContent value="general">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-yellow-500">ข้อมูลทั่วไป</CardTitle>
              <CardDescription>ตั้งค่าชื่อและ Domain ของเว็บไซต์</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>ชื่อเว็บไซต์</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="เช่น มีตังค์หวยจ๋า"
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Domain (ถ้ามี)</Label>
                  <Input
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    placeholder="เช่น meetang.com"
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>ข้อความต้อนรับ</Label>
                <Textarea
                  value={formData.welcome_message}
                  onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
                  placeholder="ข้อความที่จะแสดงในหน้าแรก"
                  className="bg-gray-800 border-gray-700"
                  rows={3}
                />
              </div>
              
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <h4 className="font-medium mb-2">URL เว็บไซต์ของคุณ</h4>
                <code className="text-yellow-500 text-sm">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/t/{slug}
                </code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Branding Settings */}
        <TabsContent value="branding">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-yellow-500">โลโก้และแบรนด์</CardTitle>
              <CardDescription>อัพโหลดโลโก้และตั้งค่าแบรนด์ของคุณ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>URL โลโก้</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    className="bg-gray-800 border-gray-700 flex-1"
                  />
                  <Button variant="outline" className="border-gray-700">
                    <Upload className="size-4 mr-2" />
                    อัพโหลด
                  </Button>
                </div>
                <p className="text-xs text-gray-500">แนะนำขนาด 200x200 พิกเซล รูปแบบ PNG หรือ SVG</p>
              </div>
              
              {formData.logo_url && (
                <div className="space-y-2">
                  <Label>ตัวอย่างโลโก้</Label>
                  <div className="p-4 bg-gray-800 rounded-lg inline-block">
                    <img 
                      src={formData.logo_url} 
                      alt="Logo Preview" 
                      className="h-16 w-auto"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-logo.png';
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Theme Settings */}
        <TabsContent value="theme">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-yellow-500">ธีมและสี</CardTitle>
              <CardDescription>ปรับแต่งสีและธีมของเว็บไซต์</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme Mode */}
              <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  {formData.theme_mode === 'dark' ? (
                    <Moon className="size-5 text-yellow-500" />
                  ) : (
                    <Sun className="size-5 text-yellow-500" />
                  )}
                  <div>
                    <p className="font-medium">โหมดธีม</p>
                    <p className="text-sm text-gray-400">
                      {formData.theme_mode === 'dark' ? 'โหมดมืด' : 'โหมดสว่าง'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.theme_mode === 'light'}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, theme_mode: checked ? 'light' : 'dark' })
                  }
                />
              </div>
              
              {/* Color Pickers */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>สีหลัก (Primary)</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="bg-gray-800 border-gray-700 flex-1"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>สีรอง (Secondary)</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                      className="bg-gray-800 border-gray-700 flex-1"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>สีเน้น (Accent)</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.accent_color}
                      onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={formData.accent_color}
                      onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                      className="bg-gray-800 border-gray-700 flex-1"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>สีพื้นหลัง</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.background_color}
                      onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={formData.background_color}
                      onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                      className="bg-gray-800 border-gray-700 flex-1"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>สีตัวอักษร</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.text_color}
                      onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={formData.text_color}
                      onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                      className="bg-gray-800 border-gray-700 flex-1"
                    />
                  </div>
                </div>
              </div>
              
              {/* Preview */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Eye className="size-4" />
                  ตัวอย่างธีม
                </Label>
                <div 
                  className="p-6 rounded-lg border"
                  style={{ 
                    backgroundColor: formData.background_color,
                    borderColor: formData.secondary_color
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-black font-bold"
                      style={{ backgroundColor: formData.primary_color }}
                    >
                      {formData.name?.charAt(0) || 'M'}
                    </div>
                    <h3 
                      className="text-lg font-bold"
                      style={{ color: formData.primary_color }}
                    >
                      {formData.name || 'ชื่อเว็บไซต์'}
                    </h3>
                  </div>
                  <p style={{ color: formData.text_color }}>
                    นี่คือตัวอย่างข้อความปกติ
                  </p>
                  <button 
                    className="mt-3 px-4 py-2 rounded font-medium"
                    style={{ 
                      backgroundColor: formData.primary_color,
                      color: formData.background_color
                    }}
                  >
                    ปุ่มตัวอย่าง
                  </button>
                  <button 
                    className="mt-3 ml-2 px-4 py-2 rounded font-medium border"
                    style={{ 
                      borderColor: formData.accent_color,
                      color: formData.accent_color
                    }}
                  >
                    ปุ่มรอง
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Contact Settings */}
        <TabsContent value="contact">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-yellow-500">ข้อมูลติดต่อ</CardTitle>
              <CardDescription>ช่องทางติดต่อที่จะแสดงในเว็บไซต์</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>LINE ID</Label>
                  <Input
                    value={formData.contact_line}
                    onChange={(e) => setFormData({ ...formData, contact_line: e.target.value })}
                    placeholder="@meetang"
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label>เบอร์โทรศัพท์</Label>
                  <Input
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    placeholder="0812345678"
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
