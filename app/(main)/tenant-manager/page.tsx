'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { 
  Globe, Plus, Power, PowerOff, Eye, Edit2,
  DollarSign, TrendingUp, Users, Activity, ExternalLink, 
  CheckCircle, XCircle, AlertTriangle, RefreshCw, Search, Filter,
  Loader2, Crown, BarChart3, Settings
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';
import { fetcher } from '@/lib/fetcher';
import { TenantEditDialog, TenantDetailDashboard } from '@/components/tenant';

// =============================================================================
// TYPES - Based on real database schema
// =============================================================================

interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  is_master: boolean;
  is_active: boolean;
  sync_payout_rates: boolean;
  sync_blocked_numbers: boolean;
  sync_lottery_status: boolean;
  theme_config: {
    primaryColor: string;
    theme: string;
  } | null;
  user_count: number;
  stats: {
    total_bets: number;
    total_payouts: number;
    profit_loss: number;
    active_users: number;
  } | null;
  created_at: string;
}

interface TenantsResponse {
  data: Tenant[];
  meta: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

// =============================================================================
// MAIN COMPONENT - Uses Real Data from API
// =============================================================================

export default function TenantManagerPage() {
  const { data: response, mutate, isLoading, error } = useSWR<TenantsResponse>('/api/tenants', fetcher);
  const tenants = response?.data || [];
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [editTenantId, setEditTenantId] = useState<string | null>(null);
  const [detailTenantId, setDetailTenantId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTenant, setNewTenant] = useState({
    name: '',
    slug: '',
    domain: '',
    sync_payout_rates: true,
    sync_blocked_numbers: true,
    sync_lottery_status: true,
  });

  // Filter tenants - exclude master (เว็บแม่)
  const subSites = tenants.filter(t => !t.is_master);
  
  const filteredSites = subSites.filter(tenant => {
    const matchesSearch = tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (tenant.domain || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          tenant.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'active' && tenant.is_active) ||
                          (statusFilter === 'inactive' && !tenant.is_active);
    return matchesSearch && matchesStatus;
  });

  // Calculate totals from real data (only sub-sites, not master)
  const totals = {
    sites: subSites.length,
    activeSites: subSites.filter(s => s.is_active).length,
    totalMembers: subSites.reduce((sum, s) => sum + (s.user_count || 0), 0),
    totalVolume: subSites.reduce((sum, s) => sum + (s.stats?.total_bets || 0), 0),
    totalProfit: subSites.reduce((sum, s) => sum + (s.stats?.profit_loss || 0), 0),
    activeUsers: subSites.reduce((sum, s) => sum + (s.stats?.active_users || 0), 0),
  };

  // Toggle site status
  const toggleSiteStatus = async (tenant: Tenant) => {
    try {
      const res = await fetch(`/api/tenants/${tenant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !tenant.is_active }),
      });

      if (!res.ok) throw new Error('Failed to update');

      toast.success(tenant.is_active ? 'ปิดเว็บลูกแล้ว' : 'เปิดเว็บลูกแล้ว');
      mutate();
    } catch {
      toast.error('ไม่สามารถอัปเดตสถานะได้');
    }
  };

  // Create new tenant
  const handleCreateTenant = async () => {
    if (!newTenant.name || !newTenant.slug) {
      toast.error('กรุณากรอกชื่อและ Slug');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTenant),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      toast.success('สร้างเว็บลูกสำเร็จ!');
      setIsCreateDialogOpen(false);
      setNewTenant({ name: '', slug: '', domain: '', sync_payout_rates: true, sync_blocked_numbers: true, sync_lottery_status: true });
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setCreating(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(2)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getThemeColor = (tenant: Tenant) => {
    return tenant.theme_config?.primaryColor || '#D4AF37';
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6 flex items-center justify-center">
        <Card className="bg-red-500/10 border-red-500/30 p-8 text-center">
          <AlertTriangle className="size-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400">ไม่สามารถโหลดข้อมูลเว็บลูกได้</p>
          <Button onClick={() => mutate()} className="mt-4">
            <RefreshCw className="size-4 mr-2" />
            ลองใหม่
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 
            className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
            style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
          >
            Site Management
          </h1>
          <p className="text-slate-400 mt-1">จัดการเว็บลูกทั้งหมดในเครือ FIN LOTTO R+</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => mutate()} className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
            <RefreshCw className="size-4 mr-2" />
            รีเฟรช
          </Button>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold"
          >
            <Plus className="size-4 mr-2" />
            สร้างเว็บลูกใหม่
          </Button>
        </div>
      </div>

      {/* Summary Cards - Real Data */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-black/40 border-amber-500/30 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Globe className="size-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">เว็บลูกทั้งหมด</p>
                <p className="text-2xl font-bold text-white">{totals.sites}</p>
                <p className="text-xs text-emerald-400">{totals.activeSites} Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-amber-500/30 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Users className="size-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">สมาชิกทั้งหมด</p>
                <p className="text-2xl font-bold text-white">{formatNumber(totals.totalMembers)}</p>
                <p className="text-xs text-emerald-400">{formatNumber(totals.activeUsers)} Online</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-amber-500/30 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <TrendingUp className="size-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">ยอดแทงรวม</p>
                <p className="text-2xl font-bold text-white">{formatNumber(totals.totalVolume)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-amber-500/30 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <DollarSign className="size-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">กำไรสุทธิรวม</p>
                <p className={cn("text-2xl font-bold", totals.totalProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {totals.totalProfit >= 0 ? '+' : ''}{formatNumber(totals.totalProfit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            placeholder="ค้นหาชื่อเว็บหรือ Domain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-black/40 border-amber-500/30 text-white placeholder:text-slate-500"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v: 'all' | 'active' | 'inactive') => setStatusFilter(v)}>
          <SelectTrigger className="w-[180px] bg-black/40 border-amber-500/30 text-white">
            <Filter className="size-4 mr-2" />
            <SelectValue placeholder="สถานะ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            <SelectItem value="active">เปิดใช้งาน</SelectItem>
            <SelectItem value="inactive">ปิดใช้งาน</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sites Table */}
      <Card className="bg-black/40 border-amber-500/30 backdrop-blur-xl overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-amber-500" />
            </div>
          ) : filteredSites.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="size-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">ยังไม่มีเว็บลูกในระบบ</p>
              <p className="text-sm text-slate-500 mt-1">กดปุ่ม &quot;สร้างเว็บลูกใหม่&quot; เพื่อเริ่มต้น</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-amber-500/20">
                  <th className="text-left p-4 text-amber-400 font-medium">เว็บลูก</th>
                  <th className="text-left p-4 text-amber-400 font-medium">สถานะ</th>
                  <th className="text-right p-4 text-amber-400 font-medium">สมาชิก</th>
                  <th className="text-right p-4 text-amber-400 font-medium">ยอดแทง</th>
                  <th className="text-right p-4 text-amber-400 font-medium">กำไร/ขาดทุน</th>
                  <th className="text-center p-4 text-amber-400 font-medium">Sync</th>
                  <th className="text-center p-4 text-amber-400 font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredSites.map((tenant) => (
                  <tr 
                    key={tenant.id}
                    className={cn(
                      "border-b border-amber-500/10 hover:bg-amber-500/5 transition-colors",
                      !tenant.is_active && "opacity-60"
                    )}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="size-10 rounded-lg flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: getThemeColor(tenant) }}
                        >
                          {tenant.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-white">{tenant.name}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-slate-400">{tenant.domain || `/${tenant.slug}`}</p>
                            {tenant.domain && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="size-5"
                                onClick={() => window.open(`https://${tenant.domain}`, '_blank')}
                              >
                                <ExternalLink className="size-3 text-slate-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge className={cn(
                        "font-medium",
                        tenant.is_active 
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : "bg-red-500/20 text-red-400 border-red-500/30"
                      )}>
                        {tenant.is_active ? <CheckCircle className="size-3 mr-1" /> : <XCircle className="size-3 mr-1" />}
                        {tenant.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <p className="text-white font-medium">{formatNumber(tenant.user_count || 0)}</p>
                      <p className="text-xs text-emerald-400">{tenant.stats?.active_users || 0} online</p>
                    </td>
                    <td className="p-4 text-right">
                      <p className="text-white font-medium">{formatCurrency(tenant.stats?.total_bets || 0)}</p>
                    </td>
                    <td className="p-4 text-right">
                      <p className={cn(
                        "font-bold",
                        (tenant.stats?.profit_loss || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {(tenant.stats?.profit_loss || 0) >= 0 ? '+' : ''}
                        {formatCurrency(tenant.stats?.profit_loss || 0)}
                      </p>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-1">
                        {tenant.sync_payout_rates && <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-500">เรท</Badge>}
                        {tenant.sync_blocked_numbers && <Badge variant="outline" className="text-[10px] border-blue-500/50 text-blue-500">อั้น</Badge>}
                        {tenant.sync_lottery_status && <Badge variant="outline" className="text-[10px] border-purple-500/50 text-purple-500">หวย</Badge>}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="size-8 text-slate-400 hover:text-white hover:bg-white/10"
                          onClick={() => {
                            setDetailTenantId(tenant.id);
                            setIsDetailsDialogOpen(true);
                          }}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="size-8 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"
                          onClick={() => {
                            setEditTenantId(tenant.id);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit2 className="size-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className={cn(
                            "size-8",
                            tenant.is_active 
                              ? "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                          )}
                          onClick={() => toggleSiteStatus(tenant)}
                        >
                          {tenant.is_active ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Create Site Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="bg-[#0a0f1a] border-amber-500/30 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-amber-400">สร้างเว็บลูกใหม่</DialogTitle>
            <DialogDescription className="text-slate-400">
              กรอกข้อมูลเพื่อสร้างเว็บลูกใหม่ในระบบ
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">ชื่อเว็บ *</Label>
              <Input 
                placeholder="เช่น FIN LOTTO สาขา 1" 
                value={newTenant.name}
                onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                className="bg-black/40 border-amber-500/30 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Slug (URL Path) *</Label>
              <Input 
                placeholder="เช่น branch-1" 
                value={newTenant.slug}
                onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                className="bg-black/40 border-amber-500/30 text-white"
              />
              <p className="text-xs text-slate-500">URL: /tenant/{newTenant.slug || 'slug'}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Domain (ถ้ามี)</Label>
              <Input 
                placeholder="เช่น branch1.finlotto.com" 
                value={newTenant.domain}
                onChange={(e) => setNewTenant({ ...newTenant, domain: e.target.value })}
                className="bg-black/40 border-amber-500/30 text-white"
              />
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-slate-300">Sync กับเว็บแม่</Label>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-slate-700">
                <div>
                  <p className="text-sm text-white">Sync เรทจ่าย</p>
                  <p className="text-xs text-slate-500">ใช้อัตราจ่ายเดียวกับเว็บแม่</p>
                </div>
                <Switch
                  checked={newTenant.sync_payout_rates}
                  onCheckedChange={(v) => setNewTenant({ ...newTenant, sync_payout_rates: v })}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-slate-700">
                <div>
                  <p className="text-sm text-white">Sync เลขอั้น</p>
                  <p className="text-xs text-slate-500">ใช้เลขอั้นเดียวกับเว็บแม่</p>
                </div>
                <Switch
                  checked={newTenant.sync_blocked_numbers}
                  onCheckedChange={(v) => setNewTenant({ ...newTenant, sync_blocked_numbers: v })}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-slate-700">
                <div>
                  <p className="text-sm text-white">Sync สถานะหวย</p>
                  <p className="text-xs text-slate-500">เปิด/ปิดหวยตามเว็บแม่</p>
                </div>
                <Switch
                  checked={newTenant.sync_lottery_status}
                  onCheckedChange={(v) => setNewTenant({ ...newTenant, sync_lottery_status: v })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleCreateTenant}
              disabled={creating}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold"
            >
              {creating ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Plus className="size-4 mr-2" />}
              สร้างเว็บลูก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tenant Dialog - Full Management */}
      <TenantEditDialog
        tenantId={editTenantId}
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setEditTenantId(null);
        }}
        onSaved={() => mutate()}
      />

      {/* Tenant Detail Dashboard */}
      <TenantDetailDashboard
        tenantId={detailTenantId}
        open={isDetailsDialogOpen}
        onOpenChange={(open) => {
          setIsDetailsDialogOpen(open);
          if (!open) setDetailTenantId(null);
        }}
        onEdit={() => {
          setIsDetailsDialogOpen(false);
          setEditTenantId(detailTenantId);
          setIsEditDialogOpen(true);
        }}
      />
    </div>
  );
}
