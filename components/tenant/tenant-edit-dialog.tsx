'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fetcher } from '@/lib/fetcher';
import {
  Settings, Palette, DollarSign, Shield, Plug, Package,
  Percent, AlertTriangle, Calendar, TrendingUp, Users,
  Globe, Activity, Clock, Lock, Unlock, Save, Loader2,
  RefreshCw
} from 'lucide-react';

interface TenantEditDialogProps {
  tenantId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

interface ThemeConfig {
  primaryColor: string;
  theme: string;
  [key: string]: string;
}

interface TenantData {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  is_active: boolean;
  status: string;
  plan: string;
  auto_system_enabled: boolean;
  manual_key_enabled: boolean;
  sync_payout_rates: boolean;
  sync_blocked_numbers: boolean;
  sync_lottery_status: boolean;
  theme_config: ThemeConfig | null;
  deposit_fee_percent: number;
  withdraw_fee_percent: number;
  wallet_frozen: boolean;
  settlement_frozen: boolean;
  max_daily_payout: number;
  max_single_payout: number;
  max_exposure: number;
  max_customers: number;
  max_agents: number;
  max_daily_bets: number;
  trial_ends_at: string | null;
  billing_email: string | null;
  contact_phone: string | null;
  subscription: {
    id: string;
    package_id: string;
    status: string;
    billing_cycle: string;
    packages?: { id: string; name: string; code: string; tier: number };
  } | null;
  revenue_configs: Array<{
    id: string;
    game_type: string;
    tenant_share_percent: number;
    platform_share_percent: number;
    provider_share_percent: number;
  }>;
  providers: Array<{ id: string; name: string; type: string; status: string }>;
  feature_flags: Array<{ feature_code: string; is_enabled: boolean; value: unknown }>;
  user_count: number;
  stats: { total_bets: number; profit_loss: number } | null;
  health: { health_score: number } | null;
}

interface PackageData {
  id: string;
  code: string;
  name: string;
  tier: number;
  price_monthly: number;
  max_customers: number;
  max_agents: number;
  max_daily_bets: number;
}

export function TenantEditDialog({ tenantId, open, onOpenChange, onSaved }: TenantEditDialogProps) {
  const { data: tenant, error, mutate } = useSWR<TenantData>(
    tenantId && open ? `/api/tenants/${tenantId}` : null,
    fetcher
  );
  const { data: packagesResponse } = useSWR<{ data: PackageData[] }>(open ? '/api/packages' : null, fetcher);
  const packages = packagesResponse?.data || [];

  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    domain: '',
    status: 'active',
    billing_email: '',
    contact_phone: '',
    auto_system_enabled: true,
    manual_key_enabled: false,
    sync_payout_rates: true,
    sync_blocked_numbers: true,
    sync_lottery_status: true,
    theme_config: { primaryColor: '#D4AF37', theme: 'midnight-gold' },
    wallet_frozen: false,
    settlement_frozen: false,
    max_daily_payout: 1000000,
    max_single_payout: 100000,
    max_exposure: 500000,
    deposit_fee_percent: 1.5,
    withdraw_fee_percent: 1.0,
  });

  const [revenueShares, setRevenueShares] = useState({
    lottery: { tenant: 85, platform: 15, provider: 0 },
    casino: { tenant: 75, platform: 25, provider: 0 },
    slots: { tenant: 70, platform: 20, provider: 10 },
    sports: { tenant: 80, platform: 20, provider: 0 },
  });

  // Update form when tenant data loads
  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || '',
        slug: tenant.slug || '',
        domain: tenant.domain || '',
        status: tenant.status || 'active',
        billing_email: tenant.billing_email || '',
        contact_phone: tenant.contact_phone || '',
        auto_system_enabled: tenant.auto_system_enabled ?? true,
        manual_key_enabled: tenant.manual_key_enabled ?? false,
        sync_payout_rates: tenant.sync_payout_rates ?? true,
        sync_blocked_numbers: tenant.sync_blocked_numbers ?? true,
        sync_lottery_status: tenant.sync_lottery_status ?? true,
        theme_config: tenant.theme_config || { primaryColor: '#D4AF37', theme: 'midnight-gold' },
        wallet_frozen: tenant.wallet_frozen ?? false,
        settlement_frozen: tenant.settlement_frozen ?? false,
        max_daily_payout: tenant.max_daily_payout || 1000000,
        max_single_payout: tenant.max_single_payout || 100000,
        max_exposure: tenant.max_exposure || 500000,
        deposit_fee_percent: tenant.deposit_fee_percent || 1.5,
        withdraw_fee_percent: tenant.withdraw_fee_percent || 1.0,
      });

      // Update revenue shares from tenant configs
      if (tenant.revenue_configs?.length) {
        const newShares = { ...revenueShares };
        tenant.revenue_configs.forEach(config => {
          const gt = config.game_type as keyof typeof newShares;
          if (newShares[gt]) {
            newShares[gt] = {
              tenant: config.tenant_share_percent,
              platform: config.platform_share_percent,
              provider: config.provider_share_percent
            };
          }
        });
        setRevenueShares(newShares);
      }
    }
  }, [tenant]);

  const handleSave = async () => {
    if (!tenantId) return;
    
    setSaving(true);
    try {
      // Update basic tenant info
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }

      toast.success('บันทึกการเปลี่ยนแปลงแล้ว');
      mutate();
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const handleManageAction = async (action: string, data: Record<string, unknown>) => {
    if (!tenantId) return;
    
    setSaving(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/manage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }

      toast.success('ดำเนินการสำเร็จ');
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const getTenantMode = () => {
    if (formData.auto_system_enabled && formData.manual_key_enabled) return 'hybrid';
    if (formData.auto_system_enabled) return 'auto_only';
    if (formData.manual_key_enabled) return 'manual_key_only';
    return 'auto_only';
  };

  const setTenantMode = (mode: string) => {
    switch (mode) {
      case 'auto_only':
        setFormData(prev => ({ ...prev, auto_system_enabled: true, manual_key_enabled: false }));
        break;
      case 'manual_key_only':
        setFormData(prev => ({ ...prev, auto_system_enabled: false, manual_key_enabled: true }));
        break;
      case 'hybrid':
        setFormData(prev => ({ ...prev, auto_system_enabled: true, manual_key_enabled: true }));
        break;
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('th-TH').format(num);
  };

  if (error) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#0a0f1a] border-red-500/30 text-white">
          <div className="flex flex-col items-center justify-center py-8">
            <AlertTriangle className="size-12 text-red-500 mb-4" />
            <p className="text-red-400">ไม่สามารถโหลดข้อมูลได้</p>
            <Button onClick={() => mutate()} className="mt-4" variant="outline">
              <RefreshCw className="size-4 mr-2" />
              ลองใหม่
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0f1a] border-amber-500/30 text-white max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl text-amber-400 flex items-center gap-2">
                <Settings className="size-5" />
                จัดการ Tenant: {tenant?.name || 'Loading...'}
              </DialogTitle>
              <DialogDescription className="text-slate-400 mt-1">
                แก้ไขการตั้งค่าทั้งหมดของเว็บลูก
              </DialogDescription>
            </div>
            {tenant && (
              <div className="flex items-center gap-2">
                <Badge className={cn(
                  tenant.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                  tenant.status === 'trial' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                  tenant.status === 'suspended' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                  'bg-slate-500/20 text-slate-400 border-slate-500/30'
                )}>
                  {tenant.status || 'active'}
                </Badge>
                {tenant.health && (
                  <Badge variant="outline" className={cn(
                    "border-amber-500/30",
                    tenant.health.health_score >= 80 ? "text-emerald-400" :
                    tenant.health.health_score >= 50 ? "text-amber-400" : "text-red-400"
                  )}>
                    Health: {tenant.health.health_score}%
                  </Badge>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        {!tenant ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="bg-black/40 border border-amber-500/20 flex-shrink-0">
                <TabsTrigger value="basic" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                  <Globe className="size-4 mr-2" />
                  พื้นฐาน
                </TabsTrigger>
                <TabsTrigger value="package" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                  <Package className="size-4 mr-2" />
                  Package
                </TabsTrigger>
                <TabsTrigger value="revenue" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                  <Percent className="size-4 mr-2" />
                  Revenue Share
                </TabsTrigger>
                <TabsTrigger value="financial" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                  <DollarSign className="size-4 mr-2" />
                  การเงิน
                </TabsTrigger>
                <TabsTrigger value="providers" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                  <Plug className="size-4 mr-2" />
                  Providers
                </TabsTrigger>
                <TabsTrigger value="branding" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                  <Palette className="size-4 mr-2" />
                  Branding
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto py-4">
                {/* Basic Tab */}
                <TabsContent value="basic" className="mt-0 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">ชื่อเว็บ</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="bg-black/40 border-amber-500/30 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Slug (URL Path)</Label>
                      <Input
                        value={formData.slug}
                        onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                        className="bg-black/40 border-amber-500/30 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Custom Domain</Label>
                      <Input
                        value={formData.domain}
                        onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
                        placeholder="example.com"
                        className="bg-black/40 border-amber-500/30 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Status</Label>
                      <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                        <SelectTrigger className="bg-black/40 border-amber-500/30 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator className="bg-amber-500/20" />

                  {/* Tenant Mode */}
                  <Card className="bg-black/40 border-amber-500/20">
                    <CardHeader>
                      <CardTitle className="text-amber-400 text-sm">Tenant Mode</CardTitle>
                      <CardDescription className="text-slate-400">กำหนดโหมดการทำงานของระบบ</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Select value={getTenantMode()} onValueChange={setTenantMode}>
                        <SelectTrigger className="bg-black/40 border-amber-500/30 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto_only">Auto Only - ระบบอัตโนมัติเท่านั้น</SelectItem>
                          <SelectItem value="manual_key_only">Manual Key Only - กุญแจมือเท่านั้น</SelectItem>
                          <SelectItem value="hybrid">Hybrid - ทั้งสองระบบ</SelectItem>
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>

                  {/* Sync Settings */}
                  <Card className="bg-black/40 border-amber-500/20">
                    <CardHeader>
                      <CardTitle className="text-amber-400 text-sm">Sync Settings</CardTitle>
                      <CardDescription className="text-slate-400">ซิงค์ข้อมูลจากเว็บแม่</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-white">Sync อัตราจ่าย</Label>
                          <p className="text-xs text-slate-400">ใช้อัตราจ่ายเดียวกับเว็บแม่</p>
                        </div>
                        <Switch
                          checked={formData.sync_payout_rates}
                          onCheckedChange={(v) => setFormData(prev => ({ ...prev, sync_payout_rates: v }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-white">Sync เลขอั้น</Label>
                          <p className="text-xs text-slate-400">ใช้เลขอั้นเดียวกับเว็บแม่</p>
                        </div>
                        <Switch
                          checked={formData.sync_blocked_numbers}
                          onCheckedChange={(v) => setFormData(prev => ({ ...prev, sync_blocked_numbers: v }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-white">Sync สถานะหวย</Label>
                          <p className="text-xs text-slate-400">เปิด/ปิดหวยตามเว็บแม่</p>
                        </div>
                        <Switch
                          checked={formData.sync_lottery_status}
                          onCheckedChange={(v) => setFormData(prev => ({ ...prev, sync_lottery_status: v }))}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contact Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Billing Email</Label>
                      <Input
                        value={formData.billing_email}
                        onChange={(e) => setFormData(prev => ({ ...prev, billing_email: e.target.value }))}
                        type="email"
                        className="bg-black/40 border-amber-500/30 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Contact Phone</Label>
                      <Input
                        value={formData.contact_phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                        className="bg-black/40 border-amber-500/30 text-white"
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Package Tab */}
                <TabsContent value="package" className="mt-0 space-y-4">
                  <Card className="bg-black/40 border-amber-500/20">
                    <CardHeader>
                      <CardTitle className="text-amber-400 text-sm flex items-center gap-2">
                        <Package className="size-4" />
                        Current Package
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
                        <div>
                          <p className="text-lg font-bold text-white">{tenant.subscription?.packages?.name || tenant.plan || 'No Package'}</p>
                          <p className="text-sm text-slate-400">
                            {tenant.subscription?.billing_cycle === 'yearly' ? 'Yearly' : 'Monthly'} Billing
                          </p>
                        </div>
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                          {tenant.subscription?.status || 'No Subscription'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mt-4">
                        <div className="text-center p-3 bg-black/30 rounded-lg">
                          <p className="text-xs text-slate-400">Max Customers</p>
                          <p className="text-lg font-bold text-white">{formatNumber(tenant.max_customers || 100)}</p>
                        </div>
                        <div className="text-center p-3 bg-black/30 rounded-lg">
                          <p className="text-xs text-slate-400">Max Agents</p>
                          <p className="text-lg font-bold text-white">{formatNumber(tenant.max_agents || 10)}</p>
                        </div>
                        <div className="text-center p-3 bg-black/30 rounded-lg">
                          <p className="text-xs text-slate-400">Max Daily Bets</p>
                          <p className="text-lg font-bold text-white">{formatNumber(tenant.max_daily_bets || 1000)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Change Package */}
                  <Card className="bg-black/40 border-amber-500/20">
                    <CardHeader>
                      <CardTitle className="text-amber-400 text-sm">เปลี่ยน Package</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {packages.map((pkg) => (
                          <button
                            key={pkg.id}
                            onClick={() => handleManageAction('change_package', { package_id: pkg.id })}
                            disabled={saving || pkg.id === tenant.subscription?.package_id}
                            className={cn(
                              "p-4 rounded-lg border text-left transition-all",
                              pkg.id === tenant.subscription?.package_id
                                ? "bg-amber-500/20 border-amber-500 cursor-default"
                                : "bg-black/30 border-amber-500/20 hover:border-amber-500/50 hover:bg-amber-500/10"
                            )}
                          >
                            <p className="font-bold text-white">{pkg.name}</p>
                            <p className="text-sm text-amber-400">{formatNumber(pkg.price_monthly)} THB/mo</p>
                            <p className="text-xs text-slate-400 mt-2">
                              {pkg.max_customers === -1 ? 'Unlimited' : formatNumber(pkg.max_customers)} customers
                            </p>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Trial Extension */}
                  {tenant.subscription?.status === 'trial' && (
                    <Card className="bg-black/40 border-blue-500/20">
                      <CardHeader>
                        <CardTitle className="text-blue-400 text-sm flex items-center gap-2">
                          <Calendar className="size-4" />
                          Trial Extension
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex items-center gap-4">
                        <Button
                          variant="outline"
                          className="border-blue-500/30 text-blue-400"
                          onClick={() => handleManageAction('extend_trial', { days: 7, reason: 'Admin extension' })}
                          disabled={saving}
                        >
                          +7 Days
                        </Button>
                        <Button
                          variant="outline"
                          className="border-blue-500/30 text-blue-400"
                          onClick={() => handleManageAction('extend_trial', { days: 14, reason: 'Admin extension' })}
                          disabled={saving}
                        >
                          +14 Days
                        </Button>
                        <Button
                          variant="outline"
                          className="border-blue-500/30 text-blue-400"
                          onClick={() => handleManageAction('extend_trial', { days: 30, reason: 'Admin extension' })}
                          disabled={saving}
                        >
                          +30 Days
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Revenue Share Tab */}
                <TabsContent value="revenue" className="mt-0 space-y-4">
                  {(['lottery', 'casino', 'slots', 'sports'] as const).map((gameType) => (
                    <Card key={gameType} className="bg-black/40 border-amber-500/20">
                      <CardHeader>
                        <CardTitle className="text-amber-400 text-sm capitalize flex items-center justify-between">
                          <span>{gameType === 'lottery' ? 'หวย' : gameType === 'casino' ? 'คาสิโน' : gameType === 'slots' ? 'สล็อต' : 'กีฬา'}</span>
                          <Badge variant="outline" className="border-amber-500/30 text-amber-400">
                            Total: {revenueShares[gameType].tenant + revenueShares[gameType].platform + revenueShares[gameType].provider}%
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-slate-300">Tenant Share</Label>
                            <span className="text-amber-400 font-bold">{revenueShares[gameType].tenant}%</span>
                          </div>
                          <Slider
                            value={[revenueShares[gameType].tenant]}
                            onValueChange={([v]) => {
                              const remaining = 100 - v;
                              const platformRatio = revenueShares[gameType].platform / (revenueShares[gameType].platform + revenueShares[gameType].provider || 1);
                              setRevenueShares(prev => ({
                                ...prev,
                                [gameType]: {
                                  tenant: v,
                                  platform: Math.round(remaining * platformRatio),
                                  provider: Math.round(remaining * (1 - platformRatio))
                                }
                              }));
                            }}
                            max={100}
                            step={1}
                            className="w-full"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-slate-300">Platform Share: {revenueShares[gameType].platform}%</Label>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-300">Provider Share: {revenueShares[gameType].provider}%</Label>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-500/30 text-amber-400"
                          onClick={() => handleManageAction('set_revenue_share', {
                            game_type: gameType,
                            tenant_share_percent: revenueShares[gameType].tenant,
                            platform_share_percent: revenueShares[gameType].platform,
                            provider_share_percent: revenueShares[gameType].provider
                          })}
                          disabled={saving}
                        >
                          <Save className="size-3 mr-2" />
                          บันทึก {gameType}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                {/* Financial Tab */}
                <TabsContent value="financial" className="mt-0 space-y-4">
                  {/* Freeze Controls */}
                  <Card className="bg-black/40 border-red-500/20">
                    <CardHeader>
                      <CardTitle className="text-red-400 text-sm flex items-center gap-2">
                        <Shield className="size-4" />
                        Financial Controls
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          {formData.wallet_frozen ? <Lock className="size-5 text-red-400" /> : <Unlock className="size-5 text-emerald-400" />}
                          <div>
                            <p className="font-medium text-white">Wallet Freeze</p>
                            <p className="text-xs text-slate-400">ระงับการฝาก/ถอนทั้งหมด</p>
                          </div>
                        </div>
                        <Switch
                          checked={formData.wallet_frozen}
                          onCheckedChange={(v) => {
                            setFormData(prev => ({ ...prev, wallet_frozen: v }));
                            handleManageAction('freeze_wallet', { freeze: v, reason: 'Admin action' });
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          {formData.settlement_frozen ? <Lock className="size-5 text-red-400" /> : <Unlock className="size-5 text-emerald-400" />}
                          <div>
                            <p className="font-medium text-white">Settlement Freeze</p>
                            <p className="text-xs text-slate-400">ระงับการ Settlement รายได้</p>
                          </div>
                        </div>
                        <Switch
                          checked={formData.settlement_frozen}
                          onCheckedChange={(v) => {
                            setFormData(prev => ({ ...prev, settlement_frozen: v }));
                            handleManageAction('freeze_settlement', { freeze: v, reason: 'Admin action' });
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Limits */}
                  <Card className="bg-black/40 border-amber-500/20">
                    <CardHeader>
                      <CardTitle className="text-amber-400 text-sm">Risk & Payout Limits</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-slate-300">Max Daily Payout</Label>
                          <Input
                            type="number"
                            value={formData.max_daily_payout}
                            onChange={(e) => setFormData(prev => ({ ...prev, max_daily_payout: Number(e.target.value) }))}
                            className="bg-black/40 border-amber-500/30 text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-300">Max Single Payout</Label>
                          <Input
                            type="number"
                            value={formData.max_single_payout}
                            onChange={(e) => setFormData(prev => ({ ...prev, max_single_payout: Number(e.target.value) }))}
                            className="bg-black/40 border-amber-500/30 text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-300">Max Exposure</Label>
                          <Input
                            type="number"
                            value={formData.max_exposure}
                            onChange={(e) => setFormData(prev => ({ ...prev, max_exposure: Number(e.target.value) }))}
                            className="bg-black/40 border-amber-500/30 text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-300">Max Daily Bets</Label>
                          <Input
                            type="number"
                            value={tenant.max_daily_bets}
                            disabled
                            className="bg-black/40 border-amber-500/30 text-white opacity-50"
                          />
                          <p className="text-xs text-slate-500">Controlled by package</p>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        className="border-amber-500/30 text-amber-400"
                        onClick={() => handleManageAction('set_limits', {
                          max_daily_payout: formData.max_daily_payout,
                          max_single_payout: formData.max_single_payout,
                          max_exposure: formData.max_exposure
                        })}
                        disabled={saving}
                      >
                        <Save className="size-4 mr-2" />
                        บันทึก Limits
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Fees */}
                  <Card className="bg-black/40 border-amber-500/20">
                    <CardHeader>
                      <CardTitle className="text-amber-400 text-sm">Transaction Fees</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-slate-300">Deposit Fee %</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formData.deposit_fee_percent}
                          onChange={(e) => setFormData(prev => ({ ...prev, deposit_fee_percent: Number(e.target.value) }))}
                          className="bg-black/40 border-amber-500/30 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-300">Withdraw Fee %</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formData.withdraw_fee_percent}
                          onChange={(e) => setFormData(prev => ({ ...prev, withdraw_fee_percent: Number(e.target.value) }))}
                          className="bg-black/40 border-amber-500/30 text-white"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Providers Tab */}
                <TabsContent value="providers" className="mt-0 space-y-4">
                  <Card className="bg-black/40 border-amber-500/20">
                    <CardHeader>
                      <CardTitle className="text-amber-400 text-sm">Connected Providers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {tenant.providers?.length === 0 ? (
                        <p className="text-center text-slate-400 py-8">ยังไม่มี Provider ที่เชื่อมต่อ</p>
                      ) : (
                        <div className="space-y-3">
                          {tenant.providers?.map((provider) => (
                            <div key={provider.id} className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "size-10 rounded-lg flex items-center justify-center",
                                  provider.status === 'active' ? 'bg-emerald-500/20' : 'bg-slate-500/20'
                                )}>
                                  <Plug className={cn(
                                    "size-5",
                                    provider.status === 'active' ? 'text-emerald-400' : 'text-slate-400'
                                  )} />
                                </div>
                                <div>
                                  <p className="font-medium text-white">{provider.name}</p>
                                  <p className="text-xs text-slate-400 capitalize">{provider.type}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={cn(
                                  provider.status === 'active' 
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                    : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                                )}>
                                  {provider.status}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  onClick={() => handleManageAction('detach_provider', { provider_id: provider.id })}
                                  disabled={saving}
                                >
                                  Detach
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Branding Tab */}
                <TabsContent value="branding" className="mt-0 space-y-4">
                  <Card className="bg-black/40 border-amber-500/20">
                    <CardHeader>
                      <CardTitle className="text-amber-400 text-sm">Theme Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-slate-300">Primary Color</Label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={formData.theme_config.primaryColor}
                            onChange={(e) => setFormData(prev => ({ 
                              ...prev, 
                              theme_config: { ...prev.theme_config, primaryColor: e.target.value }
                            }))}
                            className="size-10 rounded cursor-pointer"
                          />
                          <Input
                            value={formData.theme_config.primaryColor}
                            onChange={(e) => setFormData(prev => ({ 
                              ...prev, 
                              theme_config: { ...prev.theme_config, primaryColor: e.target.value }
                            }))}
                            className="bg-black/40 border-amber-500/30 text-white w-32"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-slate-300">Theme Preset</Label>
                        <Select 
                          value={formData.theme_config.theme} 
                          onValueChange={(v) => setFormData(prev => ({ 
                            ...prev, 
                            theme_config: { ...prev.theme_config, theme: v }
                          }))}
                        >
                          <SelectTrigger className="bg-black/40 border-amber-500/30 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="midnight-gold">Midnight Gold</SelectItem>
                            <SelectItem value="ocean-blue">Ocean Blue</SelectItem>
                            <SelectItem value="emerald-dark">Emerald Dark</SelectItem>
                            <SelectItem value="ruby-red">Ruby Red</SelectItem>
                            <SelectItem value="purple-haze">Purple Haze</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="p-4 rounded-lg border border-amber-500/20" style={{ backgroundColor: formData.theme_config.primaryColor + '20' }}>
                        <p className="text-sm text-slate-400">Preview</p>
                        <p className="text-lg font-bold" style={{ color: formData.theme_config.primaryColor }}>
                          {formData.name || 'Tenant Name'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-amber-500/20 flex-shrink-0">
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <Users className="size-4" />
                  {tenant.user_count} users
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="size-4" />
                  {formatNumber(tenant.stats?.total_bets || 0)} THB turnover
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-500/30 text-slate-400">
                  ยกเลิก
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold"
                >
                  {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
                  บันทึกการเปลี่ยนแปลง
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}