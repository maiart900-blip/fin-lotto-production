'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Globe,
  Plus,
  RefreshCw,
  Loader2,
  Crown,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Settings,
  Eye,
  Power,
  Wallet,
  Activity,
  Bell,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(r => r.json());

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
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export default function SubSitesPage() {
  const { data: response, mutate, isLoading } = useSWR<TenantsResponse>('/api/tenants', fetcher);
  const tenants = response?.data || [];
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTenant, setNewTenant] = useState({
    name: '',
    slug: '',
    domain: '',
    sync_payout_rates: true,
    sync_blocked_numbers: true,
    sync_lottery_status: true,
  });

  // Separate master and sub-sites
  const masterSite = tenants.find(t => t.is_master);
  const subSites = tenants.filter(t => !t.is_master);
  
  // Calculate totals (only sub-sites, not including master)
  const totals = subSites.reduce((acc, t) => ({
    totalUsers: acc.totalUsers + (t.user_count || 0),
    totalBets: acc.totalBets + (t.stats?.total_bets || 0),
    totalPL: acc.totalPL + (t.stats?.profit_loss || 0),
    activeUsers: acc.activeUsers + (t.stats?.active_users || 0),
  }), { totalUsers: 0, totalBets: 0, totalPL: 0, activeUsers: 0 });

  // Real-time subscription for tenant stats updates
  useEffect(() => {
    const supabase = createClient();
    
    // Subscribe to tenant_stats changes
    const channel = supabase
      .channel('tenant-stats-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tenant_stats' },
        () => {
          // Refresh data when stats change
          mutate();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entries' },
        () => {
          // Refresh when new bets come in
          mutate();
        }
      )
      .subscribe();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => mutate(), 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [mutate]);

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

      toast.success('สร้างเว็บลูกสำเร็จ!', {
        style: { background: '#1a1a1a', border: '1px solid #D4AF37', color: '#D4AF37' }
      });
      setShowCreateModal(false);
      setNewTenant({ name: '', slug: '', domain: '', sync_payout_rates: true, sync_blocked_numbers: true, sync_lottery_status: true });
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleTenant = async (tenant: Tenant) => {
    try {
      const res = await fetch(`/api/tenants/${tenant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !tenant.is_active }),
      });

      if (!res.ok) throw new Error('Failed to update');

      toast.success(tenant.is_active ? 'ปิดเว็บลูกแล้ว' : 'เปิดเว็บลูกแล้ว', {
        style: { background: '#1a1a1a', border: '1px solid #D4AF37', color: '#D4AF37' }
      });
      mutate();
    } catch {
      toast.error('ไม่สามารถอัปเดตสถานะได้');
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('th-TH').format(num);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.3)]">
            <Globe className="size-6 text-black" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">จัดการเว็บลูก</h1>
            <p className="text-sm text-slate-400">Master Admin - Sub-Site Management</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Live Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 border border-green-500/30">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2 bg-green-500"></span>
            </span>
            <span className="text-xs text-green-400 font-medium">LIVE</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            <RefreshCw className="size-4 mr-2" />
            รีเฟรช
          </Button>
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]"
          >
            <Plus className="size-4 mr-2" />
            สร้างเว็บลูกใหม่
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-black/40 border-[#D4AF37]/20 backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">เว็บลูกทั้งหมด</p>
                <p className="text-3xl font-bold text-[#D4AF37]">{subSites.length}</p>
                <p className="text-xs text-slate-500 mt-1">+ 1 เว็บแม่</p>
              </div>
              <Globe className="size-10 text-[#D4AF37]/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-[#D4AF37]/20 backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">สมาชิกรวม</p>
                <p className="text-3xl font-bold text-white">{formatNumber(totals.totalUsers)}</p>
              </div>
              <Users className="size-10 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-[#D4AF37]/20 backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">ยอดแทงรวม</p>
                <p className="text-3xl font-bold text-white">{formatNumber(totals.totalBets)}</p>
              </div>
              <Wallet className="size-10 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-[#D4AF37]/20 backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">กำไร/ขาดทุนรวม</p>
                <p className={`text-3xl font-bold ${totals.totalPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {totals.totalPL >= 0 ? '+' : ''}{formatNumber(totals.totalPL)}
                </p>
              </div>
              {totals.totalPL >= 0 ? (
                <TrendingUp className="size-10 text-green-500/50" />
              ) : (
                <TrendingDown className="size-10 text-red-500/50" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tenants Table */}
      <Card className="bg-black/40 border-[#D4AF37]/20 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="size-5 text-[#D4AF37]" />
            รายการเว็บทั้งหมด
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-[#D4AF37]" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#D4AF37]/20 hover:bg-transparent">
                  <TableHead className="text-slate-400">เว็บ</TableHead>
                  <TableHead className="text-slate-400">Domain</TableHead>
                  <TableHead className="text-slate-400 text-center">สมาชิก</TableHead>
                  <TableHead className="text-slate-400 text-right">ยอดแทง</TableHead>
                  <TableHead className="text-slate-400 text-right">กำไร/ขาดทุน</TableHead>
                  <TableHead className="text-slate-400 text-center">Sync</TableHead>
                  <TableHead className="text-slate-400 text-center">สถานะ</TableHead>
                  <TableHead className="text-slate-400 text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id} className="border-[#D4AF37]/10 hover:bg-[#D4AF37]/5">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {tenant.is_master && (
                          <Crown className="size-5 text-[#D4AF37]" />
                        )}
                        <div>
                          <p className="font-medium text-white">{tenant.name}</p>
                          <p className="text-xs text-slate-500">/{tenant.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {tenant.domain || '-'}
                    </TableCell>
                    <TableCell className="text-center text-white">
                      {formatNumber(tenant.user_count)}
                    </TableCell>
                    <TableCell className="text-right text-white">
                      ฿{formatNumber(tenant.stats?.total_bets || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={tenant.stats?.profit_loss && tenant.stats.profit_loss >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {tenant.stats?.profit_loss && tenant.stats.profit_loss >= 0 ? '+' : ''}
                        ฿{formatNumber(tenant.stats?.profit_loss || 0)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {tenant.sync_payout_rates && <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-500">เรท</Badge>}
                        {tenant.sync_blocked_numbers && <Badge variant="outline" className="text-[10px] border-blue-500/50 text-blue-500">อั้น</Badge>}
                        {tenant.sync_lottery_status && <Badge variant="outline" className="text-[10px] border-purple-500/50 text-purple-500">หวย</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {tenant.is_active ? (
                        <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                          เปิดใช้งาน
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
                          ปิดใช้งาน
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/sub-sites/${tenant.id}`}>
                          <Button variant="ghost" size="sm" className="text-[#D4AF37] hover:bg-[#D4AF37]/10">
                            <Eye className="size-4" />
                          </Button>
                        </Link>
                        <Link href={`/sub-sites/${tenant.id}/alerts`}>
                          <Button variant="ghost" size="sm" className="text-orange-500 hover:bg-orange-500/10">
                            <Bell className="size-4" />
                          </Button>
                        </Link>
                        {!tenant.is_master && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleToggleTenant(tenant)}
                            className={tenant.is_active ? 'text-red-500 hover:bg-red-500/10' : 'text-green-500 hover:bg-green-500/10'}
                          >
                            <Power className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Tenant Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-black/95 border-[#D4AF37]/30 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#D4AF37] flex items-center gap-2">
              <Plus className="size-5" />
              สร้างเว็บลูกใหม่
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">ชื่อเว็บ *</Label>
              <Input
                value={newTenant.name}
                onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                placeholder="เช่น FIN LOTTO สาขา 1"
                className="bg-slate-900/50 border-[#D4AF37]/30 focus:border-[#D4AF37]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Slug (URL Path) *</Label>
              <Input
                value={newTenant.slug}
                onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                placeholder="เช่น branch-1"
                className="bg-slate-900/50 border-[#D4AF37]/30 focus:border-[#D4AF37]"
              />
              <p className="text-xs text-slate-500">URL: /tenant/{newTenant.slug || 'slug'}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Domain (ถ้ามี)</Label>
              <Input
                value={newTenant.domain}
                onChange={(e) => setNewTenant({ ...newTenant, domain: e.target.value })}
                placeholder="เช่น branch1.finlotto.com"
                className="bg-slate-900/50 border-[#D4AF37]/30 focus:border-[#D4AF37]"
              />
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-slate-300">Sync กับเว็บแม่</Label>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/30 border border-slate-700">
                <div>
                  <p className="text-sm text-white">Sync เรทจ่าย</p>
                  <p className="text-xs text-slate-500">ใช้อัตราจ่ายเดียวกับเว็บแม่</p>
                </div>
                <Switch
                  checked={newTenant.sync_payout_rates}
                  onCheckedChange={(v) => setNewTenant({ ...newTenant, sync_payout_rates: v })}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/30 border border-slate-700">
                <div>
                  <p className="text-sm text-white">Sync เลขอั้น</p>
                  <p className="text-xs text-slate-500">ใช้เลขอั้นเดียวกับเว็บแม่</p>
                </div>
                <Switch
                  checked={newTenant.sync_blocked_numbers}
                  onCheckedChange={(v) => setNewTenant({ ...newTenant, sync_blocked_numbers: v })}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/30 border border-slate-700">
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
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleCreateTenant}
              disabled={creating}
              className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold"
            >
              {creating ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Plus className="size-4 mr-2" />}
              สร้างเว็บลูก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
