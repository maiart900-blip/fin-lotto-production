'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageUploadField } from '@/components/image-upload-field';
import { ImageUrlUpload } from '@/components/image-url-upload';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings,
  Palette,
  Image,
  MessageSquare,
  MessageCircle,
  Bell,
  Gift,
  LayoutGrid,
  Loader2,
  Save,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  Pin,
  Sparkles,
  MonitorSmartphone,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface SiteSettings {
  id?: string;
  site_name: string;
  site_subtitle?: string;
  logo_url?: string;
  favicon_url?: string;
  login_background_url?: string;
  customer_background_url?: string;
  banner_url?: string;
  promo_banner_url?: string;
  splash_url?: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  button_color: string;
  text_color: string;
  sidebar_color: string;
  header_color: string;
  card_color: string;
  badge_color: string;
  hover_color: string;
  login_message?: string;
  register_message?: string;
  footer_message?: string;
  welcome_message?: string;
  topup_message?: string;
  payout_message?: string;
  rules_message?: string;
  // Contact settings
  line_id?: string;
  line_url?: string;
  line_qr_url?: string;
  phone_number?: string;
  telegram_url?: string;
  facebook_url?: string;
  contact_message?: string;
  error?: string;
}

interface Announcement {
  id: string;
  title: string;
  content?: string;
  announcement_type: string;
  display_style: string;
  icon?: string;
  color: string;
  is_pinned: boolean;
  is_active: boolean;
  display_pages: string[];
  start_date?: string;
  end_date?: string;
  sort_order: number;
}

interface Popup {
  id: string;
  title: string;
  content?: string;
  image_url?: string;
  button_text?: string;
  button_link?: string;
  display_page: string;
  display_mode: string;
  delay_seconds: number;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  sort_order: number;
}

interface SignupPromotion {
  id: string;
  title: string;
  is_active: boolean;
  free_credit_amount: number;
  start_date?: string;
  end_date?: string;
  limit_once_per_user: boolean;
  referral_only: boolean;
  message?: string;
  claims_count: number;
}

interface LotteryDisplay {
  id: string;
  name: string;
  display_settings: {
    display_order: number;
    is_visible: boolean;
    is_pinned: boolean;
    badge_text?: string;
    badge_color: string;
    card_color?: string;
    gradient_start?: string;
    gradient_end?: string;
    glow_enabled: boolean;
    glow_color?: string;
    // เพิ่มใหม่
    background_image?: string;
    font_family?: string;
    text_color?: string;
  };
}

const DEFAULT_SETTINGS: SiteSettings = {
  site_name: 'Lotto Agent',
  primary_color: '#dc2626',
  secondary_color: '#facc15',
  background_color: '#0a0a0a',
  button_color: '#dc2626',
  text_color: '#ffffff',
  sidebar_color: '#171717',
  header_color: '#171717',
  card_color: '#262626',
  badge_color: '#facc15',
  hover_color: '#dc2626',
};

