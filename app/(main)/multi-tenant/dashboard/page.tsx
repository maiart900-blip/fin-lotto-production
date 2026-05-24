'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Building2,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Globe,
  Users,
  Receipt,
  ArrowDownToLine,
  Eye,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  is_active: boolean;
  owner_id: string | null;
  created_at: string;
}

interface Settlement {
  id: string;
  tenant_id: string;
  tenant: { id: string; name: string; slug: string } | null;
  period_start: string;
  period_end: string;
  total_bets: number;
  total_wins: number;
  net_profit: number;
  commission_amount: number;
  settlement_amount: number;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  approved_at: string | null;
  notes: string | null;
}

interface DashboardStats {
  totalTenants: number;
  activeTenants: number;
  pendingCount: number;
  pendingAmount: number;
  approvedTodayCount: number;
  approvedTodayAmount: number;
  totalApprovedAmount: number;
  negativeTenants: number;
  totalSettlementAmount: number;
}

export default function MultiTenantDashboardPage() {
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Dashboard data
  const { data: dashboardData, mutate: mutateDashboard } = useSWR<{ tenants: Tenant[], stats: DashboardStats }>(
    '/api/master/dashboard?action=dashboard',
    fetcher,
    { refreshInterval: 30000 }
  );

  // Settlements data
  const { data: settlementsData, mutate: mutateSettlements } = useSWR<{ settlements: Settlement[] }>(
    `/api/master/dashboard?action=settlements&status=${filterStatus}`,
    fetcher
  );

  const stats = dashboardData?.stats;
  const tenants = dashboardData?.tenants || [];
  const settlements = settlementsData?.settlements || [];

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!selectedSettlement) return;
    
    setIsProcessing(true);
    try {
      const res = await fetch('/api/master/dashboard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settlement_id: selectedSettlement.id,
          action,
          notes: actionNotes
        }),
      });

      const data = await res.json();
      
      if (res.ok) {
        toast.success(action === 'approve' ? 'อนุมัติสำเร็จ' : 'ปฏิเสธสำเร็จ');
        setSelectedSettlement(null);
        setActionNotes('');
        mutateDashboard();
        mutateSettlements();
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-500"><Clock className="size-3 mr-1" />รอดำเนินการ</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-green-600 border-green-500"><CheckCircle className="size-3 mr-1" />อนุมัติแล้ว</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-red-600 border-red-500"><XCircle className="size-3 mr-1" />ปฏิเสธ</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="size-6 text-[#D4AF37]" />
            Multi-Tenant Dashboard
          </h1>
          <p className="text-muted-foreground">ภาพรวมเว็บลูกและการส่งยอด</p>
        </div>
        <Button variant="outline" onClick={() => { mutateDashboard(); mutateSettlements(); }}>
          <RefreshCw className="size-4 mr-2" />
          รีเฟรช
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">เว็บลูกทั้งหมด</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats?.totalTenants || 0}
                </p>
                <p className="text-xs text-muted-foreground">ใช้งาน {stats?.activeTenants || 0}</p>
              </div>
              <Globe className="size-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">รอดำเนินการ</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats?.pendingCount || 0}
                </p>
                <p className="text-xs text-muted-foreground">{(stats?.pendingAmount || 0).toLocaleString()} บาท</p>
              </div>
              <Clock className="size-8 text-yellow-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">อนุมัติวันนี้</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats?.approvedTodayCount || 0}
                </p>
                <p className="text-xs text-muted-foreground">{(stats?.approvedTodayAmount || 0).toLocaleString()} บาท</p>
              </div>
              <CheckCircle className="size-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#D4AF37]/20 bg-[#D4AF37]/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ยอดรับรวม</p>
                <p className="text-2xl font-bold text-[#D4AF37]">
                  {(stats?.totalApprovedAmount || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">บาท</p>
              </div>
              <DollarSign className="size-8 text-[#D4AF37]/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ยอดส่งเว็บแม่รวม</p>
                <p className="text-2xl font-bold text-purple-600">
                  {(stats?.totalSettlementAmount || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">บาท</p>
              </div>
              <Receipt className="size-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">เว็บที่ติดลบ</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats?.negativeTenants || 0}
                </p>
                <p className="text-xs text-muted-foreground">เว็บ</p>
              </div>
              <AlertTriangle className="size-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="settlements" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settlements" className="gap-2">
            <Receipt className="size-4" />
            รายการส่งยอด
          </TabsTrigger>
          <TabsTrigger value="tenants" className="gap-2">
            <Globe className="size-4" />
            เว็บลูกทั้งหมด
          </TabsTrigger>
        </TabsList>

        {/* Settlements Tab */}
        <TabsContent value="settlements">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>รายการส่งยอดจากเว็บลูก</CardTitle>
                  <CardDescription>ตรวจสอบและอนุมัติยอดที่ส่งเข้ามา</CardDescription>
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    <SelectItem value="pending">รอดำเนินการ</SelectItem>
                    <SelectItem value="approved">อนุมัติแล้ว</SelectItem>
                    <SelectItem value="rejected">ปฏิเสธ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เว็บลูก</TableHead>
                    <TableHead>วันที่ส่ง</TableHead>
                    <TableHead className="text-right">ยอดแทง</TableHead>
                    <TableHead className="text-right">ยอดถูก</TableHead>
                    <TableHead className="text-right">กำไร</TableHead>
                    <TableHead className="text-right">ยอดส่ง</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        ไม่มีรายการ
                      </TableCell>
                    </TableRow>
                  ) : (
                    settlements.map((settlement) => (
                      <TableRow key={settlement.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{settlement.tenant?.name || '-'}</p>
                            <p className="text-xs text-muted-foreground">{settlement.tenant?.slug || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(settlement.submitted_at)}</TableCell>
                        <TableCell className="text-right">{Number(settlement.total_bets).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-red-600">{Number(settlement.total_wins).toLocaleString()}</TableCell>
                        <TableCell className={`text-right ${Number(settlement.net_profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {Number(settlement.net_profit).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium text-[#D4AF37]">
                          {Number(settlement.settlement_amount).toLocaleString()}
                        </TableCell>
                        <TableCell>{getStatusBadge(settlement.status)}</TableCell>
                        <TableCell>
                          {settlement.status === 'pending' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedSettlement(settlement)}
                            >
                              ดำเนินการ
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tenants Tab */}
        <TabsContent value="tenants">
          <Card>
            <CardHeader>
              <CardTitle>รายการเว็บลูกทั้งหมด</CardTitle>
              <CardDescription>เว็บลูกที่เชื่อมต่อกับเว็บกลาง</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อเว็บ</TableHead>
                    <TableHead>Subdomain</TableHead>
                    <TableHead>โดเมน</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>วันที่สร้าง</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        ยังไม่มีเว็บลูก
                      </TableCell>
                    </TableRow>
                  ) : (
                    tenants.map((tenant) => (
                      <TableRow key={tenant.id}>
                        <TableCell className="font-medium">{tenant.name}</TableCell>
                        <TableCell>{tenant.slug}</TableCell>
                        <TableCell>{tenant.domain || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={tenant.is_active !== false ? 'default' : 'destructive'}>
                            {tenant.is_active !== false ? 'ใช้งาน' : 'ระงับ'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(tenant.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/multi-tenant/${tenant.id}`}>
                              <Button size="sm" variant="outline">
                                <Eye className="size-3 mr-1" />
                                ดูรายละเอียด
                              </Button>
                            </Link>
                            <Link href={`/multi-tenant/${tenant.id}?tab=settlements`}>
                              <Button size="sm" variant="outline">
                                <FileText className="size-3 mr-1" />
                                รายงานส่งยอด
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={!!selectedSettlement} onOpenChange={() => setSelectedSettlement(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ดำเนินการกับยอดส่ง</DialogTitle>
          </DialogHeader>
          {selectedSettlement && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">เว็บลูก</span>
                  <span className="font-medium">{selectedSettlement.tenant?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ยอดส่ง</span>
                  <span className="font-bold text-[#D4AF37]">{Number(selectedSettlement.settlement_amount).toLocaleString()} บาท</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">กำไร</span>
                  <span className={Number(selectedSettlement.net_profit) >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {Number(selectedSettlement.net_profit).toLocaleString()} บาท
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>หมายเหตุ</Label>
                <Textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="เพิ่มหมายเหตุ (ถ้ามี)..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button 
              variant="destructive" 
              onClick={() => handleAction('reject')}
              disabled={isProcessing}
            >
              <XCircle className="size-4 mr-2" />
              ปฏิเสธ
            </Button>
            <Button 
              onClick={() => handleAction('approve')}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="size-4 mr-2" />
              อนุมัติ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
