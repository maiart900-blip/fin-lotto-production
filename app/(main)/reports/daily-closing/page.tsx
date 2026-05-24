'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
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
  total_payouts: number;
  payout_count: number;
  total_sales: number;
  pending_balance: number;
  gross_profit: number;
  net_profit: number;
  agent_commission: number;
  total_customers: number;
  new_customers: number;
  active_customers: number;
  status: string;
}

interface MonthlySummary {
  year: number;
  month: number;
  total_deposits: number;
  total_withdrawals: number;
  total_bets: number;
  total_payouts: number;
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
  total_payouts: number;
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

  // Fetch data
  const fetchDailyData = useCallback(async () => {
    setIsLoading(true);
    try {
      const startDate = format(dateRange.from, 'yyyy-MM-dd');
      const endDate = format(dateRange.to, 'yyyy-MM-dd');
      
      const res = await fetch(`/api/admin/daily-closing?type=daily&startDate=${startDate}&endDate=${endDate}`);
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
  }, [dateRange]);

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

  useEffect(() => {
    if (activeTab === 'daily') {
      fetchDailyData();
    } else if (activeTab === 'monthly') {
      fetchMonthlyData();
    } else if (activeTab === 'yearly') {
      fetchYearlyData();
    }
  }, [activeTab, fetchDailyData, fetchMonthlyData, fetchYearlyData]);

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
    payouts: acc.payouts + Number(day.total_payouts),
    netProfit: acc.netProfit + Number(day.net_profit),
    commission: acc.commission + Number(day.agent_commission),
  }), { deposits: 0, withdrawals: 0, bets: 0, payouts: 0, netProfit: 0, commission: 0 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">รายงานย้อนหลัง</h1>
          <p className="text-slate-500 text-sm mt-1">
            Daily Closing - สรุปรายวัน/เดือน/ปี
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-2">
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <ArrowUpCircle className="h-4 w-4 text-green-500" />
                  ยอดฝากรวม
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
                  ยอดถอนรวม
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
                  ยอดแทงรวม
                </div>
                <p className="text-lg font-bold text-blue-600">
                  {formatCurrency(dailyTotals.bets)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <Wallet className="h-4 w-4 text-orange-500" />
                  ยอดจ่ายรวม
                </div>
                <p className="text-lg font-bold text-orange-600">
                  {formatCurrency(dailyTotals.payouts)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <DollarSign className="h-4 w-4 text-amber-500" />
                  ค่าคอมรวม
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
                      <TableHead className="text-right">ค่าคอม</TableHead>
                      <TableHead className="text-right">กำไรสุทธิ</TableHead>
                      <TableHead className="text-right">สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                          ไม่พบข้อมูล
                        </TableCell>
                      </TableRow>
                    ) : (
                      dailyData.map((day) => (
                        <TableRow key={day.id}>
                          <TableCell className="font-medium">
                            {formatDate(day.closing_date)}
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
                          <TableCell className="text-right text-amber-600">
                            {formatCurrency(Number(day.agent_commission))}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-medium",
                            Number(day.net_profit) >= 0 ? "text-emerald-600" : "text-red-600"
                          )}>
                            {formatCurrency(Number(day.net_profit))}
                          </TableCell>
                          <TableCell className="text-right">
                            {day.status === 'finalized' && (
                              <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50">
                                <CheckCircle2 className="h-3 w-3" />
                                ปิดยอดแล้ว
                              </Badge>
                            )}
                            {day.status === 'closed' && (
                              <Badge variant="outline" className="gap-1 text-blue-600 border-blue-200 bg-blue-50">
                                <CheckCircle2 className="h-3 w-3" />
                                ปิดยอด
                              </Badge>
                            )}
                            {day.status === 'open' && (
                              <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200 bg-amber-50">
                                <Clock className="h-3 w-3" />
                                ยังไม่ปิด
                              </Badge>
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
                      <TableHead className="text-right">ค่าคอม</TableHead>
                      <TableHead className="text-right">กำไรสุทธิ</TableHead>
                      <TableHead className="text-right">สมาชิกใหม่</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-slate-500">
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
                          <TableCell className="text-right text-amber-600">
                            {formatCurrency(Number(month.agent_commission))}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-medium",
                            Number(month.net_profit) >= 0 ? "text-emerald-600" : "text-red-600"
                          )}>
                            {formatCurrency(Number(month.net_profit))}
                          </TableCell>
                          <TableCell className="text-right">
                            {month.new_customers} คน
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
                แสดงข้อมูลสรุปทั้งหมดแยกตามปี
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
                      <TableHead className="text-right">ค่าคอม</TableHead>
                      <TableHead className="text-right">กำไรสุทธิ</TableHead>
                      <TableHead className="text-right">สมาชิกใหม่</TableHead>
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
                          <TableCell className="font-medium">
                            {year.year}
                          </TableCell>
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
                          <TableCell className="text-right text-amber-600">
                            {formatCurrency(Number(year.agent_commission))}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-medium",
                            Number(year.net_profit) >= 0 ? "text-emerald-600" : "text-red-600"
                          )}>
                            {formatCurrency(Number(year.net_profit))}
                          </TableCell>
                          <TableCell className="text-right">
                            {year.new_customers} คน
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
    </div>
  );
}
