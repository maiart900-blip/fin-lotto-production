'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Globe,
  Users,
  Wallet,
  TrendingUp,
  TrendingDown,
  Settings,
  RefreshCw,
  Loader2,
  Crown,
  AlertTriangle,
  Activity,
  MoreVertical,
  UserCheck,
  KeyRound,
  Eye,
  Ban,
  Zap,
  Keyboard,
  CreditCard,
  Shield,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface TenantUser {
  id: string;
  username: string;
  display_name: string;
  role: string;
  credit_balance: number;
  is_active: boolean;
  created_at: string;
  phone?: string;
  email?: string;
}

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  is_master: boolean;
  is_active: boolean;
  sync_payout_rates: boolean;
  sync_blocked_numbers: boolean;
  sync_lottery_status: boolean;
  deposit_fee_percent: number;
  withdraw_fee_percent: number;
  auto_system_enabled: boolean;
  manual_key_enabled: boolean;
  users: TenantUser[];
  user_count: number;
  tenant_stats: Array<{
    total_bets: number;
    total_payouts: number;
    profit_loss: number;
    active_users: number;
    stat_date: string;
  }>;
  tenant_alerts: Array<{
    id: string;
    alert_type: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
  }>;
}

export default function SubSiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: tenant, mutate, isLoading } = useSWR<TenantDetail>(`/api/tenants/${id}`, fetcher);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [impersonateUser, setImpersonateUser] = useState<TenantUser | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<TenantUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [impersonateReason, setImpersonateReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const handleUpdateSync = async (field: string, value: boolean | number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });

      if (!res.ok) throw new Error('Failed to update');

      toast.success('บันทึกการตั้งค่าสำเร็จ');
      mutate();
    } catch {
      toast.error('ไม่สามารถบันทึกได้');
    } finally {
      setSaving(false);
    }
  };

  // Impersonate user
  const handleImpersonate = async () => {
    if (!impersonateUser) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: impersonateUser.id,
          reason: impersonateReason,
        }),
      });

      if (!res.ok) throw new Error('Failed to impersonate');

      const data = await res.json();
      toast.success(`เข้าสู่ระบบแทน ${impersonateUser.username} สำเร็จ`);
      setImpersonateUser(null);
      setImpersonateReason('');
      
      // Redirect to appropriate page
      window.location.href = data.redirectUrl || '/';
    } catch {
      toast.error('ไม่สามารถเข้าสู่ระบบแทนได้');
    } finally {
      setProcessing(false);
    }
  };

  // Reset password
  const handleResetPassword = async () => {
    if (!resetPasswordUser || !newPassword) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: resetPasswordUser.id,
          newPassword,
          reason: resetReason,
          notifyUser: true,
        }),
      });

      if (!res.ok) throw new Error('Failed to reset password');

      toast.success(`รีเซ็ตรหัสผ่านของ ${resetPasswordUser.username} สำเร็จ`);
      setResetPasswordUser(null);
      setNewPassword('');
      setResetReason('');
    } catch {
      toast.error('ไม่สามารถรีเซ็ตรหัสผ่านได้');
    } finally {
      setProcessing(false);
    }
  };

  // Toggle user status
  const handleToggleUserStatus = async (user: TenantUser) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !user.is_active }),
      });

      if (!res.ok) throw new Error('Failed to update');

      toast.success(user.is_active ? 'ระงับผู้ใช้แล้ว' : 'เปิดใช้งานผู้ใช้แล้ว');
      mutate();
    } catch {
      toast.error('ไม่สามารถอัปเดตได้');
    }
  };

  // Generate random password
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
  };

  // Copy password
  const copyPassword = () => {
    navigator.clipboard.writeText(newPassword);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const formatNumber = (num: number) => new Intl.NumberFormat('th-TH').format(num);
  const formatDate = (date: string) => new Date(date).toLocaleDateString('th-TH');

  // Filter users
  const filteredUsers = tenant?.users?.filter(user => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      user.username.toLowerCase().includes(search) ||
      user.display_name?.toLowerCase().includes(search) ||
      user.phone?.includes(search)
    );
  }) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black flex items-center justify-center">
        <Loader2 className="size-12 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black flex items-center justify-center">
        <p className="text-slate-400">ไม่พบข้อมูลเว็บลูก</p>
      </div>
    );
  }

  const todayStats = tenant.tenant_stats?.[0];
  const unreadAlerts = tenant.tenant_alerts?.filter(a => !a.is_read) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-3">
            {tenant.is_master ? (
              <Crown className="size-8 text-[#D4AF37]" />
            ) : (
              <Globe className="size-8 text-[#D4AF37]" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">{tenant.name}</h1>
              <p className="text-sm text-slate-400">/{tenant.slug} {tenant.domain && `• ${tenant.domain}`}</p>
            </div>
          </div>
          <Badge className={tenant.is_active ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}>
            {tenant.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="size-4 mr-2" />
          รีเฟรช
        </Button>
      </div>

      {/* Alerts Banner */}
      {unreadAlerts.length > 0 && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-4">
          <AlertTriangle className="size-6 text-red-500" />
          <div className="flex-1">
            <p className="text-red-400 font-medium">{unreadAlerts.length} การแจ้งเตือนที่ยังไม่ได้อ่าน</p>
            <p className="text-sm text-red-300/70">{unreadAlerts[0]?.title}</p>
          </div>
          <Link href={`/sub-sites/${id}/alerts`}>
            <Button variant="outline" size="sm" className="border-red-500/50 text-red-400">
              ดูทั้งหมด
            </Button>
          </Link>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-black/40 border-[#D4AF37]/20 backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">สมาชิกทั้งหมด</p>
                <p className="text-3xl font-bold text-white">{formatNumber(tenant.user_count)}</p>
              </div>
              <Users className="size-10 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-[#D4AF37]/20 backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">ยอดแทงวันนี้</p>
                <p className="text-3xl font-bold text-white">{formatNumber(todayStats?.total_bets || 0)}</p>
              </div>
              <Wallet className="size-10 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-[#D4AF37]/20 backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">จ่ายออกวันนี้</p>
                <p className="text-3xl font-bold text-white">{formatNumber(todayStats?.total_payouts || 0)}</p>
              </div>
              <Activity className="size-10 text-orange-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-[#D4AF37]/20 backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">กำไร/ขาดทุน</p>
                <p className={`text-3xl font-bold ${(todayStats?.profit_loss || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {(todayStats?.profit_loss || 0) >= 0 ? '+' : ''}{formatNumber(todayStats?.profit_loss || 0)}
                </p>
              </div>
              {(todayStats?.profit_loss || 0) >= 0 ? (
                <TrendingUp className="size-10 text-green-500/50" />
              ) : (
                <TrendingDown className="size-10 text-red-500/50" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="bg-black/40 border border-[#D4AF37]/20">
          <TabsTrigger value="users" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
            <Users className="size-4 mr-2" />
            สมาชิก ({tenant.user_count})
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
            <Settings className="size-4 mr-2" />
            การตั้งค่า
          </TabsTrigger>
          <TabsTrigger value="payment" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
            <CreditCard className="size-4 mr-2" />
            ค่าธรรมเนียม
          </TabsTrigger>
          <TabsTrigger value="systems" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
            <Zap className="size-4 mr-2" />
            ระบบ
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
            <Shield className="size-4 mr-2" />
            ความปลอดภัย
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card className="bg-black/40 border-[#D4AF37]/20 backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">รายชื่อสมาชิก</CardTitle>
                <Input
                  placeholder="ค้นหา username, ชื่อ, เบอร์โทร..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64 bg-slate-900/50 border-slate-700"
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#D4AF37]/20 hover:bg-transparent">
                    <TableHead className="text-slate-400">Username</TableHead>
                    <TableHead className="text-slate-400">ชื่อแสดง</TableHead>
                    <TableHead className="text-slate-400">ระดับ</TableHead>
                    <TableHead className="text-slate-400 text-right">เครดิต</TableHead>
                    <TableHead className="text-slate-400 text-center">สถานะ</TableHead>
                    <TableHead className="text-slate-400 text-center">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                        {searchTerm ? 'ไม่พบผู้ใช้ที่ค้นหา' : 'ยังไม่มีสมาชิก'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id} className="border-[#D4AF37]/10 hover:bg-[#D4AF37]/5">
                        <TableCell className="text-white font-mono">{user.username}</TableCell>
                        <TableCell className="text-slate-300">{user.display_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{user.role}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-[#D4AF37]">
                          {formatNumber(user.credit_balance)}
                        </TableCell>
                        <TableCell className="text-center">
                          {user.is_active ? (
                            <Badge className="bg-green-500/20 text-green-500 text-xs">Active</Badge>
                          ) : (
                            <Badge className="bg-red-500/20 text-red-500 text-xs">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                              <DropdownMenuItem
                                onClick={() => setImpersonateUser(user)}
                                className="text-blue-400 focus:text-blue-300 focus:bg-blue-500/10"
                              >
                                <UserCheck className="size-4 mr-2" />
                                เข้าสู่ระบบแทน
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setResetPasswordUser(user);
                                  generatePassword();
                                }}
                                className="text-amber-400 focus:text-amber-300 focus:bg-amber-500/10"
                              >
                                <KeyRound className="size-4 mr-2" />
                                รีเซ็ตรหัสผ่าน
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-slate-300 focus:text-white focus:bg-slate-700">
                                <Eye className="size-4 mr-2" />
                                ดูรายละเอียด
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-slate-700" />
                              <DropdownMenuItem
                                onClick={() => handleToggleUserStatus(user)}
                                className={user.is_active ? 'text-red-400 focus:text-red-300 focus:bg-red-500/10' : 'text-green-400 focus:text-green-300 focus:bg-green-500/10'}
                              >
                                <Ban className="size-4 mr-2" />
                                {user.is_active ? 'ระงับผู้ใช้' : 'เปิดใช้งาน'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card className="bg-black/40 border-[#D4AF37]/20 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white">การตั้งค่า Sync กับเว็บแม่</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/30 border border-slate-700">
                <div>
                  <p className="font-medium text-white">Sync อัตราจ่าย (Payout Rates)</p>
                  <p className="text-sm text-slate-400">ใช้อัตราจ่ายเดียวกับเว็บแม่อัตโนมัติ</p>
                </div>
                <Switch
                  checked={tenant.sync_payout_rates}
                  onCheckedChange={(v) => handleUpdateSync('sync_payout_rates', v)}
                  disabled={saving || tenant.is_master}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/30 border border-slate-700">
                <div>
                  <p className="font-medium text-white">Sync เลขอั้น (Blocked Numbers)</p>
                  <p className="text-sm text-slate-400">ใช้รายการเลขอั้นเดียวกับเว็บแม่</p>
                </div>
                <Switch
                  checked={tenant.sync_blocked_numbers}
                  onCheckedChange={(v) => handleUpdateSync('sync_blocked_numbers', v)}
                  disabled={saving || tenant.is_master}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/30 border border-slate-700">
                <div>
                  <p className="font-medium text-white">Sync สถานะหวย (Lottery Status)</p>
                  <p className="text-sm text-slate-400">เปิด/ปิดรับแทงตามเว็บแม่อัตโนมัติ</p>
                </div>
                <Switch
                  checked={tenant.sync_lottery_status}
                  onCheckedChange={(v) => handleUpdateSync('sync_lottery_status', v)}
                  disabled={saving || tenant.is_master}
                />
              </div>

              {tenant.is_master && (
                <p className="text-sm text-slate-500 text-center py-2">
                  เว็บแม่ไม่สามารถปรับการ Sync ได้ เนื่องจากเป็นต้นทางของข้อมูล
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Fee Tab */}
        <TabsContent value="payment">
          <Card className="bg-black/40 border-[#D4AF37]/20 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white">ค่าธรรมเนียม Payment Gateway</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-xl bg-green-500/10 border border-green-500/30">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-green-500/20">
                      <TrendingUp className="size-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium text-white">ค่าธรรมเนียมฝากเงิน</p>
                      <p className="text-sm text-slate-400">% ที่เว็บแม่เก็บ���ากยอดฝาก</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={tenant.deposit_fee_percent || 1.5}
                      onChange={(e) => handleUpdateSync('deposit_fee_percent', parseFloat(e.target.value))}
                      className="w-24 bg-slate-900/50 border-slate-700 text-center"
                      disabled={saving || tenant.is_master}
                    />
                    <span className="text-white">%</span>
                  </div>
                </div>

                <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/30">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-red-500/20">
                      <TrendingDown className="size-5 text-red-500" />
                    </div>
                    <div>
                      <p className="font-medium text-white">ค่าธรรมเนียมถอนเงิน</p>
                      <p className="text-sm text-slate-400">% ที่เว็บแม่เก็บจากยอดถอน</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={tenant.withdraw_fee_percent || 1.0}
                      onChange={(e) => handleUpdateSync('withdraw_fee_percent', parseFloat(e.target.value))}
                      className="w-24 bg-slate-900/50 border-slate-700 text-center"
                      disabled={saving || tenant.is_master}
                    />
                    <span className="text-white">%</span>
                  </div>
                </div>
              </div>

              {tenant.is_master && (
                <p className="text-sm text-slate-500 text-center py-2">
                  เว็บแม่ไม่สามารถตั้งค่าธรรมเนียมได้
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Systems Tab */}
        <TabsContent value="systems">
          <Card className="bg-black/40 border-[#D4AF37]/20 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white">ระบบที่เปิดใช้งาน</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/20">
                    <Zap className="size-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-medium text-white">ระบบออโต้ (Auto System)</p>
                    <p className="text-sm text-slate-400">ลูกค้าแทงหวยผ่านเว็บไซต์อัตโนมัติ</p>
                  </div>
                </div>
                <Switch
                  checked={tenant.auto_system_enabled !== false}
                  onCheckedChange={(v) => handleUpdateSync('auto_system_enabled', v)}
                  disabled={saving || tenant.is_master}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <Keyboard className="size-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="font-medium text-white">ระบบคีย์หวย (Manual Key)</p>
                    <p className="text-sm text-slate-400">Admin คีย์โพยเข้าระบบ</p>
                  </div>
                </div>
                <Switch
                  checked={tenant.manual_key_enabled !== false}
                  onCheckedChange={(v) => handleUpdateSync('manual_key_enabled', v)}
                  disabled={saving || tenant.is_master}
                />
              </div>

              {tenant.is_master && (
                <p className="text-sm text-slate-500 text-center py-2">
                  เว็บแม่เปิดใช้งานทุกระบบเป็นค่าเริ่มต้น
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card className="bg-black/40 border-[#D4AF37]/20 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="size-5 text-green-500" />
                การตั้งค่าความปลอดภัย
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 2FA Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#D4AF37]">ยืนยันตัวตน 2 ชั้น (2FA)</h3>
                
                <div className="flex items-center justify-between p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-red-500/20">
                      <Shield className="size-6 text-red-500" />
                    </div>
                    <div>
                      <p className="font-medium text-white">บังคับ 2FA สำหรับ Admin</p>
                      <p className="text-sm text-slate-400">Admin ต้องยืนยันตัวตนทุกครั้งที่ล็อกอิน</p>
                    </div>
                  </div>
                  <Switch
                    checked={true}
                    onCheckedChange={(v) => handleUpdateSync('security_2fa_admin', v)}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-orange-500/20">
                      <Shield className="size-6 text-orange-500" />
                    </div>
                    <div>
                      <p className="font-medium text-white">แนะนำ 2FA สำหรับ Agent</p>
                      <p className="text-sm text-slate-400">Agent สามารถเปิดใช้งาน 2FA ได้</p>
                    </div>
                  </div>
                  <Switch
                    checked={false}
                    onCheckedChange={(v) => handleUpdateSync('security_2fa_agent', v)}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-blue-500/20">
                      <Shield className="size-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-medium text-white">2FA สำหรับ Member</p>
                      <p className="text-sm text-slate-400">Member สามารถเปิดใช้งาน 2FA ได้</p>
                    </div>
                  </div>
                  <Switch
                    checked={false}
                    onCheckedChange={(v) => handleUpdateSync('security_2fa_member', v)}
                    disabled={saving}
                  />
                </div>
              </div>

              {/* Login Security */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#D4AF37]">ความปลอดภัยการล็อกอิน</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                    <Label className="text-slate-300">จำนวนครั้งล็อกอินผิดสูงสุด</Label>
                    <Input
                      type="number"
                      defaultValue={5}
                      min={3}
                      max={10}
                      className="mt-2 bg-slate-700 border-slate-600"
                    />
                    <p className="text-xs text-slate-500 mt-1">ระงับบัญชีชั่วคราวหลังล็อกอินผิดตามจำนวนนี้</p>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                    <Label className="text-slate-300">Session Timeout (นาที)</Label>
                    <Input
                      type="number"
                      defaultValue={60}
                      min={15}
                      max={480}
                      className="mt-2 bg-slate-700 border-slate-600"
                    />
                    <p className="text-xs text-slate-500 mt-1">ออกจากระบบอัตโนมัติหลังไม่ใช้งาน</p>
                  </div>
                </div>
              </div>

              {/* Password Policy */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#D4AF37]">นโยบายรหัสผ่าน</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                    <span className="text-slate-300">ความยาวขั้นต่ำ 8 ตัวอักษร</span>
                    <Switch checked={true} disabled />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                    <span className="text-slate-300">ต้องมีตัวพิมพ์ใหญ่</span>
                    <Switch checked={true} onCheckedChange={(v) => handleUpdateSync('password_uppercase', v)} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                    <span className="text-slate-300">ต้องมีตัวเลข</span>
                    <Switch checked={true} onCheckedChange={(v) => handleUpdateSync('password_number', v)} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                    <span className="text-slate-300">ต้องมีอักขระพิเศษ</span>
                    <Switch checked={false} onCheckedChange={(v) => handleUpdateSync('password_special', v)} />
                  </div>
                </div>
              </div>

              {/* Device Lock */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#D4AF37]">ล็อคอุปกรณ์</h3>
                
                <div className="flex items-center justify-between p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-purple-500/20">
                      <Shield className="size-6 text-purple-500" />
                    </div>
                    <div>
                      <p className="font-medium text-white">จำกัดอุปกรณ์ต่อผู้ใช้</p>
                      <p className="text-sm text-slate-400">ผู้ใช้สามารถล็อกอินได้สูงสุด 3 อุปกรณ์</p>
                    </div>
                  </div>
                  <Switch
                    checked={false}
                    onCheckedChange={(v) => handleUpdateSync('device_lock_enabled', v)}
                    disabled={saving}
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t border-slate-700">
                <Button
                  onClick={() => toast.success('บันทึกการตั้งค่าความปลอดภัยเรียบร้อย')}
                  className="bg-[#D4AF37] text-black hover:bg-[#B4941F]"
                >
                  <Check className="size-4 mr-2" />
                  บันทึกการตั้งค่า
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Impersonate Dialog */}
      <Dialog open={!!impersonateUser} onOpenChange={() => setImpersonateUser(null)}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <UserCheck className="size-5 text-blue-500" />
              เข้าสู่ระบบแทน
            </DialogTitle>
            <DialogDescription>
              คุณกำลังจะเข้าสู่ระบบในฐานะ {impersonateUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <p className="text-sm text-blue-300">
                คุณจะสามารถใช้งานระบบในฐานะผู้ใช้นี้ได้ทั้งหมด
                การกระทำทั้งหมดจะถูกบันทึกไว้ในระบบ
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">เหตุผลในการเข้าสู่ระบบแทน</Label>
              <Textarea
                placeholder="ระบุเหตุผล เช่น ตรวจสอบปัญหา, ช่วยเหลือลูกค้า..."
                value={impersonateReason}
                onChange={(e) => setImpersonateReason(e.target.value)}
                className="bg-slate-800 border-slate-700"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImpersonateUser(null)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleImpersonate}
              disabled={processing || !impersonateReason}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {processing ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <UserCheck className="size-4 mr-2" />
              )}
              เข้าสู่ระบบแทน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordUser} onOpenChange={() => setResetPasswordUser(null)}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <KeyRound className="size-5 text-amber-500" />
              รีเซ็ตรหัสผ่าน
            </DialogTitle>
            <DialogDescription>
              รีเซ็ตรห��สผ่านของ {resetPasswordUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <p className="text-sm text-amber-300">
                รหัสผ่านใหม่จะถูกตั้งค่าทันที ��ู้ใช้จะต้องใช้รหัสผ่านใหม่ในการเข้าสู่ระบบ
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">รหัสผ่านใหม่</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-slate-800 border-slate-700 font-mono"
                />
                <Button variant="outline" size="icon" onClick={generatePassword}>
                  <RefreshCw className="size-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={copyPassword}>
                  {copiedPassword ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">เหตุผล</Label>
              <Textarea
                placeholder="ระบุเหตุผล เช่น ผู้ใช้ลืมรหัสผ่าน..."
                value={resetReason}
                onChange={(e) => setResetReason(e.target.value)}
                className="bg-slate-800 border-slate-700"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordUser(null)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={processing || !newPassword}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {processing ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <KeyRound className="size-4 mr-2" />
              )}
              รีเซ็ตรหัสผ่าน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
