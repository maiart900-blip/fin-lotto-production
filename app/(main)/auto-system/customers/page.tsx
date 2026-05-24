'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Users,
  Search,
  RefreshCw,
  Eye,
  Settings2,
  Crown,
  Circle,
  TrendingUp,
  Wallet,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react';

// Types
interface Customer {
  id: string;
  username: string;
  display_name: string;
  phone: string;
  email: string;
  credit_balance: number;
  vip_level: string;
  status: string;
  is_online: boolean;
  last_activity_at: string;
  total_bets_today: number;
  total_deposits: number;
  total_withdrawals: number;
  created_at: string;
  referral_code: string;
}

interface CustomerStats {
  total: number;
  online: number;
  vip: number;
  newToday: number;
  totalBetsToday: number;
}

// Fetcher
const fetcher = (url: string) => fetch(url).then((res) => res.json());

// VIP Badge Component
function VIPBadge({ level }: { level: string }) {
  const configs: Record<string, { color: string; label: string }> = {
    member: { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', label: 'Member' },
    bronze: { color: 'bg-amber-900/20 text-amber-600 border-amber-600/30', label: 'Bronze' },
    silver: { color: 'bg-gray-300/20 text-gray-300 border-gray-300/30', label: 'Silver' },
    gold: { color: 'bg-amber-400/20 text-amber-400 border-amber-400/30', label: 'Gold' },
    platinum: { color: 'bg-purple-400/20 text-purple-400 border-purple-400/30', label: 'Platinum' },
    diamond: { color: 'bg-cyan-400/20 text-cyan-400 border-cyan-400/30', label: 'Diamond' },
  };

  const config = configs[level] || configs.member;

  return (
    <Badge variant="outline" className={`${config.color} text-xs`}>
      <Crown className="size-3 mr-1" />
      {config.label}
    </Badge>
  );
}

// Status Indicator
function StatusIndicator({ isOnline }: { isOnline: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Circle
        className={`size-2 ${isOnline ? 'fill-green-500 text-green-500' : 'fill-gray-500 text-gray-500'}`}
      />
      <span className={isOnline ? 'text-green-400' : 'text-gray-400'}>
        {isOnline ? 'ออนไลน์' : 'ออฟไลน์'}
      </span>
    </div>
  );
}

// Format number
function formatMoney(amount: number) {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function AutoSystemCustomersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vipFilter, setVipFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showManage, setShowManage] = useState(false);

  const limit = 20;

  // Build query params
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(search && { search }),
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(vipFilter !== 'all' && { vip_level: vipFilter }),
  });

  // Fetch customers with SWR (auto-refresh every 30s)
  const {
    data: customersData,
    error,
    isLoading,
    mutate,
  } = useSWR(`/api/auto-system/customers?${params}`, fetcher, {
    refreshInterval: 30000, // Real-time update every 30s
    revalidateOnFocus: true,
  });

  // Fetch stats
  const { data: statsData } = useSWR('/api/auto-system/customers/stats', fetcher, {
    refreshInterval: 30000,
  });

  const customers: Customer[] = customersData?.customers || [];
  const totalPages = customersData?.totalPages || 1;
  const stats: CustomerStats = statsData?.stats || {
    total: 0,
    online: 0,
    vip: 0,
    newToday: 0,
    totalBetsToday: 0,
  };

  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  const handleViewHistory = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowHistory(true);
  };

  const handleManage = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowManage(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#020617] via-[#0F172A] to-[#020617] p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="size-6 text-amber-400" />
            ลูกค้าออโต้
          </h1>
          <p className="text-white/60 mt-1">รายชื่อลูกค้าที่สมัครผ่านระบบออโต้</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <RefreshCw className="size-4 mr-2" />
            รีเฟรช
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <Download className="size-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-[#0D1321]/80 border-amber-500/20 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">ลูกค้าทั้งหมด</p>
                <p className="text-2xl font-bold text-white">{stats.total.toLocaleString()}</p>
              </div>
              <Users className="size-8 text-amber-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0D1321]/80 border-green-500/20 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">ออนไลน์</p>
                <p className="text-2xl font-bold text-green-400">{stats.online.toLocaleString()}</p>
              </div>
              <Circle className="size-8 text-green-400 fill-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0D1321]/80 border-purple-500/20 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">ลูกค้า VIP</p>
                <p className="text-2xl font-bold text-purple-400">{stats.vip.toLocaleString()}</p>
              </div>
              <Crown className="size-8 text-purple-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0D1321]/80 border-blue-500/20 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">สมัครวันนี้</p>
                <p className="text-2xl font-bold text-blue-400">{stats.newToday.toLocaleString()}</p>
              </div>
              <UserPlus className="size-8 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0D1321]/80 border-amber-500/20 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">ยอดแทงวันนี้</p>
                <p className="text-2xl font-bold text-amber-400">
                  {formatMoney(stats.totalBetsToday)}
                </p>
              </div>
              <TrendingUp className="size-8 text-amber-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-[#0D1321]/80 border-amber-500/20 backdrop-blur">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
              <Input
                placeholder="ค้นหาชื่อ, เบอร์โทร, อีเมล..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10 bg-[#0D1321] border-amber-500/30 text-white placeholder:text-white/40 focus:border-amber-400"
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full md:w-[180px] bg-[#0D1321] border-amber-500/30 text-white">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent className="bg-[#0D1321] border-amber-500/30">
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="online">ออนไลน์</SelectItem>
                <SelectItem value="offline">ออฟไลน์</SelectItem>
                <SelectItem value="new">ลูกค้าใหม่</SelectItem>
              </SelectContent>
            </Select>

            <Select value={vipFilter} onValueChange={(v) => { setVipFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full md:w-[180px] bg-[#0D1321] border-amber-500/30 text-white">
                <SelectValue placeholder="ระดับ VIP" />
              </SelectTrigger>
              <SelectContent className="bg-[#0D1321] border-amber-500/30">
                <SelectItem value="all">ทุกระดับ</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="bronze">Bronze</SelectItem>
                <SelectItem value="silver">Silver</SelectItem>
                <SelectItem value="gold">Gold</SelectItem>
                <SelectItem value="platinum">Platinum</SelectItem>
                <SelectItem value="diamond">Diamond</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="bg-[#0D1321]/80 border-amber-500/20 backdrop-blur overflow-hidden">
        <CardHeader className="border-b border-amber-500/20">
          <CardTitle className="text-amber-400 flex items-center gap-2">
            <Users className="size-5" />
            รายชื่อลูกค้า
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="size-8 animate-spin text-amber-400" />
            </div>
          ) : error ? (
            <div className="text-center py-20 text-red-400">
              เกิดข้อผิดพลาดในการโหลดข้อมูล
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-20">
              <Users className="size-12 mx-auto text-amber-400/30 mb-4" />
              <p className="text-white/60">ไม่พบข้อมูลลูกค้า</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-amber-500/20 hover:bg-transparent">
                    <TableHead className="text-amber-400 font-semibold">ชื่อผู้ใช้งาน / ID</TableHead>
                    <TableHead className="text-amber-400 font-semibold">สถานะ</TableHead>
                    <TableHead className="text-amber-400 font-semibold">ระดับ VIP</TableHead>
                    <TableHead className="text-amber-400 font-semibold text-right">ยอดเงินคงเหลือ</TableHead>
                    <TableHead className="text-amber-400 font-semibold text-right">ยอดแทงวันนี้</TableHead>
                    <TableHead className="text-amber-400 font-semibold text-center">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow
                      key={customer.id}
                      className="border-amber-500/10 hover:bg-amber-500/5 transition-colors"
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-white">
                            {customer.display_name || customer.username}
                          </p>
                          <p className="text-xs text-white/50">
                            @{customer.username} | {customer.phone || 'ไม่มีเบอร์'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusIndicator isOnline={customer.is_online} />
                      </TableCell>
                      <TableCell>
                        <VIPBadge level={customer.vip_level} />
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-amber-400 font-mono font-semibold">
                          {formatMoney(customer.credit_balance)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-white font-mono">
                          {formatMoney(customer.total_bets_today)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewHistory(customer)}
                            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 h-8"
                          >
                            <Eye className="size-3 mr-1" />
                            ประวัติ
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleManage(customer)}
                            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 h-8"
                          >
                            <Settings2 className="size-3 mr-1" />
                            จัดการ
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {customers.length > 0 && (
            <div className="flex items-center justify-between p-4 border-t border-amber-500/20">
              <p className="text-sm text-white/60">
                หน้า {page} จาก {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="bg-[#0D1321] border-amber-500/30 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-amber-400 flex items-center gap-2">
              <Eye className="size-5" />
              ประวัติลูกค้า: {selectedCustomer?.display_name || selectedCustomer?.username}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              ประวัติการใช้งานและการแทงหวย
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-white/60 text-sm">ยอดฝากรวม</p>
                <p className="text-xl font-bold text-green-400">
                  {formatMoney(selectedCustomer?.total_deposits || 0)}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-white/60 text-sm">ยอดถอนรวม</p>
                <p className="text-xl font-bold text-red-400">
                  {formatMoney(selectedCustomer?.total_withdrawals || 0)}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-white/60 text-sm">Referral Code</p>
                <p className="text-lg font-mono text-amber-400">
                  {selectedCustomer?.referral_code || '-'}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-white/60 text-sm">สมัครเมื่อ</p>
                <p className="text-lg text-white">
                  {selectedCustomer?.created_at
                    ? new Date(selectedCustomer.created_at).toLocaleDateString('th-TH')
                    : '-'}
                </p>
              </div>
            </div>

            {/* Recent Activity Placeholder */}
            <div className="border-t border-amber-500/20 pt-4">
              <p className="text-white/60 text-sm mb-2">กิจกรรมล่าสุด</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-amber-500/5 rounded">
                  <span className="text-white/80">เข้าสู่ระบบ</span>
                  <span className="text-white/60 text-sm">
                    {selectedCustomer?.last_activity_at
                      ? new Date(selectedCustomer.last_activity_at).toLocaleString('th-TH')
                      : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Dialog */}
      <Dialog open={showManage} onOpenChange={setShowManage}>
        <DialogContent className="bg-[#0D1321] border-amber-500/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-400 flex items-center gap-2">
              <Settings2 className="size-5" />
              จัดการ: {selectedCustomer?.display_name || selectedCustomer?.username}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              จัดการบัญชีลูกค้า
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="border-green-500/30 text-green-400 hover:bg-green-500/10"
              >
                <Wallet className="size-4 mr-2" />
                เติมเครดิต
              </Button>
              <Button
                variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <Wallet className="size-4 mr-2" />
                ตัดเครดิต
              </Button>
              <Button
                variant="outline"
                className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              >
                <Crown className="size-4 mr-2" />
                ปรับ VIP
              </Button>
              <Button
                variant="outline"
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              >
                <Settings2 className="size-4 mr-2" />
                แก้ไขข้อมูล
              </Button>
            </div>

            <div className="border-t border-amber-500/20 pt-4">
              <Button
                variant="outline"
                className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                ระงับบัญชี
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