export default function DesktopSettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [showPopupDialog, setShowPopupDialog] = useState(false);
  const [showPromoDialog, setShowPromoDialog] = useState(false);
  const [showLotteryDialog, setShowLotteryDialog] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [editingPopup, setEditingPopup] = useState<Popup | null>(null);
  const [editingPromo, setEditingPromo] = useState<SignupPromotion | null>(null);
  const [editingLottery, setEditingLottery] = useState<LotteryDisplay | null>(null);
  
  const { data: siteSettings, mutate: mutateSettings } = useSWR<SiteSettings>(
    '/api/site-settings',
    fetcher,
    {
      onSuccess: (data) => {
        if (data && !data.error) {
          setSettings(data);
        }
      }
    }
  );
  
  const { data: announcements = [], mutate: mutateAnnouncements } = useSWR<Announcement[]>(
    '/api/announcements',
    fetcher
  );
  
  const { data: popups = [], mutate: mutatePopups } = useSWR<Popup[]>(
    '/api/popups',
    fetcher
  );
  
  const { data: promotions = [], mutate: mutatePromotions } = useSWR<SignupPromotion[]>(
    '/api/signup-promotions',
    fetcher
  );
  
  const { data: lotteryDisplays = [], mutate: mutateLotteries } = useSWR<LotteryDisplay[]>(
    '/api/lottery-display',
    fetcher
  );
  
  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      
      if (!res.ok) throw new Error('Failed to save');
      
      toast.success('บันทึกการตั้งค่าสำเร็จ');
      mutateSettings();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };
  
  const handleSaveAnnouncement = async (data: Partial<Announcement>) => {
    try {
      const method = editingAnnouncement?.id ? 'PUT' : 'POST';
      const body = editingAnnouncement?.id ? { ...data, id: editingAnnouncement.id } : data;
      
      const res = await fetch('/api/announcements', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) throw new Error('Failed to save');
      
      toast.success('บันทึกประกาศสำเร็จ');
      mutateAnnouncements();
      setShowAnnouncementDialog(false);
      setEditingAnnouncement(null);
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };
  
  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('ยืนยันการลบประกาศนี้?')) return;
    
    try {
      const res = await fetch(`/api/announcements?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      
      toast.success('ลบประกาศสำเร็จ');
      mutateAnnouncements();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };
  
  const handleSavePopup = async (data: Partial<Popup>) => {
    try {
      const method = editingPopup?.id ? 'PUT' : 'POST';
      const body = editingPopup?.id ? { ...data, id: editingPopup.id } : data;
      
      const res = await fetch('/api/popups', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) throw new Error('Failed to save');
      
      toast.success('บันทึก Popup สำเร็จ');
      mutatePopups();
      setShowPopupDialog(false);
      setEditingPopup(null);
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };
  
  const handleDeletePopup = async (id: string) => {
    if (!confirm('ยืนยันการลบ Popup นี้?')) return;
    
    try {
      const res = await fetch(`/api/popups?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      
      toast.success('ลบ Popup สำเร็จ');
      mutatePopups();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };
  
  const handleSavePromotion = async (data: Partial<SignupPromotion>) => {
    try {
      const method = editingPromo?.id ? 'PUT' : 'POST';
      const body = editingPromo?.id ? { ...data, id: editingPromo.id } : data;
      
      const res = await fetch('/api/signup-promotions', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) throw new Error('Failed to save');
      
      toast.success('บันทึกโปรโมชั่นสำเร็จ');
      mutatePromotions();
      setShowPromoDialog(false);
      setEditingPromo(null);
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };
  
  const handleDeletePromotion = async (id: string) => {
    if (!confirm('ยืนยันการลบโปรโมชั่นนี้?')) return;
    
    try {
      const res = await fetch(`/api/signup-promotions?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      
      toast.success('ลบโปรโมชั่นสำเร็จ');
      mutatePromotions();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };
  
  const handleSaveLotteryDisplay = async (data: Partial<LotteryDisplay['display_settings']>) => {
    if (!editingLottery) return;
    
    try {
      const res = await fetch('/api/lottery-display', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lottery_id: editingLottery.id,
          ...data,
        }),
      });
      
      if (!res.ok) throw new Error('Failed to save');
      
      toast.success('บันทึกการแสดงผลสำเร็จ');
      mutateLotteries();
      setShowLotteryDialog(false);
      setEditingLottery(null);
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };
  
  const ColorInput = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-lg border cursor-pointer"
        style={{ backgroundColor: value }}
        onClick={() => document.getElementById(`color-${label}`)?.click()}
      />
      <div className="flex-1">
        <Label className="text-sm">{label}</Label>
        <div className="flex items-center gap-2 mt-1">
          <Input
            id={`color-${label}`}
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-12 h-8 p-0 border-0"
          />
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-24 h-8 font-mono text-sm"
          />
        </div>
      </div>
    </div>
  );
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MonitorSmartphone className="size-6" />
            ตั้งค่าหน้าเว็บ
          </h1>
          <p className="text-muted-foreground">จัดการรูปลักษณ์และการแสดงผลของเว็บไซต์</p>
        </div>
        <Button onClick={handleSaveSettings} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
          บันทึกการตั้งค่า
        </Button>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-7 w-full max-w-4xl">
          <TabsTrigger value="general" className="flex items-center gap-1">
            <Settings className="size-4" />
            <span className="hidden sm:inline">ทั่วไป</span>
          </TabsTrigger>
          <TabsTrigger value="colors" className="flex items-center gap-1">
            <Palette className="size-4" />
            <span className="hidden sm:inline">สี</span>
          </TabsTrigger>
          <TabsTrigger value="images" className="flex items-center gap-1">
            <Image className="size-4" />
            <span className="hidden sm:inline">รูปภาพ</span>
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-1">
            <MessageSquare className="size-4" />
            <span className="hidden sm:inline">ข้อความ</span>
          </TabsTrigger>
          <TabsTrigger value="contact" className="flex items-center gap-1">
            <MessageCircle className="size-4" />
            <span className="hidden sm:inline">ติดต่อ</span>
          </TabsTrigger>
          <TabsTrigger value="announcements" className="flex items-center gap-1">
            <Bell className="size-4" />
            <span className="hidden sm:inline">ประกาศ</span>
          </TabsTrigger>
          <TabsTrigger value="lottery" className="flex items-center gap-1">
            <LayoutGrid className="size-4" />
            <span className="hidden sm:inline">หวย</span>
          </TabsTrigger>
        </TabsList>
        
        {/* General Settings */}
        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>ตั้งค่าทั่วไป</CardTitle>
              <CardDescription>ชื่อเว็บไซต์และข้อมูลพื้นฐาน</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>ชื่อเว็บไซต์</Label>
                  <Input
                    value={settings.site_name}
                    onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
                    placeholder="Lotto Agent"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>ชื่อรอง</Label>
                  <Input
                    value={settings.site_subtitle || ''}
                    onChange={(e) => setSettings({ ...settings, site_subtitle: e.target.value })}
                    placeholder="แทงหวยออนไลน์"
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Signup Promotions */}
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="size-5" />
                  โปรโมชั่นสมัครสมาชิก
                </CardTitle>
                <CardDescription>จัดการ���ปรโมชั่นแจกเครดิตฟรีสำหร��บสมาชิกใหม่</CardDescription>
              </div>
              <Button onClick={() => { setEditingPromo(null); setShowPromoDialog(true); }}>
                <Plus className="size-4 mr-2" />
                เพิ่มโปรโมชั่น
              </Button>
            </CardHeader>
            <CardContent>
              {promotions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  ยังไม่มีโปรโมชั่น
                </div>
              ) : (
                <div className="space-y-3">
                  {promotions.map((promo) => (
                    <div key={promo.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Gift className="size-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{promo.title}</span>
                            <Badge variant={promo.is_active ? 'default' : 'secondary'}>
                              {promo.is_active ? 'เปิดใช้งาน' : 'ปิด'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            เครดิตฟรี {promo.free_credit_amount.toLocaleString()} บาท
                            {promo.referral_only && ' (เฉพาะแนะนำเพื่อน)'}
                            {' • '}ใช้ไปแล้ว {promo.claims_count} คน
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditingPromo(promo); setShowPromoDialog(true); }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePromotion(promo.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Colors Settings */}
        <TabsContent value="colors" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>ตั้งค่าสี</CardTitle>
              <CardDescription>ปรับแต่งสีของเว็บไซต์</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <ColorInput
                  label="สีหลัก (Primary)"
                  value={settings.primary_color}
                  onChange={(v) => setSettings({ ...settings, primary_color: v })}
                />
                <ColorInput
                  label="สีรอง (Secondary)"
                  value={settings.secondary_color}
                  onChange={(v) => setSettings({ ...settings, secondary_color: v })}
                />
                <ColorInput
                  label="สีพื้นหลัง"
                  value={settings.background_color}
                  onChange={(v) => setSettings({ ...settings, background_color: v })}
                />
                <ColorInput
                  label="สีปุ่ม"
                  value={settings.button_color}
                  onChange={(v) => setSettings({ ...settings, button_color: v })}
                />
                <ColorInput
                  label="สีตัวอักษร"
                  value={settings.text_color}
                  onChange={(v) => setSettings({ ...settings, text_color: v })}
                />
                <ColorInput
                  label="สี Sidebar"
                  value={settings.sidebar_color}
                  onChange={(v) => setSettings({ ...settings, sidebar_color: v })}
                />
                <ColorInput
                  label="สี Header"
                  value={settings.header_color}
                  onChange={(v) => setSettings({ ...settings, header_color: v })}
                />
                <ColorInput
                  label="สีการ์ด"
                  value={settings.card_color}
                  onChange={(v) => setSettings({ ...settings, card_color: v })}
                />
                <ColorInput
                  label="สี Badge"
                  value={settings.badge_color}
                  onChange={(v) => setSettings({ ...settings, badge_color: v })}
                />
                <ColorInput
                  label="สี Hover"
                  value={settings.hover_color}
                  onChange={(v) => setSettings({ ...settings, hover_color: v })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Images Settings */}
        <TabsContent value="images" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>รูปภาพ</CardTitle>
              <CardDescription>อัปโหลดโลโก้และรูปภาพต่างๆ (รูปจะไม่หมดอายุเมื่ออัปโหลดผ่านระบบ)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <ImageUploadField
                  label="โลโก้"
                  description="แนะนำ: 200x60 px (PNG/SVG)"
                  value={settings.logo_url || ''}
                  onChange={(url) => setSettings({ ...settings, logo_url: url })}
                  folder="site-images/logo"
                />
                <ImageUploadField
                  label="Favicon"
                  description="แนะนำ: 32x32 px หรือ 64x64 px (ICO/PNG)"
                  value={settings.favicon_url || ''}
                  onChange={(url) => setSettings({ ...settings, favicon_url: url })}
                  folder="site-images/favicon"
                />
                <ImageUploadField
                  label="พื้นหลังหน้าล็อกอิน"
                  description="แนะนำ: 1920x1080 px (JPG/WebP) ขนาดไฟล์ไม่เกิน 500KB"
                  value={settings.login_background_url || ''}
                  onChange={(url) => setSettings({ ...settings, login_background_url: url })}
                  folder="site-images/background"
                />
                <ImageUploadField
                  label="พื้นหลังหน้าลูกค้า"
                  description="แนะนำ: 1920x1080 px (JPG/WebP) ขนาดไฟล์ไม่เกิน 500KB"
                  value={settings.customer_background_url || ''}
                  onChange={(url) => setSettings({ ...settings, customer_background_url: url })}
                  folder="site-images/background"
                />
                <ImageUploadField
                  label="แบนเนอร์หลัก"
                  description="แนะนำ: 1200x400 px หรือ 3:1 ratio (JPG/WebP)"
                  value={settings.banner_url || ''}
                  onChange={(url) => setSettings({ ...settings, banner_url: url })}
                  folder="site-images/banner"
                />
                <ImageUploadField
                  label="แบนเนอร์โปรโมชั่น"
                  description="แนะนำ: 1200x400 px หรือ 3:1 ratio (JPG/WebP)"
                  value={settings.promo_banner_url || ''}
                  onChange={(url) => setSettings({ ...settings, promo_banner_url: url })}
                  folder="site-images/banner"
                />
                <ImageUploadField
                  label="Splash Screen"
                  description="แนะนำ: 1080x1920 px สำหรับมือถือ (JPG/PNG)"
                  value={settings.splash_url || ''}
                  onChange={(url) => setSettings({ ...settings, splash_url: url })}
                  folder="site-images/splash"
                />
              </div>
              
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mt-4">
                <h4 className="font-medium text-amber-500 mb-2">คำแนะนำขนาดรูปภาพ</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>- โลโก้: 200x60 px (PNG/SVG พื้นหลังโปร่งใส)</li>
                  <li>- Favicon: 32x32 หรือ 64x64 px (ICO/PNG)</li>
                  <li>- พื้นหลัง: 1920x1080 px (JPG/WebP)</li>
                  <li>- แบนเนอร์: 1200x400 px หรือ ratio 3:1</li>
                  <li>- Splash: 1080x1920 px (รูปแนวตั้งสำหรับมือถือ)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Messages Settings */}
        <TabsContent value="messages" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>ข้อความ</CardTitle>
              <CardDescription>ข้อความที่แสดงในหน้าต่างๆ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>ข้อความหน้าล็อกอิน</Label>
                <Textarea
                  value={settings.login_message || ''}
                  onChange={(e) => setSettings({ ...settings, login_message: e.target.value })}
                  placeholder="ยินดีต้อนรับเข้าสู่ระบบ"
                  className="mt-1"
                  rows={2}
                />
              </div>
              <div>
                <Label>ข้อความหน้าสมัครสมาชิก</Label>
                <Textarea
                  value={settings.register_message || ''}
                  onChange={(e) => setSettings({ ...settings, register_message: e.target.value })}
                  placeholder="สมัครสมาชิกวันนี้รับโบนัสฟรี!"
                  className="mt-1"
                  rows={2}
                />
              </div>
              <div>
                <Label>ข้อความต้อนรับ</Label>
                <Textarea
                  value={settings.welcome_message || ''}
                  onChange={(e) => setSettings({ ...settings, welcome_message: e.target.value })}
                  placeholder="ยินดีต้อนรับสู่ระบบแทงหวยออนไลน์"
                  className="mt-1"
                  rows={2}
                />
              </div>
              <div>
                <Label>ข้อความหน้าเติมเงิน</Label>
                <Textarea
                  value={settings.topup_message || ''}
                  onChange={(e) => setSettings({ ...settings, topup_message: e.target.value })}
                  placeholder="โอนเงินแล้วแจ้งภายใน 5 นาที"
                  className="mt-1"
                  rows={2}
                />
              </div>
              <div>
                <Label>ข้อความหน้าถอนเงิน</Label>
                <Textarea
                  value={settings.payout_message || ''}
                  onChange={(e) => setSettings({ ...settings, payout_message: e.target.value })}
                  placeholder="ถอนเงินขั้นต่ำ 100 บาท"
                  className="mt-1"
                  rows={2}
                />
              </div>
              <div>
                <Label>กฎและเงื่อนไข</Label>
                <Textarea
                  value={settings.rules_message || ''}
                  onChange={(e) => setSettings({ ...settings, rules_message: e.target.value })}
                  placeholder="กฎและเงื่อนไขการใช้งาน..."
                  className="mt-1"
                  rows={4}
                />
              </div>
              <div>
                <Label>ข้อความ Footer</Label>
                <Textarea
                  value={settings.footer_message || ''}
                  onChange={(e) => setSettings({ ...settings, footer_message: e.target.value })}
                  placeholder="© 2024 Lotto Agent. All rights reserved."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Settings */}
        <TabsContent value="contact" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>ช่องทางติดต่อ</CardTitle>
              <CardDescription>ตั้งค่าช่องทางติดต่อแอดมินสำหรับลูกค้า</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>LINE ID</Label>
                  <Input
                    value={settings.line_id || ''}
                    onChange={(e) => setSettings({ ...settings, line_id: e.target.value })}
                    placeholder="@yourlineid"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">ไม่ต้องใส��� @ นำหน้า</p>
                </div>
                <div>
                  <Label>LINE URL</Label>
                  <Input
                    value={settings.line_url || ''}
                    onChange={(e) => setSettings({ ...settings, line_url: e.target.value })}
                    placeholder="https://line.me/ti/p/..."
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>LINE QR Code URL</Label>
                <Input
                  value={settings.line_qr_url || ''}
                  onChange={(e) => setSettings({ ...settings, line_qr_url: e.target.value })}
                  placeholder="https://... (URL รูป QR Code)"
                  className="mt-1"
                />
                {settings.line_qr_url && (
                  <div className="mt-2">
                    <img src={settings.line_qr_url} alt="LINE QR" className="w-32 h-32 rounded border" />
                  </div>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>เบอร์โทรศัพท์</Label>
                  <Input
                    value={settings.phone_number || ''}
                    onChange={(e) => setSettings({ ...settings, phone_number: e.target.value })}
                    placeholder="0812345678"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Telegram URL</Label>
                  <Input
                    value={settings.telegram_url || ''}
                    onChange={(e) => setSettings({ ...settings, telegram_url: e.target.value })}
                    placeholder="https://t.me/..."
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Facebook URL</Label>
                <Input
                  value={settings.facebook_url || ''}
                  onChange={(e) => setSettings({ ...settings, facebook_url: e.target.value })}
                  placeholder="https://facebook.com/..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label>ข้อความหน้าติดต่อ</Label>
                <Textarea
                  value={settings.contact_message || ''}
                  onChange={(e) => setSettings({ ...settings, contact_message: e.target.value })}
                  placeholder="พร้อมให้บริการตลอด 24 ชั่วโมง"
                  className="mt-1"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Announcements & Popups */}
        <TabsContent value="announcements" className="mt-6 space-y-6">
          {/* Announcements */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>ประกาศ</CardTitle>
                <CardDescription>จัดการประกาศและแบนเนอร์แจ้งเตือน</CardDescription>
              </div>
              <Button onClick={() => { setEditingAnnouncement(null); setShowAnnouncementDialog(true); }}>
                <Plus className="size-4 mr-2" />
                เพิ่มประกาศ
              </Button>
            </CardHeader>
            <CardContent>
              {announcements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  ยังไม่มีประกาศ
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.map((ann) => (
                    <div key={ann.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-2 h-12 rounded-full"
                          style={{ backgroundColor: ann.color }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{ann.title}</span>
                            {ann.is_pinned && <Pin className="size-3 text-primary" />}
                            <Badge variant={ann.is_active ? 'default' : 'secondary'}>
                              {ann.is_active ? 'เปิด' : 'ปิด'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {ann.content || 'ไม่มีเนื้อหา'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditingAnnouncement(ann); setShowAnnouncementDialog(true); }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Popups */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Popup</CardTitle>
                <CardDescription>จัดการ Popup แจ้งเตือนและโปรโมชั่น</CardDescription>
              </div>
              <Button onClick={() => { setEditingPopup(null); setShowPopupDialog(true); }}>
                <Plus className="size-4 mr-2" />
                เพิ่ม Popup
              </Button>
            </CardHeader>
            <CardContent>
              {popups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  ยังไม่มี Popup
                </div>
              ) : (
                <div className="space-y-3">
                  {popups.map((popup) => (
                    <div key={popup.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        {popup.image_url ? (
                          <img src={popup.image_url} alt="" className="w-16 h-12 object-cover rounded" />
                        ) : (
                          <div className="w-16 h-12 bg-muted rounded flex items-center justify-center">
                            <Image className="size-6 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{popup.title}</span>
                            <Badge variant={popup.is_active ? 'default' : 'secondary'}>
                              {popup.is_active ? 'เปิด' : 'ปิด'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            แสดงที่: {popup.display_page === 'all' ? 'ทุกหน้า' : popup.display_page}
                            {' • '}
                            {popup.display_mode === 'once' ? 'แสดงครั้งเดียว' : 'แสดงทุกครั้ง'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditingPopup(popup); setShowPopupDialog(true); }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePopup(popup.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Lottery Display Settings */}
        <TabsContent value="lottery" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>การแสดงผลหวย</CardTitle>
              <CardDescription>ปรับแต่งลำดับและการแสดงผลของหวยแต่ละประเภท</CardDescription>
            </CardHeader>
            <CardContent>
              {lotteryDisplays.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  ไม่พบข้อมูลหวย
                </div>
              ) : (
                <div className="space-y-3">
                  {lotteryDisplays.map((lottery, index) => (
                    <div
                      key={lottery.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <GripVertical className="size-4" />
                          <span className="w-6 text-center">{index + 1}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{lottery.name}</span>
                            {lottery.display_settings?.is_pinned && (
                              <Pin className="size-3 text-primary" />
                            )}
                            {lottery.display_settings?.badge_text && (
                              <Badge
                                style={{ backgroundColor: lottery.display_settings.badge_color }}
                              >
                                {lottery.display_settings.badge_text}
                              </Badge>
                            )}
                            {lottery.display_settings?.glow_enabled && (
                              <Sparkles className="size-3 text-yellow-500" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {lottery.display_settings?.is_visible ? (
                              <Badge variant="outline" className="text-xs">
                                <Eye className="size-3 mr-1" />
                                แสดง
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                <EyeOff className="size-3 mr-1" />
                                ซ่อน
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEditingLottery(lottery); setShowLotteryDialog(true); }}
                      >
                        <Pencil className="size-4 mr-2" />
                        แก้ไข
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Announcement Dialog */}
      <AnnouncementDialog
        open={showAnnouncementDialog}
        onClose={() => { setShowAnnouncementDialog(false); setEditingAnnouncement(null); }}
        announcement={editingAnnouncement}
        onSave={handleSaveAnnouncement}
      />
      
      {/* Popup Dialog */}
      <PopupDialog
        open={showPopupDialog}
        onClose={() => { setShowPopupDialog(false); setEditingPopup(null); }}
        popup={editingPopup}
        onSave={handleSavePopup}
      />
      
      {/* Promotion Dialog */}
      <PromotionDialog
        open={showPromoDialog}
        onClose={() => { setShowPromoDialog(false); setEditingPromo(null); }}
        promotion={editingPromo}
        onSave={handleSavePromotion}
      />
      
      {/* Lottery Display Dialog */}
      <LotteryDisplayDialog
        open={showLotteryDialog}
        onClose={() => { setShowLotteryDialog(false); setEditingLottery(null); }}
        lottery={editingLottery}
        onSave={handleSaveLotteryDisplay}
      />
    </div>
  );
}

// Announcement Dialog Component
function AnnouncementDialog({
  open,
  onClose,
  announcement,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  announcement: Announcement | null;
  onSave: (data: Partial<Announcement>) => void;
}) {
  const [formData, setFormData] = useState<Partial<Announcement>>({
    title: '',
    content: '',
    announcement_type: 'info',
    display_style: 'banner',
    color: '#dc2626',
    is_pinned: false,
    is_active: true,
    display_pages: ['customer'],
    sort_order: 0,
  });
  
  useState(() => {
    if (announcement) {
      setFormData(announcement);
    }
  });
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{announcement ? 'แก้ไขประกาศ' : 'เพิ่มประกาศใหม่'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>หัวข้อ</Label>
            <Input
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label>เนื้อหา</Label>
            <Textarea
              value={formData.content || ''}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="mt-1"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>ประเภท</Label>
              <Select
                value={formData.announcement_type}
                onValueChange={(v) => setFormData({ ...formData, announcement_type: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">ข้อมูล</SelectItem>
                  <SelectItem value="warning">แจ้งเตือน</SelectItem>
                  <SelectItem value="success">สำเร็จ</SelectItem>
                  <SelectItem value="error">ข้อผิดพลาด</SelectItem>
                  <SelectItem value="promo">โปรโมชั่น</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>สี</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="color"
                  value={formData.color || '#dc2626'}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-12 h-9 p-0"
                />
                <Input
                  value={formData.color || '#dc2626'}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
              <Label>เปิดใช้งาน</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_pinned}
                onCheckedChange={(v) => setFormData({ ...formData, is_pinned: v })}
              />
              <Label>ปักหมุด</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={() => onSave(formData)}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Popup Dialog Component
function PopupDialog({
  open,
  onClose,
  popup,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  popup: Popup | null;
  onSave: (data: Partial<Popup>) => void;
}) {
  const [formData, setFormData] = useState<Partial<Popup>>({
    title: '',
    content: '',
    image_url: '',
    button_text: '',
    button_link: '',
    display_page: 'all',
    display_mode: 'once',
    delay_seconds: 0,
    is_active: true,
    sort_order: 0,
  });
  
  useState(() => {
    if (popup) {
      setFormData(popup);
    }
  });
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{popup ? 'แก้ไข Popup' : 'เพิ่ม Popup ใหม่'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>หัวข้อ</Label>
            <Input
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label>เนื้อหา</Label>
            <Textarea
              value={formData.content || ''}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="mt-1"
              rows={3}
            />
          </div>
          <div>
            <Label>URL รูปภาพ</Label>
            <Input
              value={formData.image_url || ''}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              className="mt-1"
              placeholder="https://example.com/image.jpg"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>ข้อความปุ่ม</Label>
              <Input
                value={formData.button_text || ''}
                onChange={(e) => setFormData({ ...formData, button_text: e.target.value })}
                className="mt-1"
                placeholder="คลิกที่นี่"
              />
            </div>
            <div>
              <Label>ลิงก์ปุ่ม</Label>
              <Input
                value={formData.button_link || ''}
                onChange={(e) => setFormData({ ...formData, button_link: e.target.value })}
                className="mt-1"
                placeholder="/promo"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>แสดงที่หน้า</Label>
              <Select
                value={formData.display_page}
                onValueChange={(v) => setFormData({ ...formData, display_page: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกหน้า</SelectItem>
                  <SelectItem value="home">หน้าหลัก</SelectItem>
                  <SelectItem value="buy">หน้าซื้อเลข</SelectItem>
                  <SelectItem value="topup">หน้าเติมเงิน</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>โหมดแสดง</Label>
              <Select
                value={formData.display_mode}
                onValueChange={(v) => setFormData({ ...formData, display_mode: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">แสดงครั้งเดียว</SelectItem>
                  <SelectItem value="always">แสดงทุกครั้ง</SelectItem>
                  <SelectItem value="session">ทุก Session</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.is_active}
              onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
            />
            <Label>เปิดใช้งาน</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={() => onSave(formData)}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Promotion Dialog Component
function PromotionDialog({
  open,
  onClose,
  promotion,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  promotion: SignupPromotion | null;
  onSave: (data: Partial<SignupPromotion>) => void;
}) {
  const [formData, setFormData] = useState<Partial<SignupPromotion>>({
    title: '',
    free_credit_amount: 0,
    is_active: false,
    limit_once_per_user: true,
    referral_only: false,
    message: '',
  });
  
  useState(() => {
    if (promotion) {
      setFormData(promotion);
    }
  });
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{promotion ? 'แก้ไขโปรโมชั่น' : 'เพิ่มโปรโมชั่นใ��ม่'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>ชื่อโปรโมชั่น</Label>
            <Input
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-1"
              placeholder="สมัครใหม่รับฟรี 100 บาท"
            />
          </div>
          <div>
            <Label>จำนวนเครดิตฟรี (บาท)</Label>
            <Input
              type="number"
              value={formData.free_credit_amount || 0}
              onChange={(e) => setFormData({ ...formData, free_credit_amount: Number(e.target.value) })}
              className="mt-1"
            />
          </div>
          <div>
            <Label>ข้อความโปรโมชั่น</Label>
            <Textarea
              value={formData.message || ''}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="mt-1"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>วันเริ่มต้น</Label>
              <Input
                type="date"
                value={formData.start_date || ''}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>วันสิ้นสุด</Label>
              <Input
                type="date"
                value={formData.end_date || ''}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
              <Label>เปิดใช้งาน</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.limit_once_per_user}
                onCheckedChange={(v) => setFormData({ ...formData, limit_once_per_user: v })}
              />
              <Label>จำกัด 1 ครั้งต่อผู้ใช้</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.referral_only}
                onCheckedChange={(v) => setFormData({ ...formData, referral_only: v })}
              />
              <Label>เฉพาะผู้แนะนำ</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={() => onSave(formData)}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Lottery Display Dialog Component
function LotteryDisplayDialog({
  open,
  onClose,
  lottery,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  lottery: LotteryDisplay | null;
  onSave: (data: Partial<LotteryDisplay['display_settings']>) => void;
}) {
  const [formData, setFormData] = useState<Partial<LotteryDisplay['display_settings']>>({
    display_order: 0,
    is_visible: true,
    is_pinned: false,
    badge_text: '',
    badge_color: '#facc15',
    card_color: '',
    gradient_start: '',
    gradient_end: '',
    glow_enabled: false,
    glow_color: '',
    background_image: '',
    font_family: '',
    text_color: '',
    stream_url: '',
    stream_type: 'youtube',
  });
  
  useEffect(() => {
    if (lottery?.display_settings) {
      setFormData(lottery.display_settings);
    }
  }, [lottery]);
  
  if (!lottery) return null;
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>ตั้งค่าการแสดงผล: {lottery.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>ลำดับการแสดง</Label>
              <Input
                type="number"
                value={formData.display_order || 0}
                onChange={(e) => setFormData({ ...formData, display_order: Number(e.target.value) })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Badge Text</Label>
              <Input
                value={formData.badge_text || ''}
                onChange={(e) => setFormData({ ...formData, badge_text: e.target.value })}
                className="mt-1"
                placeholder="HOT, NEW, etc."
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Badge Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="color"
                  value={formData.badge_color || '#facc15'}
                  onChange={(e) => setFormData({ ...formData, badge_color: e.target.value })}
                  className="w-12 h-9 p-0"
                />
                <Input
                  value={formData.badge_color || '#facc15'}
                  onChange={(e) => setFormData({ ...formData, badge_color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <Label>Card Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="color"
                  value={formData.card_color || '#262626'}
                  onChange={(e) => setFormData({ ...formData, card_color: e.target.value })}
                  className="w-12 h-9 p-0"
                />
                <Input
                  value={formData.card_color || ''}
                  onChange={(e) => setFormData({ ...formData, card_color: e.target.value })}
                  className="flex-1"
                  placeholder="ใช้ค่าเริ่มต้น"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Gradient Start</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="color"
                  value={formData.gradient_start || '#dc2626'}
                  onChange={(e) => setFormData({ ...formData, gradient_start: e.target.value })}
                  className="w-12 h-9 p-0"
                />
                <Input
                  value={formData.gradient_start || ''}
                  onChange={(e) => setFormData({ ...formData, gradient_start: e.target.value })}
                  className="flex-1"
                  placeholder="ไม่ใช้ gradient"
                />
              </div>
            </div>
            <div>
              <Label>Gradient End</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="color"
                  value={formData.gradient_end || '#facc15'}
                  onChange={(e) => setFormData({ ...formData, gradient_end: e.target.value })}
                  className="w-12 h-9 p-0"
                />
                <Input
                  value={formData.gradient_end || ''}
                  onChange={(e) => setFormData({ ...formData, gradient_end: e.target.value })}
                  className="flex-1"
                  placeholder="ไม่ใช้ gradient"
                />
              </div>
            </div>
          </div>
          
          {/* Background Image & Text Settings */}
          <div className="space-y-4 pt-4 border-t">
            <div>
              <Label>ภาพพื้นหลังการ์ด</Label>
              <ImageUrlUpload
                value={formData.background_image || ''}
                onChange={(url) => setFormData({ ...formData, background_image: url })}
                placeholder="URL รูปภาพพื้นหลัง (ถ้าไม่ใส่จะใช้สีพื้นหลัง)"
                folder="lotto-cards"
              />
              <p className="text-xs text-muted-foreground mt-1">แนะนำขนาด 400x200 px หรือ 2:1 ratio</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ฟอนต์ตัวหนังสือ</Label>
                <select
                  value={formData.font_family || ''}
                  onChange={(e) => setFormData({ ...formData, font_family: e.target.value })}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">ใช้ค่าเริ่มต้น</option>
                  <option value="Prompt">Prompt (ไทย)</option>
                  <option value="Sarabun">Sarabun (ไทย)</option>
                  <option value="Kanit">Kanit (ไทย)</option>
                  <option value="Mitr">Mitr (ไทย)</option>
                  <option value="Noto Sans Thai">Noto Sans Thai</option>
                  <option value="Inter">Inter</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Poppins">Poppins</option>
                </select>
              </div>
              <div>
                <Label>สีตัวหนังสือ</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="color"
                    value={formData.text_color || '#ffffff'}
                    onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                    className="w-12 h-9 p-0"
                  />
                  <Input
                    value={formData.text_color || ''}
                    onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                    className="flex-1"
                    placeholder="ใช้ค่าเริ่มต้น (#ffffff)"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_visible}
                onCheckedChange={(v) => setFormData({ ...formData, is_visible: v })}
              />
              <Label>แสดงผล</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_pinned}
                onCheckedChange={(v) => setFormData({ ...formData, is_pinned: v })}
              />
              <Label>ปักหมุด (แสดงด้านบนสุด)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.glow_enabled}
                onCheckedChange={(v) => setFormData({ ...formData, glow_enabled: v })}
              />
              <Label>เอฟเฟกต์ Glow</Label>
            </div>
          </div>
          {formData.glow_enabled && (
            <div>
              <Label>Glow Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="color"
                  value={formData.glow_color || '#facc15'}
                  onChange={(e) => setFormData({ ...formData, glow_color: e.target.value })}
                  className="w-12 h-9 p-0"
                />
                <Input
                  value={formData.glow_color || ''}
                  onChange={(e) => setFormData({ ...formData, glow_color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
          )}
          
          {/* Live Stream Settings */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-medium text-sm">Live Draw (ถ่ายทอดสด)</h4>
            <div>
              <Label>ประเภท Stream</Label>
              <select
                value={formData.stream_type || 'youtube'}
                onChange={(e) => setFormData({ ...formData, stream_type: e.target.value })}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="youtube">YouTube Live</option>
                <option value="facebook">Facebook Live</option>
                <option value="custom">Custom URL (iframe)</option>
              </select>
            </div>
            <div>
              <Label>Stream URL / Video ID</Label>
              <Input
                value={formData.stream_url || ''}
                onChange={(e) => setFormData({ ...formData, stream_url: e.target.value })}
                className="mt-1"
                placeholder={
                  formData.stream_type === 'youtube' 
                    ? 'เช่น dQw4w9WgXcQ หรือ https://www.youtube.com/watch?v=...'
                    : formData.stream_type === 'facebook'
                    ? 'https://www.facebook.com/...'
                    : 'https://...'
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formData.stream_type === 'youtube' && 'ใส่ Video ID หรือ URL เต็ม จะแปลงเป็น embed อัตโนมัติ'}
                {formData.stream_type === 'facebook' && 'ใส่ URL ของ Facebook Live'}
                {formData.stream_type === 'custom' && 'ใส่ URL ที่รองรับ iframe embed'}
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={() => onSave(formData)}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
