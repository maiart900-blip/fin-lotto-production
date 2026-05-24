'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  CalendarIcon, 
  Download, 
  FileSpreadsheet,
  FileText,
  TrendingUp, 
  TrendingDown,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  DollarSign,
  Users,
  BarChart3,
  RefreshCw,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  AlertTriangle,
  Search,
  Eye,
  History,
  Shield,
  Gift,
  Percent,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DailyClosingData {
  id: string;
  closing_date: string;
  closing_time: string;
  total_deposits: number;
  deposit_count: number;
  total_withdrawals: number;
  withdrawal_count: number;
  total_bets: number;
  bet_count: number;
  total_winnings: number;
  winning_count: number;
  total_payouts: number;
  payout_count: number;
  total_bonuses: number;
  bonus_count: number;
  total_sales: number;
  pending_balance: number;
  pending_withdrawals: number;
  pending_payouts: number;
  gross_profit: number;
  net_profit: number;
  agent_commission: number;
  agent_count: number;
  total_customers: number;
  new_customers: number;
  active_customers: number;
  status: string;
  closing_type: string;
  is_locked: boolean;
  has_anomalies: boolean;
  anomaly_flags?: AnomalyFlag[];
  breakdown?: Record<string, unknown>;
}

interface AnomalyFlag {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  amount?: number;
}

interface AuditLog {
  id: string;
  action: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  performer_name: string;
  performer_role: string;
  reason: string;
  created_at: string;
}

interface MonthlySummary {
  year: number;
  month: number;
  total_deposits: number;
  total_withdrawals: number;
  total_bets: number;
  total_winnings: number;
  total_payouts: number;
  total_bonuses: number;
  total_sales: number;
  gross_profit: number;
  net_profit: number;
  agent_commission: number;
  new_customers: number;
  days_count: number;
}

interface YearlySummary {
  year: number;
  total_deposits: number;
  total_withdrawals: number;
  total_bets: number;
  total_winnings: number;
  total_payouts: number;
  total_bonuses: number;
  total_sales: number;
  gross_profit: number;
  net_profit: number;
  agent_commission: number;
  new_customers: number;
}

const monthNames = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return format(date, 'd MMM yyyy', { locale: th });
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return format(date, 'd MMM yyyy HH:mm', { locale: th });
}

