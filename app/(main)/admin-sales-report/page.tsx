'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Ticket,
  RefreshCw,
  Download,
  Calendar,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AdminSalesReportPage() {
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');

  const { data, isLoading, mutate } = useSWR(
    `/api/admin-sales-report?date=${selectedDate}&type=${filterType}&mode=${viewMode}`,
    fetcher
  );

  const admins = data?.admins || [];
  const summary = data?.summary || {
    totalSales: 0,
    totalPayout: 0,
    netProfit: 0,
    totalEntries: 0,
    totalCustomers: 0,
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('th-TH').format(num);
  };

  const getTypeBadge = (type: string) => {
    if (type === 'manual_key') {
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">คีย์หวย</Badge>;
    }
    return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">ออโต้</Badge>;
  };

  const exportCSV = () => {
    const headers = ['แอดมิน', 'ประเภท', 'ลูกค้า', 'รายการ', 'ยอดแทง', 'ยอดจ่าย', 'กำไร/ขาดทุน'];
    const rows = admins.map((admin: Record<string, unknown>) => [
      admin.admin_name,
      admin.admin_type === 'manual_key' ? 'คีย์หวย' : 'ออโต้',
      admin.total_customers,
      admin.total_entries,
      admin.total_sales,
      admin.total_payout,
      admin.net_profit,
    ]);
    
    const csvContent = [headers.join(','), ...rows.map((r: unknown[]) => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-sales-${selectedDate}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-green-600">
            <BarChart3 className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">รายงานยอดแอดมิน</h1>
            <p className="text-muted-foreground">ดูยอดแทง ยอดจ่าย และกำไร/ขาดทุน ของแอดมินแต่ละคน</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white border-2 border-amber-400 shadow-lg">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-amber-500" />
              <Input
                type={viewMode === 'daily' ? 'date' : 'month'}
                value={viewMode === 'daily' ? selectedDate : selectedDate.slice(0, 7)}
                onChange={(e) => setSelectedDate(viewMode === 'daily' ? e.target.value : e.target.value + '-01')}
                className="w-40 bg-white border-amber-400 text-neutral-900"
              />
            </div>
            <Select value={viewMode} onValueChange={(v: 'daily' | 'monthly') => setViewMode(v)}>
              <SelectTrigger className="w-28 bg-white border-amber-400 text-neutral-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">รายวัน</SelectItem>
                <SelectItem value="monthly">รายเดือน</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32 bg-white border-amber-400 text-neutral-900">
                <SelectValue placeholder="ประเภท" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="manual_key">คีย์หวย</SelectItem>
                <SelectItem value="auto">ออโต้</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => mutate()} className="border-amber-400 text-amber-600 hover:bg-amber-50">
              <RefreshCw className="size-4 mr-2" />
              รีเฟรช
            </Button>
            <Button onClick={exportCSV} className="bg-gradient-to-r from-amber-500 to-amber-600">
              <Download className="size-4 mr-2" />
              EXPORT CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-white border-2 border-amber-400 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <DollarSign className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">ยอดแทงรวม</p>
                <p className="text-xl font-bold text-neutral-900">฿{formatNumber(summary.totalSales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-2 border-red-400 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <TrendingDown className="size-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">ยอดจ่าย</p>
                <p className="text-xl font-bold text-red-600">฿{formatNumber(summary.totalPayout)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-white border-2 shadow-lg ${summary.netProfit >= 0 ? 'border-green-400' : 'border-red-400'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${summary.netProfit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                {summary.netProfit >= 0 ? <TrendingUp className="size-5 text-green-600" /> : <TrendingDown className="size-5 text-red-600" />}
              </div>
              <div>
                <p className="text-sm text-neutral-600">กำไรสุทธิ</p>
                <p className={`text-xl font-bold ${summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ฿{formatNumber(summary.netProfit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-2 border-blue-400 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Ticket className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">รายการ</p>
                <p className="text-xl font-bold text-neutral-900">{formatNumber(summary.totalEntries)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-2 border-purple-400 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Users className="size-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">ลูกค้า</p>
                <p className="text-xl font-bold text-neutral-900">{formatNumber(summary.totalCustomers)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      <Card className="bg-white border-2 border-amber-400 shadow-lg">
        <CardHeader className="border-b border-amber-200">
          <CardTitle className="flex items-center gap-2 text-neutral-900">
            <BarChart3 className="size-5 text-green-500" />
            ยอดแอดมินแต่ละคน - {viewMode === 'daily' ? selectedDate : selectedDate.slice(0, 7)}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="text-center py-8 text-neutral-600">กำลังโหลด...</div>
          ) : admins.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">ไม่พบข้อมูล</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-amber-200 hover:bg-amber-50">
                  <TableHead className="text-neutral-800 font-semibold">แอดมิน</TableHead>
                  <TableHead className="text-neutral-800 font-semibold text-center">ประเภท</TableHead>
                  <TableHead className="text-neutral-800 font-semibold text-center">ลูกค้า</TableHead>
                  <TableHead className="text-neutral-800 font-semibold text-center">รายการ</TableHead>
                  <TableHead className="text-neutral-800 font-semibold text-right">ยอดแทง</TableHead>
                  <TableHead className="text-neutral-800 font-semibold text-right">ยอดจ่าย</TableHead>
                  <TableHead className="text-neutral-800 font-semibold text-right">กำไร/ขาดทุน</TableHead>
                  <TableHead className="text-neutral-800 font-semibold text-center">สัดส่วน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin: Record<string, unknown>, index: number) => (
                  <TableRow key={index} className="border-amber-100 hover:bg-amber-50">
                    <TableCell className="font-medium text-neutral-900">{admin.admin_name as string}</TableCell>
                    <TableCell className="text-center">{getTypeBadge(admin.admin_type as string)}</TableCell>
                    <TableCell className="text-center text-neutral-900">{formatNumber(admin.total_customers as number)}</TableCell>
                    <TableCell className="text-center text-neutral-900">{formatNumber(admin.total_entries as number)}</TableCell>
                    <TableCell className="text-right font-medium text-neutral-900">฿{formatNumber(admin.total_sales as number)}</TableCell>
                    <TableCell className="text-right text-red-600 font-medium">฿{formatNumber(admin.total_payout as number)}</TableCell>
                    <TableCell className={`text-right font-bold ${(admin.net_profit as number) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(admin.net_profit as number) >= 0 ? '+' : ''}฿{formatNumber(admin.net_profit as number)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-amber-100 text-amber-700 border border-amber-300">
                        {summary.totalSales > 0 ? ((admin.total_sales as number / summary.totalSales) * 100).toFixed(1) : 0}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
