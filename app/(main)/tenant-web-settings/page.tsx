'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/components/session-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Settings, Save, Loader2, RefreshCw, 
  TrendingUp, MessageSquare, Megaphone, Image,
  Phone, Mail, ExternalLink, Palette, Shield,
  CheckCircle, AlertTriangle, Info, XCircle
} from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface TenantSettings {
  id: string;
  tenant_id: string;
  // Turnover
  turnover_enabled: boolean;
  turnover_percentage: number;
  turnover_multiplier: number;
  // Support
  line_support_url: string;
  line_support_id: string;
  support_phone: string;
  support_email: string;
  // Announcement
  announcement_enabled: boolean;
  announcement_title: string;
  announcement_message: string;
  announcement_type: string;
  announcement_dismissible: boolean;
  // Promotions
  promotions_enabled: boolean;
  promotions_banner_url: string;
  promotions_title: string;
  promotions_description: string;
  promotions_link: string;
  // Branding
  brand_name: string;
  brand_logo_url: string;
  brand_primary_color: string;
  brand_secondary_color: string;
}

export default function TenantWebSettingsPage() {
  const { session } = useSession();
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<TenantSettings | null>(null);

  const { data, error, isLoading, mutate } = useSWR(
    session?.tenant_id ? `/api/tenant-settings?tenant_id=${session.tenant_id}` : null,
    fetcher
  );

  useEffect(() => {
    if (data?.settings) {
      setSettings(data.settings);
    }
  }, [data]);

  const handleSave = async () => {
    if (!settings || !session?.tenant_id) return;

    setSaving(true);
    try {
      const res = await fetch('/api/tenant-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: session.tenant_id,
          ...settings,
        }),
      });

      const result = await res.json();

      if (res.ok) {
        toast.success('บันทึกการตั้งค่าสำเร็จ', {
          description: 'การเปลี่ยนแปลงจะมีผลทันทีบนหน้าบ้านลูกค้า',
          style: { background: '#0a0a0a', border: '1px solid #22c55e', color: '#86efac' }
        });
        mutate();
      } else {
        toast.error(result.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('ไม่สามารถบันทึกได้');
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof TenantSettings>(field: K, value: TenantSettings[K]) => {
    if (settings) {
      setSettings({ ...settings, [field]: value });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-neutral-400">
        <AlertTriangle className="size-12 mb-4 text-amber-500" />
        <p>ไม่สามารถโหลดการตั้งค่าได้</p>
        <Button variant="outline" onClick={() => mutate()} className="mt-4">
          <RefreshCw className="size-4 mr-2" />
          ลองใหม่
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-neutral-950 to-black p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 flex items-center gap-3">
            <Settings className="size-7 text-amber-500" />
            ตั้งค่าเว็บลูก
          </h1>
          <p className="text-neutral-400 mt-1">จัดการการตั้งค่าการตลาดและหน้าร้านของคุณ</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold hover:from-amber-400 hover:to-amber-500 px-6"
        >
          {saving ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              กำลังบันทึก...
            </>
          ) : (
            <>
              <Save className="size-4 mr-2" />
              บันทึกทั้งหมด
            </>
          )}
        </Button>
      </div>

      {/* Instant Active Notice */}
      <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
        <CheckCircle className="size-5 text-emerald-500 shrink-0" />
        <p className="text-emerald-300 text-sm">
          <strong>Instant Active:</strong> เมื่อกดบันทึก การเปลี่ยนแปลงทั้งหมดจะมีผลบนหน้าบ้านลูกค้าทันที 100%
        </p>
      </div>

      <Tabs defaultValue="turnover" className="space-y-6">
        <TabsList className="bg-black/60 border border-amber-500/30 p-1">
          <TabsTrigger value="turnover" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">
            <TrendingUp className="size-4 mr-2" />
            เทิร์นโอเวอร์
          </TabsTrigger>
          <TabsTrigger value="support" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">
            <Phone className="size-4 mr-2" />
            ช่องทางติดต่อ
          </TabsTrigger>
          <TabsTrigger value="announcement" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">
            <Megaphone className="size-4 mr-2" />
            ประกาศ
          </TabsTrigger>
          <TabsTrigger value="promotions" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">
            <Image className="size-4 mr-2" />
            โปรโมชั่น
          </TabsTrigger>
          <TabsTrigger value="branding" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">
            <Palette className="size-4 mr-2" />
            แบรนด์
          </TabsTrigger>
        </TabsList>

        {/* Turnover Settings */}
        <TabsContent value="turnover">
          <Card className="bg-gradient-to-br from-black/80 to-neutral-900/80 border-2 border-amber-500/30 shadow-[0_0_30px_rgba(212,175,55,0.1)]">
            <CardHeader>
              <CardTitle className="text-amber-400 flex items-center gap-2">
                <TrendingUp className="size-5" />
                ตั้งค่าเทิร์นโอเวอร์
              </CardTitle>
              <CardDescription>บังคับทำยอดเทิร์นโอเวอร์ก่อนถอนเงินออโต้</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-black/40 border border-amber-500/20">
                <div className="space-y-1">
                  <Label className="text-white font-medium">เปิดใช้งานระบบเทิร์นโอเวอร์</Label>
                  <p className="text-sm text-neutral-400">ลูกค้าต้องทำยอดเทิร์นก่อนถอนได้</p>
                </div>
                <Switch
                  checked={settings.turnover_enabled}
                  onCheckedChange={(checked) => updateField('turnover_enabled', checked)}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>

              {settings.turnover_enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-amber-200">เปอร์เซ็นต์เทิร์นโอเวอร์ (%)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={settings.turnover_percentage}
                      onChange={(e) => updateField('turnover_percentage', parseInt(e.target.value) || 100)}
                      className="bg-black/40 border-amber-500/30 text-white text-lg font-bold"
                    />
                    <p className="text-xs text-neutral-500">ยอดฝาก x เปอร์เซ็นต์ = ยอดเทิร์นที่ต้องทำ</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-amber-200">ตัวคูณเทิร์นโอเวอร์</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min={0.1}
                      max={10}
                      value={settings.turnover_multiplier}
                      onChange={(e) => updateField('turnover_multiplier', parseFloat(e.target.value) || 1)}
                      className="bg-black/40 border-amber-500/30 text-white text-lg font-bold"
                    />
                    <p className="text-xs text-neutral-500">ตัวคูณเพิ่มเติม (1.0 = ไม่คูณ)</p>
                  </div>
                </div>
              )}

              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <p className="text-amber-300 text-sm flex items-center gap-2">
                  <Info className="size-4" />
                  ตัวอย่าง: ฝาก 1,000 บาท x {settings.turnover_percentage}% x {settings.turnover_multiplier} = ต้องทำยอด {(1000 * (settings.turnover_percentage / 100) * settings.turnover_multiplier).toLocaleString()} บาท
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Support Settings */}
        <TabsContent value="support">
          <Card className="bg-gradient-to-br from-black/80 to-neutral-900/80 border-2 border-amber-500/30 shadow-[0_0_30px_rgba(212,175,55,0.1)]">
            <CardHeader>
              <CardTitle className="text-amber-400 flex items-center gap-2">
                <MessageSquare className="size-5" />
                ช่องทางติดต่อหลังบ้าน
              </CardTitle>
              <CardDescription>ลิงก์ติดต่อทีมซัพพอร์ตสำหรับลูกค้า</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-amber-200 flex items-center gap-2">
                    <ExternalLink className="size-4" />
                    ลิงก์ Line @ (URL เต็ม)
                  </Label>
                  <Input
                    value={settings.line_support_url}
                    onChange={(e) => updateField('line_support_url', e.target.value)}
                    placeholder="https://line.me/R/ti/p/@yourlineid"
                    className="bg-black/40 border-amber-500/30 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-amber-200">Line ID</Label>
                  <Input
                    value={settings.line_support_id}
                    onChange={(e) => updateField('line_support_id', e.target.value)}
                    placeholder="@yourlineid"
                    className="bg-black/40 border-amber-500/30 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-amber-200 flex items-center gap-2">
                    <Phone className="size-4" />
                    เบอร์โทรศัพท์
                  </Label>
                  <Input
                    value={settings.support_phone}
                    onChange={(e) => updateField('support_phone', e.target.value)}
                    placeholder="02-xxx-xxxx"
                    className="bg-black/40 border-amber-500/30 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-amber-200 flex items-center gap-2">
                    <Mail className="size-4" />
                    อีเมล
                  </Label>
                  <Input
                    type="email"
                    value={settings.support_email}
                    onChange={(e) => updateField('support_email', e.target.value)}
                    placeholder="support@example.com"
                    className="bg-black/40 border-amber-500/30 text-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Announcement Settings */}
        <TabsContent value="announcement">
          <Card className="bg-gradient-to-br from-black/80 to-neutral-900/80 border-2 border-amber-500/30 shadow-[0_0_30px_rgba(212,175,55,0.1)]">
            <CardHeader>
              <CardTitle className="text-amber-400 flex items-center gap-2">
                <Megaphone className="size-5" />
                ป๊อปอัพประกาศหน้าร้าน
              </CardTitle>
              <CardDescription>แสดงข้อความประกาศเมื่อลูกค้าเปิดหน้าเว็บ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-black/40 border border-amber-500/20">
                <div className="space-y-1">
                  <Label className="text-white font-medium">เปิดใช้งานป๊อปอัพประกาศ</Label>
                  <p className="text-sm text-neutral-400">แสดงป๊อปอัพเมื่อลูกค้าเข้าหน้าเว็บ</p>
                </div>
                <Switch
                  checked={settings.announcement_enabled}
                  onCheckedChange={(checked) => updateField('announcement_enabled', checked)}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>

              {settings.announcement_enabled && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-amber-200">หัวข้อประกาศ</Label>
                      <Input
                        value={settings.announcement_title}
                        onChange={(e) => updateField('announcement_title', e.target.value)}
                        placeholder="ประกาศสำคัญ"
                        className="bg-black/40 border-amber-500/30 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-amber-200">ประเภทประกาศ</Label>
                      <Select
                        value={settings.announcement_type}
                        onValueChange={(value) => updateField('announcement_type', value)}
                      >
                        <SelectTrigger className="bg-black/40 border-amber-500/30 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="info">
                            <span className="flex items-center gap-2">
                              <Info className="size-4 text-blue-400" />
                              ข้อมูล (สีฟ้า)
                            </span>
                          </SelectItem>
                          <SelectItem value="success">
                            <span className="flex items-center gap-2">
                              <CheckCircle className="size-4 text-green-400" />
                              สำเร็จ (สีเขียว)
                            </span>
                          </SelectItem>
                          <SelectItem value="warning">
                            <span className="flex items-center gap-2">
                              <AlertTriangle className="size-4 text-amber-400" />
                              เตือน (สีเหลือง)
                            </span>
                          </SelectItem>
                          <SelectItem value="error">
                            <span className="flex items-center gap-2">
                              <XCircle className="size-4 text-red-400" />
                              ด่วน (สีแดง)
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-amber-200">ข้อความประกาศ</Label>
                    <Textarea
                      value={settings.announcement_message}
                      onChange={(e) => updateField('announcement_message', e.target.value)}
                      placeholder="พิมพ์ข้อความประกาศที่ต้องการแสดงให้ลูกค้าเห็น..."
                      rows={4}
                      className="bg-black/40 border-amber-500/30 text-white resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-black/40 border border-amber-500/20">
                    <div className="space-y-1">
                      <Label className="text-white font-medium">อนุญาตให้ปิดได้</Label>
                      <p className="text-sm text-neutral-400">ลูกค้าสามารถกดปิดป๊อปอัพได้</p>
                    </div>
                    <Switch
                      checked={settings.announcement_dismissible}
                      onCheckedChange={(checked) => updateField('announcement_dismissible', checked)}
                      className="data-[state=checked]:bg-amber-500"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Promotions Settings */}
        <TabsContent value="promotions">
          <Card className="bg-gradient-to-br from-black/80 to-neutral-900/80 border-2 border-amber-500/30 shadow-[0_0_30px_rgba(212,175,55,0.1)]">
            <CardHeader>
              <CardTitle className="text-amber-400 flex items-center gap-2">
                <Image className="size-5" />
                แบนเนอร์โปรโมชั่น
              </CardTitle>
              <CardDescription>จัดการแบนเนอร์โปรโมชั่นบนหน้าเว็บ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-black/40 border border-amber-500/20">
                <div className="space-y-1">
                  <Label className="text-white font-medium">เปิดใช้งานแบนเนอร์โปรโมชั่น</Label>
                  <p className="text-sm text-neutral-400">แสดงแบนเนอร์โปรโมชั่นบนหน้าเว็บ</p>
                </div>
                <Switch
                  checked={settings.promotions_enabled}
                  onCheckedChange={(checked) => updateField('promotions_enabled', checked)}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>

              {settings.promotions_enabled && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-amber-200">URL รูปภาพแบนเนอร์</Label>
                    <Input
                      value={settings.promotions_banner_url}
                      onChange={(e) => updateField('promotions_banner_url', e.target.value)}
                      placeholder="https://example.com/banner.jpg"
                      className="bg-black/40 border-amber-500/30 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-amber-200">หัวข้อโปรโมชั่น</Label>
                      <Input
                        value={settings.promotions_title}
                        onChange={(e) => updateField('promotions_title', e.target.value)}
                        placeholder="โปรโมชั่นพิเศษ!"
                        className="bg-black/40 border-amber-500/30 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-amber-200">ลิงก์เมื่อคลิก</Label>
                      <Input
                        value={settings.promotions_link}
                        onChange={(e) => updateField('promotions_link', e.target.value)}
                        placeholder="https://example.com/promo"
                        className="bg-black/40 border-amber-500/30 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-amber-200">รายละเอียดโปรโมชั่น</Label>
                    <Textarea
                      value={settings.promotions_description}
                      onChange={(e) => updateField('promotions_description', e.target.value)}
                      placeholder="รายละเอียดโปรโมชั่น..."
                      rows={3}
                      className="bg-black/40 border-amber-500/30 text-white resize-none"
                    />
                  </div>

                  {settings.promotions_banner_url && (
                    <div className="space-y-2">
                      <Label className="text-amber-200">ตัวอย่างแบนเนอร์</Label>
                      <div className="rounded-lg overflow-hidden border border-amber-500/30 bg-black/40">
                        <img
                          src={settings.promotions_banner_url}
                          alt="Preview"
                          className="w-full h-auto max-h-[200px] object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Settings */}
        <TabsContent value="branding">
          <Card className="bg-gradient-to-br from-black/80 to-neutral-900/80 border-2 border-amber-500/30 shadow-[0_0_30px_rgba(212,175,55,0.1)]">
            <CardHeader>
              <CardTitle className="text-amber-400 flex items-center gap-2">
                <Palette className="size-5" />
                การตั้งค่าแบรนด์
              </CardTitle>
              <CardDescription>ปรับแต่งโลโก้และสีหลักของเว็บ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-amber-200">ชื่อแบรนด์</Label>
                  <Input
                    value={settings.brand_name}
                    onChange={(e) => updateField('brand_name', e.target.value)}
                    placeholder="ชื่อเว็บของคุณ"
                    className="bg-black/40 border-amber-500/30 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-amber-200">URL โลโก้</Label>
                  <Input
                    value={settings.brand_logo_url}
                    onChange={(e) => updateField('brand_logo_url', e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="bg-black/40 border-amber-500/30 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-amber-200">สีหลัก (Primary)</Label>
                  <div className="flex gap-3">
                    <Input
                      type="color"
                      value={settings.brand_primary_color}
                      onChange={(e) => updateField('brand_primary_color', e.target.value)}
                      className="w-16 h-10 p-1 bg-black/40 border-amber-500/30 cursor-pointer"
                    />
                    <Input
                      value={settings.brand_primary_color}
                      onChange={(e) => updateField('brand_primary_color', e.target.value)}
                      placeholder="#D4AF37"
                      className="bg-black/40 border-amber-500/30 text-white flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-amber-200">สีรอง (Secondary)</Label>
                  <div className="flex gap-3">
                    <Input
                      type="color"
                      value={settings.brand_secondary_color}
                      onChange={(e) => updateField('brand_secondary_color', e.target.value)}
                      className="w-16 h-10 p-1 bg-black/40 border-amber-500/30 cursor-pointer"
                    />
                    <Input
                      value={settings.brand_secondary_color}
                      onChange={(e) => updateField('brand_secondary_color', e.target.value)}
                      placeholder="#1a1a1a"
                      className="bg-black/40 border-amber-500/30 text-white flex-1"
                    />
                  </div>
                </div>
              </div>

              {settings.brand_logo_url && (
                <div className="space-y-2">
                  <Label className="text-amber-200">ตัวอย่างโลโก้</Label>
                  <div className="p-6 rounded-lg border border-amber-500/30 bg-black/40 flex items-center justify-center">
                    <img
                      src={settings.brand_logo_url}
                      alt="Logo Preview"
                      className="max-h-[80px] object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Core System Lock Notice */}
      <div className="mt-8 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
        <Shield className="size-5 text-red-500 shrink-0" />
        <p className="text-red-300 text-sm">
          <strong>ระบบล็อกความปลอดภัย:</strong> การตั้งค่าระดับโครงสร้างหลัก (API คาสิโน, ผลรางวัล, รอบหวยใหญ่) ถูกจำกัดสิทธิ์ไว้ที่เว็บแม่เท่านั้น
        </p>
      </div>
    </div>
  );
}