export default function DailyClosingReportsPage() {
  const [activeTab, setActiveTab] = useState('daily');
  const [dailyData, setDailyData] = useState<DailyClosingData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlySummary[]>([]);
  const [yearlyData, setYearlyData] = useState<YearlySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // Search filters
  const [searchUserId, setSearchUserId] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [searchBetId, setSearchBetId] = useState('');
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false);

  // Selected day for detail view
  const [selectedDay, setSelectedDay] = useState<DailyClosingData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyFlag[]>([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Lock/Unlock dialog
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');

  // Manual close dialog
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');

  // Fetch data
  const fetchDailyData = useCallback(async () => {
    setIsLoading(true);
    try {
      const startDate = format(dateRange.from, 'yyyy-MM-dd');
      const endDate = format(dateRange.to, 'yyyy-MM-dd');
      
      let url = `/api/admin/daily-closing?type=daily&startDate=${startDate}&endDate=${endDate}`;
      
      if (showAnomaliesOnly) {
        url = `/api/admin/daily-closing?type=search&startDate=${startDate}&endDate=${endDate}&hasAnomalies=true`;
      }
      
      const res = await fetch(url);
      const json = await res.json();
      
      if (json.data) {
        setDailyData(json.data);
      }
    } catch (error) {
      console.error('Error fetching daily data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลรายวันได้');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, showAnomaliesOnly]);

  const fetchMonthlyData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/daily-closing?type=monthly&year=${selectedYear}`);
      const json = await res.json();
      
      if (json.data) {
        setMonthlyData(json.data);
      }
    } catch (error) {
      console.error('Error fetching monthly data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลรายเดือนได้');
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  const fetchYearlyData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/daily-closing?type=yearly`);
      const json = await res.json();
      
      if (json.data) {
        setYearlyData(json.data);
      }
    } catch (error) {
      console.error('Error fetching yearly data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลรายปีได้');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDayDetails = async (day: DailyClosingData) => {
    setSelectedDay(day);
    setIsDetailOpen(true);

    // Fetch audit logs
    try {
      const auditRes = await fetch(`/api/admin/daily-closing?type=audit-logs&date=${day.closing_date}`);
      const auditJson = await auditRes.json();
      setAuditLogs(auditJson.data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }

    // Fetch anomalies
    try {
      const anomalyRes = await fetch(`/api/admin/daily-closing?type=anomalies&date=${day.closing_date}`);
      const anomalyJson = await anomalyRes.json();
      setAnomalies(anomalyJson.data || []);
    } catch (error) {
      console.error('Error fetching anomalies:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'daily') {
      fetchDailyData();
    } else if (activeTab === 'monthly') {
      fetchMonthlyData();
    } else if (activeTab === 'yearly') {
      fetchYearlyData();
    }
  }, [activeTab, fetchDailyData, fetchMonthlyData, fetchYearlyData]);

  // Manual Close
  const handleManualClose = async () => {
    try {
      const res = await fetch('/api/admin/daily-closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          notes: closeNotes,
        }),
      });

      const json = await res.json();

      if (json.success) {
        toast.success('ปิดยอดประจำวันสำเร็จ');
        setCloseDialogOpen(false);
        setCloseNotes('');
        fetchDailyData();
      } else {
        toast.error(json.error || 'ไม่สามารถปิดยอดได้');
      }
    } catch (error) {
      console.error('Error closing:', error);
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  // Lock
  const handleLock = async (date: string) => {
    try {
      const res = await fetch('/api/admin/daily-closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lock',
          date,
        }),
      });

      const json = await res.json();

      if (json.success) {
        toast.success('ล็อกข้อมูลสำเร็จ');
        setLockDialogOpen(false);
        fetchDailyData();
      } else {
        toast.error(json.error || 'ไม่สามารถล็อกได้');
      }
    } catch (error) {
      console.error('Error locking:', error);
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  // Unlock
  const handleUnlock = async (date: string) => {
    if (!unlockReason.trim()) {
      toast.error('กรุณาระบุเหตุผล');
      return;
    }

    try {
      const res = await fetch('/api/admin/daily-closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unlock',
          date,
          reason: unlockReason,
        }),
      });

      const json = await res.json();

      if (json.success) {
        toast.success('ปลดล็อกข้อมูลสำเร็จ');
        setUnlockDialogOpen(false);
        setUnlockReason('');
        fetchDailyData();
      } else {
        toast.error(json.error || 'ไม่สามารถปลดล็อกได้');
      }
    } catch (error) {
      console.error('Error unlocking:', error);
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  // Export handlers
  const handleExportExcel = async () => {
    toast.info('กำลังสร้างไฟล์ Excel...');
    try {
      const params = new URLSearchParams({
        type: activeTab,
        format: 'excel',
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd'),
        year: selectedYear.toString(),
      });
      
      const res = await fetch(`/api/admin/daily-closing/export?${params}`);
      
      if (!res.ok) throw new Error('Export failed');
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-closing-${activeTab}-${format(new Date(), 'yyyyMMdd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('ดาวน์โหลดไฟล์ Excel สำเร็จ');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('ไม่สามารถ Export ไฟล์ได้');
    }
  };

  const handleExportPDF = async () => {
    toast.info('กำลังสร้างไฟล์ PDF...');
    try {
      const params = new URLSearchParams({
        type: activeTab,
        format: 'pdf',
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd'),
        year: selectedYear.toString(),
      });
      
      const res = await fetch(`/api/admin/daily-closing/export?${params}`);
      
      if (!res.ok) throw new Error('Export failed');
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-closing-${activeTab}-${format(new Date(), 'yyyyMMdd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('ดาวน์โหลดไฟล์ PDF สำเร็จ');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('ไม่สามารถ Export ไฟล์ได้');
    }
  };

  // Calculate totals
  const dailyTotals = dailyData.reduce((acc, day) => ({
    deposits: acc.deposits + Number(day.total_deposits),
    withdrawals: acc.withdrawals + Number(day.total_withdrawals),
    bets: acc.bets + Number(day.total_bets),
    winnings: acc.winnings + Number(day.total_winnings || 0),
    payouts: acc.payouts + Number(day.total_payouts),
    bonuses: acc.bonuses + Number(day.total_bonuses || 0),
    netProfit: acc.netProfit + Number(day.net_profit),
    commission: acc.commission + Number(day.agent_commission),
  }), { deposits: 0, withdrawals: 0, bets: 0, winnings: 0, payouts: 0, bonuses: 0, netProfit: 0, commission: 0 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">รายงานย้อนหลัง</h1>
          <p className="text-slate-500 text-sm mt-1">
            Daily Closing - สรุปรายวัน/เดือน/ปี พร้อม Audit Log
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Manual Close Button */}
          <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm" className="gap-2 bg-amber-600 hover:bg-amber-700">
                <CheckCircle2 className="h-4 w-4" />
                ปิดยอดวันนี้
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ปิดยอดประจำวัน</DialogTitle>
                <DialogDescription>
                  ยืนยันการปิดยอดประจำวัน ข้อมูลจะถูกบันทึกและสามารถดูย้อนหลังได้
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>หมายเหตุ (ถ้ามี)</Label>
                  <Textarea
                    placeholder="ระบุหมายเหตุสำหรับการปิดยอดครั้งนี้..."
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>ยกเลิก</Button>
                <Button onClick={handleManualClose} className="bg-amber-600 hover:bg-amber-700">
                  ยืนยันปิดยอด
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
            <FileText className="h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="daily">รายวัน</TabsTrigger>
            <TabsTrigger value="monthly">รายเดือน</TabsTrigger>
            <TabsTrigger value="yearly">รายปี</TabsTrigger>
          </TabsList>

          {/* Date Filter */}
          {activeTab === 'daily' && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={showAnomaliesOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAnomaliesOnly(!showAnomaliesOnly)}
                className="gap-1"
              >
                <AlertTriangle className="h-4 w-4" />
                เฉพาะผิดปกติ
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {format(dateRange.from, 'd MMM', { locale: th })} - {format(dateRange.to, 'd MMM yyyy', { locale: th })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: range.from, to: range.to });
                      }
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="icon" onClick={fetchDailyData} disabled={isLoading}>
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            </div>
          )}

          {activeTab === 'monthly' && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedYear(selectedYear - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium w-16 text-center">{selectedYear}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedYear(selectedYear + 1)}
                disabled={selectedYear >= new Date().getFullYear()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={fetchMonthlyData} disabled={isLoading}>
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            </div>
          )}
        </div>

        {/* Daily Tab */}
        <TabsContent value="daily" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <ArrowUpCircle className="h-4 w-4 text-green-500" />
                  ยอดฝาก
                </div>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(dailyTotals.deposits)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <ArrowDownCircle className="h-4 w-4 text-red-500" />
                  ยอดถอน
                </div>
                <p className="text-lg font-bold text-red-600">
                  {formatCurrency(dailyTotals.withdrawals)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                  ยอดแทง
                </div>
                <p className="text-lg font-bold text-blue-600">
                  {formatCurrency(dailyTotals.bets)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  ยอดถูก
                </div>
                <p className="text-lg font-bold text-emerald-600">
                  {formatCurrency(dailyTotals.winnings)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <Wallet className="h-4 w-4 text-orange-500" />
                  ยอดจ่าย
                </div>
                <p className="text-lg font-bold text-orange-600">
                  {formatCurrency(dailyTotals.payouts)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <Gift className="h-4 w-4 text-pink-500" />
                  โบนัส
                </div>
                <p className="text-lg font-bold text-pink-600">
                  {formatCurrency(dailyTotals.bonuses)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <Percent className="h-4 w-4 text-amber-500" />
                  ค่าคอม
                </div>
                <p className="text-lg font-bold text-amber-600">
                  {formatCurrency(dailyTotals.commission)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  {dailyTotals.netProfit >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  กำไรสุทธิ
                </div>
                <p className={cn(
                  "text-lg font-bold",
                  dailyTotals.netProfit >= 0 ? "text-emerald-600" : "text-red-600"
                )}>
                  {formatCurrency(dailyTotals.netProfit)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">รายการสรุปรายวัน</CardTitle>
              <CardDescription>
                แสดง {dailyData.length} รายการ ({format(dateRange.from, 'd MMM', { locale: th })} - {format(dateRange.to, 'd MMM yyyy', { locale: th })})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>วันที่</TableHead>
                      <TableHead className="text-right">ยอดฝาก</TableHead>
                      <TableHead className="text-right">ยอดถอน</TableHead>
                      <TableHead className="text-right">ยอดแทง</TableHead>
                      <TableHead className="text-right">ยอดจ่าย</TableHead>
                      <TableHead className="text-right">โบนัส</TableHead>
                      <TableHead className="text-right">ค่าคอม</TableHead>
                      <TableHead className="text-right">กำไรสุทธิ</TableHead>
                      <TableHead className="text-center">สถานะ</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                          ไม่พบข้อมูล
                        </TableCell>
                      </TableRow>
                    ) : (
                      dailyData.map((day) => (
                        <TableRow key={day.id} className={cn(day.has_anomalies && "bg-red-50")}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {formatDate(day.closing_date)}
                              {day.has_anomalies && (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              )}
                              {day.is_locked && (
                                <Lock className="h-4 w-4 text-slate-400" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCurrency(Number(day.total_deposits))}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {formatCurrency(Number(day.total_withdrawals))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(day.total_bets))}
                          </TableCell>
                          <TableCell className="text-right text-orange-600">
                            {formatCurrency(Number(day.total_payouts))}
                          </TableCell>
                          <TableCell className="text-right text-pink-600">
                            {formatCurrency(Number(day.total_bonuses || 0))}
                          </TableCell>
                          <TableCell className="text-right text-amber-600">
                            {formatCurrency(Number(day.agent_commission))}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-medium",
                            Number(day.net_profit) >= 0 ? "text-emerald-600" : "text-red-600"
                          )}>
                            {formatCurrency(Number(day.net_profit))}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {day.is_locked ? (
                                <Badge variant="outline" className="gap-1 text-slate-600 border-slate-300 bg-slate-50">
                                  <Lock className="h-3 w-3" />
                                  ล็อก
                                </Badge>
                              ) : day.status === 'finalized' || day.status === 'closed' ? (
                                <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50">
                                  <CheckCircle2 className="h-3 w-3" />
                                  ปิดยอด
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200 bg-amber-50">
                                  <Clock className="h-3 w-3" />
                                  ยังไม่ปิด
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => fetchDayDetails(day)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {!day.is_locked && day.status === 'closed' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-500 hover:text-slate-700"
                                  onClick={() => {
                                    setSelectedDay(day);
                                    setLockDialogOpen(true);
                                  }}
                                >
                                  <Lock className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Tab */}
        <TabsContent value="monthly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">สรุปรายเดือน ปี {selectedYear}</CardTitle>
              <CardDescription>
                แสดงข้อมูลสรุปรายเดือนทั้งปี
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เดือน</TableHead>
                      <TableHead className="text-right">ยอดฝาก</TableHead>
                      <TableHead className="text-right">ยอดถอน</TableHead>
                      <TableHead className="text-right">ยอดแทง</TableHead>
                      <TableHead className="text-right">ยอดจ่าย</TableHead>
                      <TableHead className="text-right">โบนัส</TableHead>
                      <TableHead className="text-right">ค่าคอม</TableHead>
                      <TableHead className="text-right">กำไรสุทธิ</TableHead>
                      <TableHead className="text-center">วัน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                          ไม่พบข้อมูล
                        </TableCell>
                      </TableRow>
                    ) : (
                      monthlyData.map((month) => (
                        <TableRow key={`${month.year}-${month.month}`}>
                          <TableCell className="font-medium">
                            {monthNames[month.month - 1]}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCurrency(Number(month.total_deposits))}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {formatCurrency(Number(month.total_withdrawals))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(month.total_bets))}
                          </TableCell>
                          <TableCell className="text-right text-orange-600">
                            {formatCurrency(Number(month.total_payouts))}
                          </TableCell>
                          <TableCell className="text-right text-pink-600">
                            {formatCurrency(Number(month.total_bonuses || 0))}
                          </TableCell>
                          <TableCell className="text-right text-amber-600">
                            {formatCurrency(Number(month.agent_commission))}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-medium",
                            Number(month.net_profit) >= 0 ? "text-emerald-600" : "text-red-600"
                          )}>
                            {formatCurrency(Number(month.net_profit))}
                          </TableCell>
                          <TableCell className="text-center">
                            {month.days_count}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Yearly Tab */}
        <TabsContent value="yearly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">สรุปรายปี</CardTitle>
              <CardDescription>
                แสดงข้อมูลสรุปรายปีทั้งหมด
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ปี</TableHead>
                      <TableHead className="text-right">ยอดฝาก</TableHead>
                      <TableHead className="text-right">ยอดถอน</TableHead>
                      <TableHead className="text-right">ยอดแทง</TableHead>
                      <TableHead className="text-right">ยอดจ่าย</TableHead>
                      <TableHead className="text-right">โบนัส</TableHead>
                      <TableHead className="text-right">ค่าคอม</TableHead>
                      <TableHead className="text-right">กำไรสุทธิ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {yearlyData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                          ไม่พบข้อมูล
                        </TableCell>
                      </TableRow>
                    ) : (
                      yearlyData.map((year) => (
                        <TableRow key={year.year}>
                          <TableCell className="font-medium">{year.year}</TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCurrency(Number(year.total_deposits))}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {formatCurrency(Number(year.total_withdrawals))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(year.total_bets))}
                          </TableCell>
                          <TableCell className="text-right text-orange-600">
                            {formatCurrency(Number(year.total_payouts))}
                          </TableCell>
                          <TableCell className="text-right text-pink-600">
                            {formatCurrency(Number(year.total_bonuses || 0))}
                          </TableCell>
                          <TableCell className="text-right text-amber-600">
                            {formatCurrency(Number(year.agent_commission))}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-medium",
                            Number(year.net_profit) >= 0 ? "text-emerald-600" : "text-red-600"
                          )}>
                            {formatCurrency(Number(year.net_profit))}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              รายละเอียด: {selectedDay && formatDate(selectedDay.closing_date)}
              {selectedDay?.is_locked && (
                <Badge variant="outline" className="gap-1 text-slate-600">
                  <Lock className="h-3 w-3" />
                  ล็อกแล้ว
                </Badge>
              )}
              {selectedDay?.has_anomalies && (
                <Badge variant="outline" className="gap-1 text-red-600 border-red-200 bg-red-50">
                  <AlertTriangle className="h-3 w-3" />
                  พบความผิดปกติ
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-[60vh]">
            {selectedDay && (
              <div className="space-y-6 p-1">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-slate-500">ยอดฝาก</p>
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(Number(selectedDay.total_deposits))}
                      </p>
                      <p className="text-xs text-slate-400">{selectedDay.deposit_count} รายการ</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-slate-500">ยอดถอน</p>
                      <p className="text-lg font-bold text-red-600">
                        {formatCurrency(Number(selectedDay.total_withdrawals))}
                      </p>
                      <p className="text-xs text-slate-400">{selectedDay.withdrawal_count} รายการ</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-slate-500">ยอดแทง</p>
                      <p className="text-lg font-bold text-blue-600">
                        {formatCurrency(Number(selectedDay.total_bets))}
                      </p>
                      <p className="text-xs text-slate-400">{selectedDay.bet_count} รายการ</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-slate-500">กำไรสุทธิ</p>
                      <p className={cn(
                        "text-lg font-bold",
                        Number(selectedDay.net_profit) >= 0 ? "text-emerald-600" : "text-red-600"
                      )}>
                        {formatCurrency(Number(selectedDay.net_profit))}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed Breakdown */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">รายละเอียดยอดทั้งหมด</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">ยอดถูกรางวัล</p>
                        <p className="font-medium">{formatCurrency(Number(selectedDay.total_winnings || 0))}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">ยอดจ่ายรางวัล</p>
                        <p className="font-medium">{formatCurrency(Number(selectedDay.total_payouts))}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">โบนัส</p>
                        <p className="font-medium">{formatCurrency(Number(selectedDay.total_bonuses || 0))}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">ค่าคอมเอเย่น</p>
                        <p className="font-medium">{formatCurrency(Number(selectedDay.agent_commission))}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">ยอดค้างจ่าย</p>
                        <p className="font-medium">{formatCurrency(Number(selectedDay.pending_payouts || 0))}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">ยอดค้างถอน</p>
                        <p className="font-medium">{formatCurrency(Number(selectedDay.pending_withdrawals || 0))}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Customer Stats */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      สถิติสมาชิก
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">สมาชิกทั้งหมด</p>
                        <p className="font-medium">{selectedDay.total_customers.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">สมาชิกใหม่</p>
                        <p className="font-medium text-green-600">{selectedDay.new_customers}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Active วันนี้</p>
                        <p className="font-medium text-blue-600">{selectedDay.active_customers}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Anomalies */}
                {anomalies.length > 0 && (
                  <Card className="border-red-200">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-4 w-4" />
                        รายการผิดปกติ ({anomalies.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-2">
                      <div className="space-y-2">
                        {anomalies.map((anomaly, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-2 rounded-lg bg-red-50">
                            <AlertTriangle className={cn(
                              "h-4 w-4 mt-0.5",
                              anomaly.severity === 'critical' ? "text-red-600" :
                              anomaly.severity === 'warning' ? "text-amber-600" : "text-blue-600"
                            )} />
                            <div>
                              <p className="font-medium text-sm">{anomaly.title}</p>
                              <p className="text-xs text-slate-600">{anomaly.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Audit Logs */}
                {auditLogs.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <History className="h-4 w-4" />
                        ประวัติการแก้ไข ({auditLogs.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-2">
                      <div className="space-y-2">
                        {auditLogs.map((log) => (
                          <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg bg-slate-50">
                            <Shield className="h-4 w-4 text-slate-400 mt-0.5" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm">{log.action}</p>
                                <p className="text-xs text-slate-400">{formatDateTime(log.created_at)}</p>
                              </div>
                              <p className="text-xs text-slate-600">
                                โดย: {log.performer_name} ({log.performer_role})
                              </p>
                              {log.reason && (
                                <p className="text-xs text-slate-500 mt-1">เหตุผล: {log.reason}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="gap-2">
            {selectedDay && !selectedDay.is_locked && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDetailOpen(false);
                  setLockDialogOpen(true);
                }}
                className="gap-1"
              >
                <Lock className="h-4 w-4" />
                ล็อกข้อมูล
              </Button>
            )}
            {selectedDay && selectedDay.is_locked && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDetailOpen(false);
                  setUnlockDialogOpen(true);
                }}
                className="gap-1 text-amber-600 border-amber-200"
              >
                <Unlock className="h-4 w-4" />
                ปลดล็อก (Super Admin)
              </Button>
            )}
            <Button variant="ghost" onClick={() => setIsDetailOpen(false)}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lock Dialog */}
      <Dialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ล็อกข้อมูล Daily Closing</DialogTitle>
            <DialogDescription>
              เมื่อล็อกแล้ว ข้อมูลจะไม่สามารถแก้ไขได้ ยกเว้น Super Admin เท่านั้น
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600">
              ยืนยันการล็อกข้อมูลวันที่ <strong>{selectedDay && formatDate(selectedDay.closing_date)}</strong>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLockDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={() => selectedDay && handleLock(selectedDay.closing_date)}>
              ยืนยันล็อก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock Dialog */}
      <Dialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-amber-600">ปลดล็อกข้อมูล (Super Admin Only)</DialogTitle>
            <DialogDescription>
              กรุณาระบุเหตุผลในการปลดล็อก การกระทำนี้จะถูกบันทึกใน Audit Log
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>เหตุผลในการปลดล็อก *</Label>
              <Textarea
                placeholder="ระบุเหตุผลในการปลดล็อกข้อมูล..."
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockDialogOpen(false)}>ยกเลิก</Button>
            <Button 
              onClick={() => selectedDay && handleUnlock(selectedDay.closing_date)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              ยืนยันปลดล็อก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
