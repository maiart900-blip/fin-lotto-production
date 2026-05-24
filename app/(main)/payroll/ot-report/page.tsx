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
  Clock,
  DollarSign,
  TrendingUp,
  Users,
  RefreshCw,
  Download,
  Calendar,
  Timer,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function OTReportPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterType, setFilterType] = useState<string>('all');

  const { data, isLoading, mutate } = useSWR(
    `/api/payroll/ot-report?month=${selectedMonth}&type=${filterType}`,
    fetcher
  );

  const admins = data?.admins || [];
  const summary = data?.summary || {
    totalAdmins: 0,
    totalOTHours: 0,
    totalOTPay: 0,
    avgOTHours: 0,
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
    const headers = ['แอดมิน', 'ประเภท', 'วันทำงาน', 'ชม.ปกติ', 'ชม.OT', 'ค่าOT (บาท)'];
    const rows = admins.map((admin: Record<string, unknown>) => [
      admin.admin_name,
      admin.admin_type === 'manual_key' ? 'คีย์หวย' : 'ออโต้',
      admin.work_days,
      admin.regular_hours,
      admin.ot_hours,
      admin.ot_pay,
    ]);
    
    const csvContent = [headers.join(','), ...rows.map((r: unknown[]) => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ot-report-${selectedMonth}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600">
            <Timer className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">รายงานโอที (OT)</h1>
            <p className="text-slate-500">สรุปชั่วโมงล่วงเวลาและค่าตอบแทนของแอดมิน</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-slate-500" />
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-40 bg-white border-slate-200"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32 bg-white border-slate-200">
                <SelectValue placeholder="ประเภท" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="manual_key">คีย์หวย</SelectItem>
                <SelectItem value="auto">ออโต้</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => mutate()}>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/30">
                <Users className="size-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-blue-200/80">แอดมินที่มี OT</p>
                <p className="text-2xl font-bold text-white">{summary.totalAdmins}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/30">
                <Clock className="size-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-purple-200/80">ชั่วโมง OT รวม</p>
                <p className="text-2xl font-bold text-white">{summary.totalOTHours?.toFixed(1) || 0} ชม.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/30">
                <DollarSign className="size-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-green-200/80">ค่า OT รวม</p>
                <p className="text-2xl font-bold text-green-400">฿{formatNumber(summary.totalOTPay || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/30">
                <TrendingUp className="size-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-amber-200/80">เฉลี่ย OT/คน</p>
                <p className="text-2xl font-bold text-white">{summary.avgOTHours?.toFixed(1) || 0} ชม.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* OT Rate Info */}
      <Card className="bg-gradient-to-r from-purple-500/10 to-purple-600/5 border-purple-500/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Timer className="size-5 text-purple-400" />
            <div className="text-sm">
              <span className="text-purple-200">อัตราค่าล่วงเวลา:</span>
              <span className="font-bold text-white ml-2">฿45 / ชั่วโมง</span>
              <span className="text-slate-500 ml-4">(ทำงานเกิน 8 ชม./วัน ถือเป็น OT)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OT Table */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="size-5 text-purple-500" />
            รายละเอียด OT - {selectedMonth}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">กำลังโหลด...</div>
          ) : admins.length === 0 ? (
            <div className="text-center py-8 text-slate-500">ไม่พบข้อมูล OT ในเดือนนี้</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead>แอดมิน</TableHead>
                  <TableHead className="text-center">ประเภท</TableHead>
                  <TableHead className="text-center">วันทำงาน</TableHead>
                  <TableHead className="text-center">ชม.ปกติ</TableHead>
                  <TableHead className="text-center">ชม.OT</TableHead>
                  <TableHead className="text-right">ค่าOT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin: Record<string, unknown>, index: number) => (
                  <TableRow key={index} className="border-white/10">
                    <TableCell className="font-medium">{admin.admin_name as string}</TableCell>
                    <TableCell className="text-center">{getTypeBadge(admin.admin_type as string)}</TableCell>
                    <TableCell className="text-center">{admin.work_days as number} วัน</TableCell>
                    <TableCell className="text-center">{(admin.regular_hours as number)?.toFixed(1)} ชม.</TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                        {(admin.ot_hours as number)?.toFixed(1)} ชม.
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-400">
                      ฿{formatNumber(admin.ot_pay as number)}
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
