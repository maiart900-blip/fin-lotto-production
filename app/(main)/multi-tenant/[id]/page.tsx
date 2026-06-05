'use client';

import { useState, useEffect, use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
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
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Building2,
  Globe,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Calendar,
  FileText,
  Crown,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface TenantStats {
  customerCount: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalBetsAmount: number;
  totalWinAmount: number;
  profitLoss: number;
  settlementAmount: number;
  pendingSettlementAmount: number;
  isNegative: boolean;
  statusText: string;
}

interface SettlementReport {
  date: string;
  deposits: number;
  withdrawals: number;
  betsAmount: number;
  winAmount: number;
  profitLoss: number;
  settlementAmount: number;
  status: 'pending' | 'settled' | 'negative';
  settlementId?: string;
  settledAt?: string;
  settledBy?: string;
  notes?: string;
}

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tenantId } = use(params);
  const [period, setPeriod] = useState('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [confirmDialog, setConfirmDialog] = useState<SettlementReport | null>(null);
  const [confirmNotes, setConfirmNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Tenant detail data
  const { data: tenantData, mutate: mutateTenant } = useSWR(
    `/api/tenants/${tenantId}/stats?start_date=${startDate}&end_date=${endDate}`,
    fetcher
  );

  // Settlement reports
  const settlementUrl = `/api/tenants/${tenantId}/settlements?period=${period}&status=${statusFilter}${startDate ? `&start_date=${startDate}` : ''}${endDate ? `&end_date=${endDate}` : ''}`;
  const { data: settlementData, mutate: mutateSettlement } = useSWR(settlementUrl, fetcher);

  const tenant = tenantData?.tenant;
  const stats: TenantStats | null = tenantData?.stats;
  const reports: SettlementReport[] = settlementData?.reports || [];
  const totals = settlementData?.totals;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const handleConfirmSettlement = async () => {
    if (!confirmDialog) return;
    
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/settlements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: confirmDialog.date,
          settlement_amount: confirmDialog.settlementAmount,
          deposits: confirmDialog.deposits,
          withdrawals: confirmDialog.withdrawals,
          bets_amount: confirmDialog.betsAmount,
          win_amount: confirmDialog.winAmount,
          profit_loss: confirmDialog.profitLoss,
          notes: confirmNotes,
        }),
      });

      const data = await res.json();
      
      if (res.ok) {
        toast.success('ยืนยันส่งยอดสำเร็จ');
        setConfirmDialog(null);
        setConfirmNotes('');
        mutateSettlement();
        mutateTenant();
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
        return <Badge variant="outline" className="text-yellow-600 border-yellow-500"><Clock className="size-3 mr-1" />รอส่ง</Badge>;
      case 'settled':
        return <Badge variant="outline" className="text-green-600 border-green-500"><CheckCircle className="size-3 mr-1" />ส่งแล้ว</Badge>;
      case 'negative':
        return <Badge variant="outline" className="text-red-600 border-red-500"><AlertTriangle className="size-3 mr-1" />ติดลบ</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!tenant) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/multi-tenant/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="size-6 text-[#D4AF37]" />
              {tenant.name}
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe className="size-4" />
              <span>{tenant.slug}</span>
              {tenant.domain && (
                <>
                  <span>•</span>
                  <span>{tenant.domain}</span>
                </>
              )}
              <Badge variant={tenant.is_active ? 'default' : 'destructive'} className="ml-2">
                {tenant.is_active ? 'ใช้งาน' : 'ระงับ'}
              </Badge>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => { mutateTenant(); mutateSettlement(); }}>
          <RefreshCw className="size-4 mr-2" />
          รีเฟรช
        </Button>
        <Link href={`/multi-tenant/${tenantId}/auto-config`}>
          <Button className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold hover:from-amber-400 hover:to-amber-500">
            <Crown className="size-4 mr-2" />
            ตั้งค่าระบบออโต้
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">จำนวนลูกค้า</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.customerCount)}</p>
                </div>
                <Users className="size-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-500/20 bg-green-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">ยอดฝากรวม</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalDeposits)}</p>
                  <p className="text-xs text-muted-foreground">บาท</p>
                </div>
                <ArrowUpRight className="size-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/20 bg-red-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">ยอดถอนรวม</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalWithdrawals)}</p>
                  <p className="text-xs text-muted-foreground">บาท</p>
                </div>
                <ArrowDownRight className="size-8 text-red-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className={`border-${stats.profitLoss >= 0 ? 'green' : 'red'}-500/20 bg-${stats.profitLoss >= 0 ? 'green' : 'red'}-500/5`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">กำไร/ขาดทุน</p>
                  <p className={`text-2xl font-bold ${stats.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.profitLoss >= 0 ? '+' : ''}{formatCurrency(stats.profitLoss)}
                  </p>
                  <p className="text-xs text-muted-foreground">บาท</p>
                </div>
                {stats.profitLoss >= 0 ? (
                  <TrendingUp className="size-8 text-green-500/50" />
                ) : (
                  <TrendingDown className="size-8 text-red-500/50" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Settlement Summary */}
      {stats && (
        <Card className={`border-2 ${stats.isNegative ? 'border-red-500/50 bg-red-500/5' : 'border-[#D4AF37]/50 bg-[#D4AF37]/5'}`}>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${stats.isNegative ? 'bg-red-500/20' : 'bg-[#D4AF37]/20'}`}>
                  <DollarSign className={`size-8 ${stats.isNegative ? 'text-red-500' : 'text-[#D4AF37]'}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stats.statusText}</p>
                  <p className={`text-3xl font-bold ${stats.isNegative ? 'text-red-600' : 'text-[#D4AF37]'}`}>
                    {formatCurrency(Math.abs(stats.settlementAmount))} บาท
                  </p>
                </div>
              </div>
              <div className="text-center md:text-right">
                <p className="text-sm text-muted-foreground">ยอดแทงรวม: {formatCurrency(stats.totalBetsAmount)} บาท</p>
                <p className="text-sm text-muted-foreground">ยอดถูกรางวัล: {formatCurrency(stats.totalWinAmount)} บาท</p>
                {stats.pendingSettlementAmount > 0 && (
                  <p className="text-sm text-yellow-600">ยอดค้างส่ง: {formatCurrency(stats.pendingSettlementAmount)} บาท</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settlement Reports */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="size-5 text-[#D4AF37]" />
                รายงานส่งยอดเว็บแม่
              </CardTitle>
              <CardDescription>ตรวจสอบและยืนยันการส่งยอดรายวัน</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">รายวัน</SelectItem>
                  <SelectItem value="weekly">รายสัปดาห์</SelectItem>
                  <SelectItem value="monthly">รายเดือน</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="pending">รอส่ง</SelectItem>
                  <SelectItem value="settled">ส่งแล้ว</SelectItem>
                  <SelectItem value="negative">ติดลบ</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-[140px]"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-[140px]"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Stats */}
          {totals && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 rounded-lg bg-muted/50">
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{totals.pendingCount}</p>
                <p className="text-xs text-muted-foreground">รอส่ง</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{totals.settledCount}</p>
                <p className="text-xs text-muted-foreground">ส่งแล้ว</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{totals.negativeCount}</p>
                <p className="text-xs text-muted-foreground">ติดลบ</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${totals.settlementAmount >= 0 ? 'text-[#D4AF37]' : 'text-red-600'}`}>
                  {formatCurrency(totals.settlementAmount)}
                </p>
                <p className="text-xs text-muted-foreground">ยอดรวม (บาท)</p>
              </div>
            </div>
          )}

          {/* Reports Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead className="text-right">ยอดฝาก</TableHead>
                  <TableHead className="text-right">ยอดถอน</TableHead>
                  <TableHead className="text-right">ยอดแทง</TableHead>
                  <TableHead className="text-right">ยอดถูก</TableHead>
                  <TableHead className="text-right">กำไร/ขาดทุน</TableHead>
                  <TableHead className="text-right">ยอดส่งเว็บแม่</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>หมายเหตุ</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      ไม่มีข้อมูลในช่วงเวลานี้
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.map((report) => (
                    <TableRow key={report.date}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="size-4 text-muted-foreground" />
                          {formatDate(report.date)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(report.deposits)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(report.withdrawals)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(report.betsAmount)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(report.winAmount)}</TableCell>
                      <TableCell className={`text-right ${report.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {report.profitLoss >= 0 ? '+' : ''}{formatCurrency(report.profitLoss)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${report.settlementAmount >= 0 ? 'text-[#D4AF37]' : 'text-red-600'}`}>
                        {formatCurrency(report.settlementAmount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(report.status)}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-muted-foreground">
                        {report.notes || '-'}
                      </TableCell>
                      <TableCell>
                        {report.status === 'pending' && report.settlementAmount >= 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmDialog(report)}
                          >
                            <CheckCircle className="size-3 mr-1" />
                            ยืนยัน
                          </Button>
                        )}
                        {report.status === 'settled' && (
                          <span className="text-xs text-muted-foreground">
                            {report.settledAt && formatDate(report.settledAt)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">รายการธุรกรรมล่าสุด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tenantData?.recentTransactions?.slice(0, 5).map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    {tx.type === 'deposit' ? (
                      <ArrowUpRight className="size-5 text-green-500" />
                    ) : (
                      <ArrowDownRight className="size-5 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium">{tx.type === 'deposit' ? 'ฝาก' : 'ถอน'}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
                    </div>
                  </div>
                  <p className={`font-medium ${tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </p>
                </div>
              )) || (
                <p className="text-center text-muted-foreground py-4">ไม่มีรายการ</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Bets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">รายการแทงล่าสุด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tenantData?.recentBets?.slice(0, 5).map((bet: any) => (
                <div key={bet.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">{bet.customer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {bet.lottery?.name} • {formatDate(bet.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(bet.total_amount)} บาท</p>
                    {bet.total_win_amount > 0 && (
                      <p className="text-xs text-green-600">ถูก {formatCurrency(bet.total_win_amount)}</p>
                    )}
                  </div>
                </div>
              )) || (
                <p className="text-center text-muted-foreground py-4">ไม่มีรายการ</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirm Settlement Dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ยืนยันส่งยอดเว็บแม่</DialogTitle>
            <DialogDescription>
              กรุณาตรวจสอบข้อมูลก่อนยืนยัน (ไม่สามารถยกเลิกได้)
            </DialogDescription>
          </DialogHeader>
          {confirmDialog && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">วันที่</span>
                  <span className="font-medium">{formatDate(confirmDialog.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ยอดฝาก</span>
                  <span className="text-green-600">{formatCurrency(confirmDialog.deposits)} บาท</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ยอดถูกรางวัล</span>
                  <span className="text-red-600">{formatCurrency(confirmDialog.winAmount)} บาท</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="font-medium">ยอดส่งเว็บแม่</span>
                    <span className="font-bold text-[#D4AF37]">{formatCurrency(confirmDialog.settlementAmount)} บาท</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>หมายเหตุ</Label>
                <Textarea
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  placeholder="เพิ่มหมายเหตุ (ถ้ามี)..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDialog(null)} disabled={isProcessing}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleConfirmSettlement}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="size-4 mr-2" />
              ยืนยันส่งยอด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
