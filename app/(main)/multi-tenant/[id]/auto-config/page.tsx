'use client';

import { useState, use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Crown,
  ArrowLeft,
  Zap,
  CreditCard,
  QrCode,
  Bot,
  Search,
  Calendar,
  Shield,
  Loader2,
  CheckCircle,
  XCircle,
  Settings,
  Sparkles,
  Power,
  RefreshCw,
  Globe,
  Wallet,
  Building2,
  Clock,
  Eye,
  Megaphone,
  History,
  User,
  FileText,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface FeatureConfig {
  feature_key: string;
  is_enabled: boolean;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'master' | 'payment' | 'bot' | 'search' | 'marketing';
}

const FEATURE_CONFIGS: Omit<FeatureConfig, 'is_enabled'>[] = [
  // Master Access
  {
    feature_key: 'lottery_auto',
    label: 'ระบบออโต้หลัก (Master Switch)',
    description: 'เปิด-ปิดสิทธิ์การเป็นเอเย่นต์ออโต้ทั้งระบบ',
    icon: <Power className="size-5" />,
    category: 'master',
  },
  {
    feature_key: 'slots',
    label: 'ระบบสล็อต',
    description: 'เปิด-ปิดการเข้าถึงเกมสล็อตออนไลน์',
    icon: <Sparkles className="size-5" />,
    category: 'master',
  },
  {
    feature_key: 'casino',
    label: 'ระบบคาสิโน',
    description: 'เปิด-ปิดการเข้าถึงเกมคาสิโนสด',
    icon: <Crown className="size-5" />,
    category: 'master',
  },
  // Payment Gateway
  {
    feature_key: 'payment_gateway',
    label: 'ท่อ API รับยอดฝากเงิน',
    description: 'เปิด-ปิดระบบรับชำระเงินผ่าน QR Code / PromptPay',
    icon: <QrCode className="size-5" />,
    category: 'payment',
  },
  {
    feature_key: 'auto_deposit',
    label: 'ฝากเงินอัตโนมัติ',
    description: 'ระบบเติมเครดิตอัตโนมัติเมื่อตรวจพบการโอนเงิน',
    icon: <Wallet className="size-5" />,
    category: 'payment',
  },
  {
    feature_key: 'auto_withdraw',
    label: 'ถอนเงินอัตโนมัติ',
    description: 'ระบบอนุมัติถอนเงินอัตโนมัติตามเงื่อนไขที่กำหนด',
    icon: <CreditCard className="size-5" />,
    category: 'payment',
  },
  // Auto Slip Bot
  {
    feature_key: 'auto_slip_bot',
    label: 'บอทสแกนสลิป',
    description: 'ระบบ AI ตรวจสอบสลิปอัตโนมัติภายใน 1 นาที',
    icon: <Bot className="size-5" />,
    category: 'bot',
  },
  {
    feature_key: 'slip_ocr',
    label: 'ระบบ OCR อ่านสลิป',
    description: 'แปลงภาพสลิปเป็นข้อความด้วย AI',
    icon: <Eye className="size-5" />,
    category: 'bot',
  },
  {
    feature_key: 'duplicate_detection',
    label: 'ตรวจจับสลิปซ้ำ',
    description: 'ป้องกันการใช้สลิปเดิมซ้ำหลายครั้ง',
    icon: <Shield className="size-5" />,
    category: 'bot',
  },
  // Advanced Search
  {
    feature_key: 'advanced_search',
    label: 'ค้นหาขั้นสูง วัน/เดือน/ปี/เวลา',
    description: 'สิทธิ์ใช้ตัวกรองประวัติธุรกรรมแบบละเอียด',
    icon: <Calendar className="size-5" />,
    category: 'search',
  },
  {
    feature_key: 'export_reports',
    label: 'ส่งออกรายงาน',
    description: 'สิทธิ์ดาวน์โหลดรายงานเป็น Excel/PDF',
    icon: <Search className="size-5" />,
    category: 'search',
  },
  // Marketing Settings (NEW)
  {
    feature_key: 'tenant_marketing_settings',
    label: 'ตั้งค่าแบรนด์หน้าร้าน',
    description: 'อนุญาตให้เว็บลูกตั้งค่าเทิร์นโอเวอร์, ลิงก์ไลน์, และป๊อปอัพโปรโมชั่นด้วยตนเอง',
    icon: <Megaphone className="size-5" />,
    category: 'marketing',
  },
  {
    feature_key: 'tenant_turnover_settings',
    label: 'ตั้งค่าเทิร์นโอเวอร์',
    description: 'สิทธิ์กำหนดเงื่อนไขบังคับทำยอดก่อนถอน',
    icon: <Settings className="size-5" />,
    category: 'marketing',
  },
  {
    feature_key: 'tenant_support_settings',
    label: 'ตั้งค่าลิงก์ซัพพอร์ต',
    description: 'สิทธิ์เปลี่ยน Line @, เบอร์โทร, อีเมลติดต่อ',
    icon: <FileText className="size-5" />,
    category: 'marketing',
  },
  {
    feature_key: 'tenant_announcement_settings',
    label: 'ตั้งค่าประกาศป๊อปอัพ',
    description: 'สิทธิ์สร้างและจัดการประกาศหน้าร้าน',
    icon: <Globe className="size-5" />,
    category: 'marketing',
  },
];

const CATEGORY_LABELS = {
  master: { title: 'สิทธิ์เข้าถึงระบบออโต้หลัก', icon: <Zap className="size-5" /> },
  payment: { title: 'ระบบเกทเวย์การเงิน (Payment Gateway)', icon: <CreditCard className="size-5" /> },
  bot: { title: 'บอทออโต้อ่านสลิป (Auto Slip Bot)', icon: <Bot className="size-5" /> },
  search: { title: 'ระบบค้นหาขั้นสูง', icon: <Search className="size-5" /> },
  marketing: { title: 'ตั้งค่าแบรนด์และการตลาดหน้าร้าน', icon: <Megaphone className="size-5" /> },
};

export default function TenantAutoConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tenantId } = use(params);
  const [savingFeature, setSavingFeature] = useState<string | null>(null);
  
  // Fetch tenant info
  const { data: tenantData, mutate: mutateTenant } = useSWR(`/api/tenants/${tenantId}`, fetcher);
  
  // Fetch tenant features
  const { data: featuresData, mutate: mutateFeatures } = useSWR(
    `/api/tenants/${tenantId}/features`,
    fetcher
  );
  
  // Fetch audit logs for this tenant's feature changes
  const { data: auditLogsData } = useSWR(
    `/api/audit-logs?entity_type=tenant_features&tenant_id=${tenantId}&limit=20`,
    fetcher
  );
  
  const tenant = tenantData?.tenant;
  const features = featuresData?.features || [];
  const auditLogs = auditLogsData?.data || [];
  
  // Get feature status
  const getFeatureStatus = (featureKey: string): boolean => {
    const feature = features.find((f: { feature_key: string; is_enabled: boolean }) => f.feature_key === featureKey);
    return feature?.is_enabled ?? false;
  };
  
  // Toggle feature
  const handleToggleFeature = async (featureKey: string, newValue: boolean) => {
    setSavingFeature(featureKey);
    
    try {
      const res = await fetch(`/api/tenants/${tenantId}/features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature_key: featureKey,
          is_enabled: newValue,
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success(
          newValue ? 'เปิดใช้งานสำเร็จ' : 'ปิดใช้งานสำเร็จ',
          {
            description: `${featureKey} ${newValue ? 'พร้อมใช้งานทันที' : 'ถูกปิดแล้ว'}`,
            style: { background: '#0a0a0a', border: '1px solid #D4AF37', color: '#fff' },
          }
        );
        mutateFeatures();
      } else {
        toast.error('เกิดข้อผิดพลาด', { description: data.error });
      }
    } catch {
      toast.error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setSavingFeature(null);
    }
  };
  
  // Render feature card
  const renderFeatureCard = (config: Omit<FeatureConfig, 'is_enabled'>) => {
    const isEnabled = getFeatureStatus(config.feature_key);
    const isSaving = savingFeature === config.feature_key;
    
    return (
      <div
        key={config.feature_key}
        className={`relative p-4 rounded-xl border transition-all duration-300 ${
          isEnabled
            ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/30'
            : 'bg-black/40 border-neutral-800/50 hover:border-neutral-700'
        }`}
      >
        {/* Status indicator */}
        <div className={`absolute top-3 right-3 size-2 rounded-full ${isEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-600'}`} />
        
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`p-3 rounded-xl ${isEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-400'}`}>
            {config.icon}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`font-semibold ${isEnabled ? 'text-white' : 'text-neutral-300'}`}>
                {config.label}
              </span>
              {isEnabled && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                  <CheckCircle className="size-3 mr-1" />
                  เปิดใช้งาน
                </Badge>
              )}
            </div>
            <p className="text-sm text-neutral-500">{config.description}</p>
          </div>
          
          {/* Toggle */}
          <div className="flex items-center gap-2">
            {isSaving && <Loader2 className="size-4 animate-spin text-amber-400" />}
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => handleToggleFeature(config.feature_key, checked)}
              disabled={isSaving}
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>
        </div>
      </div>
    );
  };
  
  // Group features by category
  const groupedFeatures = FEATURE_CONFIGS.reduce((acc, config) => {
    if (!acc[config.category]) acc[config.category] = [];
    acc[config.category].push(config);
    return acc;
  }, {} as Record<string, typeof FEATURE_CONFIGS>);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] via-[#0d0d0d] to-[#111111] p-6">
      {/* Ambient glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>
      
      <div className="relative max-w-5xl mx-auto space-y-6">
        {/* Back Button */}
        <Link href={`/multi-tenant/${tenantId}`}>
          <Button variant="ghost" className="text-neutral-400 hover:text-white">
            <ArrowLeft className="size-4 mr-2" />
            กลับหน้ารายละเอียด Tenant
          </Button>
        </Link>
        
        {/* Header */}
        <Card className="bg-gradient-to-br from-black/80 to-neutral-900/80 border-2 border-amber-500/30 backdrop-blur-sm shadow-2xl shadow-amber-500/10">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30">
                <Crown className="size-8 text-amber-400" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
                  การตั้งค่าระบบออโต้เว็บลูก
                </CardTitle>
                <CardDescription className="text-neutral-400 mt-1">
                  Tenant Auto Settings - ควบคุมฟีเจอร์ทั้งหมดแบบ Real-time
                </CardDescription>
              </div>
              
              {/* Tenant Info Badge */}
              {tenant && (
                <div className="text-right">
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 mb-1">
                    <Globe className="size-3 mr-1" />
                    {tenant.slug}
                  </Badge>
                  <p className="text-sm text-neutral-500">{tenant.name}</p>
                </div>
              )}
            </div>
          </CardHeader>
          
          <CardContent>
            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-black/40 border border-neutral-800">
                <div className="flex items-center gap-2 text-emerald-400 mb-1">
                  <CheckCircle className="size-4" />
                  <span className="text-sm">เปิดใช้งาน</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {features.filter((f: { is_enabled: boolean }) => f.is_enabled).length}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-black/40 border border-neutral-800">
                <div className="flex items-center gap-2 text-neutral-400 mb-1">
                  <XCircle className="size-4" />
                  <span className="text-sm">ปิดใช้งาน</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {features.filter((f: { is_enabled: boolean }) => !f.is_enabled).length}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-black/40 border border-neutral-800">
                <div className="flex items-center gap-2 text-amber-400 mb-1">
                  <Settings className="size-4" />
                  <span className="text-sm">ฟีเจอร์ทั้งหมด</span>
                </div>
                <p className="text-2xl font-bold text-white">{FEATURE_CONFIGS.length}</p>
              </div>
              <div className="p-4 rounded-xl bg-black/40 border border-neutral-800">
                <div className="flex items-center gap-2 text-blue-400 mb-1">
                  <Clock className="size-4" />
                  <span className="text-sm">อัปเดตล่าสุด</span>
                </div>
                <p className="text-sm font-medium text-white">เรียลไทม์</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Feature Categories */}
        {(['master', 'payment', 'bot', 'search', 'marketing'] as const).map((category) => (
          <Card
            key={category}
            className="bg-gradient-to-br from-black/60 to-neutral-900/60 border border-neutral-800/50 backdrop-blur-sm"
          >
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  category === 'master' ? 'bg-amber-500/20 text-amber-400' :
                  category === 'payment' ? 'bg-blue-500/20 text-blue-400' :
                  category === 'bot' ? 'bg-purple-500/20 text-purple-400' :
                  category === 'marketing' ? 'bg-pink-500/20 text-pink-400' :
                  'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {CATEGORY_LABELS[category].icon}
                </div>
                <div>
                  <CardTitle className="text-lg text-white">{CATEGORY_LABELS[category].title}</CardTitle>
                  <CardDescription className="text-neutral-500">
                    {category === 'master' && 'ควบคุมสิทธิ์หลักของระบบออโต้'}
                    {category === 'payment' && 'ท่อ API เชื่อมต่อระบบการเงิน'}
                    {category === 'bot' && 'ระบบบอทตรวจสอบสลิปอัตโนมัติ'}
                    {category === 'search' && 'เครื่องมือค้นหาและรายงานขั้นสูง'}
                    {category === 'marketing' && 'สิทธิ์ให้เว็บลูกตั้งค่าการตลาดเอง'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {groupedFeatures[category]?.map(renderFeatureCard)}
            </CardContent>
          </Card>
        ))}
        
        {/* Audit Log Table */}
        <Card className="bg-gradient-to-br from-black/60 to-neutral-900/60 border border-neutral-800/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                <History className="size-5" />
              </div>
              <div>
                <CardTitle className="text-lg text-white">ประวัติการเปลี่ยนแปลงฟีเจอร์</CardTitle>
                <CardDescription className="text-neutral-500">
                  บันทึกการสับสวิตช์โดย Super Admin (20 รายการล่าสุด)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                <History className="size-12 mx-auto mb-3 opacity-30" />
                <p>ยังไม่มีประวัติการเปลี่ยนแปลง</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-800">
                      <th className="text-left py-3 px-4 text-amber-400 font-semibold">วันที่/เวลา</th>
                      <th className="text-left py-3 px-4 text-amber-400 font-semibold">ผู้ดำเนินการ</th>
                      <th className="text-left py-3 px-4 text-amber-400 font-semibold">ฟีเจอร์</th>
                      <th className="text-left py-3 px-4 text-amber-400 font-semibold">การเปลี่ยนแปลง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log: {
                      id: string;
                      created_at: string;
                      user?: { display_name?: string; username?: string };
                      user_id?: string;
                      changes?: { feature_key?: string; previous_state?: boolean; new_state?: boolean };
                    }) => {
                      const featureKey = log.changes?.feature_key || '-';
                      const featureConfig = FEATURE_CONFIGS.find(f => f.feature_key === featureKey);
                      const prevState = log.changes?.previous_state;
                      const newState = log.changes?.new_state;
                      
                      return (
                        <tr key={log.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                          <td className="py-3 px-4 text-neutral-300 font-mono text-xs">
                            {new Date(log.created_at).toLocaleDateString('th-TH', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}{' '}
                            {new Date(log.created_at).toLocaleTimeString('th-TH', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-full bg-amber-500/20">
                                <User className="size-3 text-amber-400" />
                              </div>
                              <span className="text-neutral-200">
                                {log.user?.display_name || log.user?.username || log.user_id?.slice(0, 8) || 'System'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {featureConfig?.icon}
                              <span className="text-neutral-300">{featureConfig?.label || featureKey}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Badge className={`${prevState ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-700 text-neutral-400'} text-xs`}>
                                {prevState === undefined ? 'ใหม่' : prevState ? 'เปิด' : 'ปิด'}
                              </Badge>
                              <span className="text-neutral-500">→</span>
                              <Badge className={`${newState ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'} text-xs`}>
                                {newState ? 'เปิด' : 'ปิด'}
                              </Badge>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Action Buttons */}
        <Card className="bg-gradient-to-br from-black/60 to-neutral-900/60 border border-neutral-800/50 backdrop-blur-sm">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-neutral-400">
                <Shield className="size-4" />
                <span className="text-sm">การเปลี่ยนแปลงมีผลทันทีแบบ Real-time</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => mutateFeatures()}
                  className="border-neutral-700 hover:bg-neutral-800"
                >
                  <RefreshCw className="size-4 mr-2" />
                  รีเฟรช
                </Button>
                <Link href={`/multi-tenant/${tenantId}`}>
                  <Button className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold hover:from-amber-400 hover:to-amber-500">
                    <CheckCircle className="size-4 mr-2" />
                    เสร็จสิ้น
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
