'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Users,
  Calendar,
  RefreshCw,
  Download,
  Crown,
  Award,
  Wallet
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface AgentReport {
  agentId: string;
  username: string;
  displayName: string;
  status: string;
  customerCount: number;
  entriesCount: number;
  totalSales: number;
  totalWinnings: number;
  commissionPercent: number;
  commissionAmount: number;
  profit: number;
  profitPercent: string;
}

interface ReportSummary {
  totalAgents: number;
  totalSales: number;
  totalWinnings: number;
  totalCommission: number;
  totalProfit: number;
  totalEntries: number;
  totalCustomers: number;
  period: {
    from: string;
    to: string;
    label: string;
  };
}

export default function AgentReportPage() {
  const [period, setPeriod] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Build URL with params
  const buildUrl = () => {
    let url = `/api/master/agent-report?period=${period}`;
    if (period === 'custom' && startDate && endDate) {
      url += `&start_date=${startDate}&end_date=${endDate}`;
    }
    return url;
  };

  const { data, isLoading, mutate } = useSWR<{
    reports: AgentReport[];
    summary: ReportSummary;
    lastUpdated: string;
  }>(buildUrl(), fetcher, {
    refreshInterval: 10000, // Refresh every 10 seconds
  });

  const reports = data?.reports || [];
  const summary = data?.summary;

  // Export to CSV
  const handleExport = () => {
    if (!reports.length) {
      toast.error('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    const headers = ['ลำดับ', 'ชื่อ', 'Username', 'ลูกค้า', 'รายการ', 'ยอดขาย', 'ถูกรางวัล', 'คอมฯ%', 'คอมฯบาท', 'กำไร/ขาดทุน'];
    const rows = reports.map((r, i) => [
      i + 1,
      r.displayName,
      r.username,
      r.customerCount,
      r.entriesCount,
      r.totalSales,
      r.totalWinnings,
      r.commissionPercent,
      r.commissionAmount,
      r.profit
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-report-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('ส่งออกไฟล์สำเร็จ');
  };

  return (
    <div className="p-6 space-y-6 bg-[#F8FAFC] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-[#0F172A]">
            <BarChart3 className="h-6 w-6 text-[#EAB308]" />
            สรุปยอดตามสายงาน
          </h1>
          <p className="text-[#64748B]">รายงานกำไร-ขาดทุนของลูกสายทั้งหมด</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleExport}
            className="border-[#EAB308] text-[#B8860B]"
          >
            <Download className="h-4 w-4 mr-2" />
            ส่งออก CSV
          </Button>
          <Button 
            variant="outline" 
            onClick={() => mutate()}
            className="border-[#EAB308] text-[#B8860B]"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Period Filter */}
      <Card className="bg-white border-[rgba(234,179,8,0.2)]">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#64748B]" />
              <span className="text-sm font-medium text-[#0F172A]">ช่วงเวลา:</span>
            </div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[150px] bg-white border-[#E2E8F0]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">วันนี้</SelectItem>
                <SelectItem value="yesterday">เมื่อวาน</SelectItem>
                <SelectItem value="week">7 วันล่าสุด</SelectItem>
                <SelectItem value="month">เดือนนี้</SelectItem>
                <SelectItem value="custom">กำหนดเอง</SelectItem>
              </SelectContent>
            </Select>
            {period === 'custom' && (
              <>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-[150px] bg-white"
                />
                <span className="text-[#64748B]">ถึง</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-[150px] bg-white"
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white border-[rgba(234,179,8,0.2)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#64748B]">ยอดขายรวม</CardTitle>
            <DollarSign className="h-4 w-4 text-[#EAB308]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#0F172A]">
              {formatCurrency(summary?.totalSales || 0)}
            </div>
            <p className="text-xs text-[#64748B]">{summary?.totalEntries || 0} รายการ</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-[rgba(234,179,8,0.2)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#64748B]">จ่ายรางวัล</CardTitle>
            <Award className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              -{formatCurrency(summary?.totalWinnings || 0)}
            </div>
            <p className="text-xs text-[#64748B]">ยอดถูกรางวัลทั้งหมด</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-[rgba(234,179,8,0.2)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#64748B]">ค่าคอมมิชชั่น</CardTitle>
            <Wallet className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              -{formatCurrency(summary?.totalCommission || 0)}
            </div>
            <p className="text-xs text-[#64748B]">จ่ายให้ลูกสาย</p>
          </CardContent>
        </Card>

        <Card className={`bg-white border-[rgba(234,179,8,0.2)] ${(summary?.totalProfit || 0) >= 0 ? 'bg-gradient-to-r from-green-50 to-white' : 'bg-gradient-to-r from-red-50 to-white'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#64748B]">กำไรสุทธิ</CardTitle>
            {(summary?.totalProfit || 0) >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(summary?.totalProfit || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(summary?.totalProfit || 0)}
            </div>
            <p className="text-xs text-[#64748B]">
              {summary?.totalSales ? ((summary.totalProfit / summary.totalSales) * 100).toFixed(1) : 0}% margin
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Report Table */}
      <Card className="bg-white border-[rgba(234,179,8,0.2)]">
        <CardHeader>
          <CardTitle className="text-[#B8860B]">รายละเอียดตามสายงาน</CardTitle>
          <CardDescription>เรียงลำดับตามยอดขายสูงสุด</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-[rgba(234,179,8,0.2)]">
                <TableHead className="text-[#64748B]">ลำดับ</TableHead>
                <TableHead className="text-[#64748B]">ลูกสาย</TableHead>
                <TableHead className="text-[#64748B] text-right">ลูกค้า</TableHead>
                <TableHead className="text-[#64748B] text-right">รายการ</TableHead>
                <TableHead className="text-[#64748B] text-right">ยอดขาย</TableHead>
                <TableHead className="text-[#64748B] text-right">ถูกรางวัล</TableHead>
                <TableHead className="text-[#64748B] text-right">คอมฯ</TableHead>
                <TableHead className="text-[#64748B] text-right">กำไร/ขาดทุน</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report, index) => (
                <TableRow key={report.agentId} className="border-[rgba(234,179,8,0.1)] hover:bg-[rgba(234,179,8,0.05)]">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {index < 3 ? (
                        <Crown className={`h-4 w-4 ${
                          index === 0 ? 'text-[#EAB308]' : 
                          index === 1 ? 'text-[#94A3B8]' : 
                          'text-[#CD7F32]'
                        }`} />
                      ) : (
                        <span className="w-4 text-center text-[#64748B]">{index + 1}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-[#0F172A]">{report.displayName}</p>
                      <p className="text-xs text-[#64748B]">@{report.username}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-[#0F172A]">{report.customerCount}</TableCell>
                  <TableCell className="text-right text-[#0F172A]">{report.entriesCount}</TableCell>
                  <TableCell className="text-right font-medium text-[#0F172A]">
                    {formatCurrency(report.totalSales)}
                  </TableCell>
                  <TableCell className="text-right text-red-500">
                    -{formatCurrency(report.totalWinnings)}
                  </TableCell>
                  <TableCell className="text-right text-orange-500">
                    -{formatCurrency(report.commissionAmount)}
                    <span className="text-xs text-[#64748B] ml-1">({report.commissionPercent}%)</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`font-bold ${report.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {formatCurrency(report.profit)}
                    </span>
                    <span className="text-xs text-[#64748B] ml-1">({report.profitPercent}%)</span>
                  </TableCell>
                </TableRow>
              ))}
              {reports.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-[#64748B]">
                    {isLoading ? 'กำลังโหลด...' : 'ไม่พบข้อมูล'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
