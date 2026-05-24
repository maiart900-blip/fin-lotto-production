'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Clock,
  Users,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  Calendar,
  RefreshCw,
  FileDown,
  Shield,
  TrendingUp,
  Timer,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AttendanceRecord {
  id: string;
  admin_id: string;
  admin_name?: string;
  admin_type: 'manual_key' | 'auto' | 'all';
  shift_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  total_hours: number;
  status: 'on_duty' | 'completed' | 'incomplete';
  verification_passed?: boolean;
  force_ended?: boolean;
  override_reason?: string;
}

interface AttendanceSummary {
  totalAdmins: number;
  onDutyNow: number;
  completedToday: number;
  incompleteToday: number;
  averageHours: number;
  forceEndedCount: number;
}

export default function AdminAttendanceReportPage() {
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, error, isLoading, mutate } = useSWR<{
    records: AttendanceRecord[];
    summary: AttendanceSummary;
  }>(`/api/admin-attendance-report?date=${dateFilter}&type=${typeFilter}&status=${statusFilter}&search=${searchQuery}`, fetcher);

  const records = data?.records || [];
  const summary = data?.summary || {
    totalAdmins: 0,
    onDutyNow: 0,
    completedToday: 0,
    incompleteToday: 0,
    averageHours: 0,
    forceEndedCount: 0,
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'HH:mm', { locale: th });
  };

  const formatHours = (hours: number | null | undefined) => {
    if (hours === null || hours === undefined || isNaN(hours)) return '-';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h} ชม. ${m} นาที`;
  };

  const getStatusBadge = (status: string, verificationPassed?: boolean, forceEnded?: boolean) => {
    if (status === 'on_duty') {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">กำลังทำงาน</Badge>;
    }
    if (status === 'completed') {
      if (forceEnded) {
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Override</Badge>;
      }
      if (verificationPassed) {
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">เสร็จสิ้น (ผ่าน)</Badge>;
      }
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">เสร็จสิ้น</Badge>;
    }
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">ไม่สมบูรณ์</Badge>;
  };

  const getTypeBadge = (type: string) => {
    if (type === 'manual_key') {
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">คีย์หวย</Badge>;
    }
    if (type === 'auto') {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">ออโต้</Badge>;
    }
    return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">ทั่วไป</Badge>;
  };

  const handleExport = () => {
    // Export to CSV
    const csvContent = [
      ['วันที่', 'แอดมิน', 'ประเภท', 'เข้างาน', 'ออกงาน', 'ชั่วโมง', 'สถานะ', 'ยอดตรวจสอบ', 'หมายเหตุ'].join(','),
      ...records.map(r => [
        r.shift_date,
        r.admin_name || r.admin_id,
        r.admin_type,
        formatTime(r.clock_in_at),
        formatTime(r.clock_out_at),
        r.total_hours.toFixed(2),
        r.status,
        r.verification_passed ? 'ผ่าน' : r.force_ended ? 'Override' : '-',
        r.override_reason || '-',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `attendance-report-${dateFilter}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="size-7 text-amber-500" />
            <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
              รายงานเข้างานแอดมิน
            </span>
          </h1>
          <p className="text-muted-foreground mt-1">
            ตรวจสอบการเข้า-ออกงานของแอดมินทุกคนในระบบ
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => mutate()}>
            <RefreshCw className="size-4 mr-2" />
            รีเฟรช
          </Button>
          <Button onClick={handleExport} className="bg-amber-500 hover:bg-amber-600 text-black">
            <FileDown className="size-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/30">
                <Users className="size-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-200/90">แอดมินทั้งหมด</p>
                <p className="text-xl font-bold text-white">{summary.totalAdmins}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/30">
                <CheckCircle className="size-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-200/90">กำลังทำงาน</p>
                <p className="text-xl font-bold text-green-400">{summary.onDutyNow}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/30">
                <Clock className="size-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-200/90">เสร็จสิ้นวันนี้</p>
                <p className="text-xl font-bold text-white">{summary.completedToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/30">
                <XCircle className="size-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-200/90">ไม่สมบูรณ์</p>
                <p className="text-xl font-bold text-red-400">{summary.incompleteToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/30">
                <Timer className="size-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-200/90">เฉลี่ยชั่วโมง</p>
                <p className="text-xl font-bold text-white">{summary.averageHours.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/30">
                <AlertTriangle className="size-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-200/90">Override</p>
                <p className="text-xl font-bold text-amber-400">{summary.forceEndedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="size-5" />
            ค้นหาและกรอง
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">วันที่</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">ประเภทแอดมิน</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกประเภท" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="manual_key">คีย์หวย</SelectItem>
                  <SelectItem value="auto">ออโต้</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">สถานะ</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกสถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="on_duty">กำลังทำงาน</SelectItem>
                  <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                  <SelectItem value="incomplete">ไม่สมบูรณ์</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">ค้นหาชื่อแอดมิน</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหา..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="size-5" />
            รายการเข้างาน - {format(new Date(dateFilter), 'd MMMM yyyy', { locale: th })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-400">
              เกิดข้อผิดพลาดในการโหลดข้อมูล
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              ไม่พบข้อมูลการเข้างานในวันที่เลือก
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>แอดมิน</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead className="text-center">เข้างาน</TableHead>
                    <TableHead className="text-center">ออกงาน</TableHead>
                    <TableHead className="text-center">ชั่วโมง</TableHead>
                    <TableHead className="text-center">สถานะ</TableHead>
                    <TableHead className="text-center">ยอดตรวจสอบ</TableHead>
                    <TableHead>หมายเหตุ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.admin_name || `Admin ${record.admin_id.slice(0, 8)}`}
                      </TableCell>
                      <TableCell>{getTypeBadge(record.admin_type)}</TableCell>
                      <TableCell className="text-center text-green-400">
                        {formatTime(record.clock_in_at)}
                      </TableCell>
                      <TableCell className="text-center text-red-400">
                        {formatTime(record.clock_out_at)}
                      </TableCell>
                      <TableCell className="text-center">
                        {formatHours(record.total_hours)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(record.status, record.verification_passed, record.force_ended)}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.verification_passed ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">ผ่าน</Badge>
                        ) : record.force_ended ? (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Override</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {record.override_reason || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
