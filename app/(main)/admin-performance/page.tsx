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
import { Progress } from '@/components/ui/progress';
import {
  ClipboardCheck,
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Award,
  AlertTriangle,
  Search,
  RefreshCw,
  Download,
  Star,
  CheckCircle,
  XCircle,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AdminPerformance {
  admin_id: string;
  admin_name: string;
  admin_type: 'manual_key' | 'auto';
  total_work_days: number;
  total_work_hours: number;
  on_time_rate: number;
  late_count: number;
  total_customers_served: number;
  total_entries: number;
  total_amount: number;
  error_count: number;
  accuracy_rate: number;
  avg_response_time: number;
  performance_score: number;
  rank: number;
}

export default function AdminPerformancePage() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading, mutate } = useSWR(
    `/api/admin-performance?month=${selectedMonth}&type=${filterType}`,
    fetcher
  );

  const admins: AdminPerformance[] = data?.admins || [];
  const summary = data?.summary || {
    totalAdmins: 0,
    avgPerformance: 0,
    topPerformer: null,
    needsImprovement: 0,
  };

  const filteredAdmins = admins.filter((admin) =>
    admin.admin_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPerformanceBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-500">ยอดเยี่ยม</Badge>;
    if (score >= 75) return <Badge className="bg-blue-500">ดี</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-500">ปานกลาง</Badge>;
    return <Badge className="bg-red-500">ต้องปรับปรุง</Badge>;
  };

  const getTypeBadge = (type: string) => {
    if (type === 'manual_key') {
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">คีย์หวย</Badge>;
    }
    return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">ออโต้</Badge>;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('th-TH').format(num);
  };

  const exportCSV = () => {
    const headers = ['ลำดับ', 'แอดมิน', 'ประเภท', 'วันทำงาน', 'ชม.ทำงาน', 'ตรงเวลา%', 'สาย', 'ลูกค้า', 'รายการ', 'ยอด', 'ผิดพลาด', 'ความแม่นยำ%', 'คะแนน'];
    const rows = filteredAdmins.map((admin) => [
      admin.rank,
      admin.admin_name,
      admin.admin_type === 'manual_key' ? 'คีย์หวย' : 'ออโต้',
      admin.total_work_days,
      admin.total_work_hours.toFixed(1),
      admin.on_time_rate.toFixed(1),
      admin.late_count,
      admin.total_customers_served,
      admin.total_entries,
      admin.total_amount,
      admin.error_count,
      admin.accuracy_rate.toFixed(1),
      admin.performance_score.toFixed(1),
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-performance-${selectedMonth}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600">
            <ClipboardCheck className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">ตรวจสอบการทำงานแอดมิน</h1>
            <p className="text-slate-500">วิเคราะห์ประสิทธิภาพและผลงานของแอดมินแต่ละคน</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">เดือน:</span>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-40 bg-white border-slate-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">ประเภท:</span>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-32 bg-white border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="manual_key">คีย์หวย</SelectItem>
                  <SelectItem value="auto">ออโต้</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="size-4 text-slate-500" />
              <Input
                placeholder="ค้นหาชื่อแอดมิน..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white border-slate-200"
              />
            </div>
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
                <p className="text-sm text-blue-200/80">แอดมินทั้งหม��</p>
                <p className="text-2xl font-bold text-white">{summary.totalAdmins}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/30">
                <Target className="size-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-green-200/80">คะแนนเฉลี่ย</p>
                <p className="text-2xl font-bold text-white">{summary.avgPerformance?.toFixed(1) || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/30">
                <Award className="size-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-amber-200/80">Top Performer</p>
                <p className="text-lg font-bold text-white truncate">{summary.topPerformer || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/30">
                <AlertTriangle className="size-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-red-200/80">ต้องปรับปรุง</p>
                <p className="text-2xl font-bold text-white">{summary.needsImprovement || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Table */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="size-5 text-amber-500" />
            ผลงานแอดมิน - {selectedMonth}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">กำลังโหลด...</div>
          ) : filteredAdmins.length === 0 ? (
            <div className="text-center py-8 text-slate-500">ไม่พบข้อมูล</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-center">ลำดับ</TableHead>
                    <TableHead>แอดมิน</TableHead>
                    <TableHead className="text-center">ประเภท</TableHead>
                    <TableHead className="text-center">วันทำงาน</TableHead>
                    <TableHead className="text-center">ตรงเวลา</TableHead>
                    <TableHead className="text-center">ลูกค้า</TableHead>
                    <TableHead className="text-center">รายการ</TableHead>
                    <TableHead className="text-right">ยอดรวม</TableHead>
                    <TableHead className="text-center">ความแม่นยำ</TableHead>
                    <TableHead className="text-center">คะแนน</TableHead>
                    <TableHead className="text-center">สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdmins.map((admin) => (
                    <TableRow key={admin.admin_id} className="border-white/10">
                      <TableCell className="text-center">
                        {admin.rank <= 3 ? (
                          <Badge className={
                            admin.rank === 1 ? 'bg-amber-500' :
                            admin.rank === 2 ? 'bg-gray-400' :
                            'bg-amber-700'
                          }>
                            #{admin.rank}
                          </Badge>
                        ) : (
                          <span className="text-slate-500">#{admin.rank}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{admin.admin_name}</TableCell>
                      <TableCell className="text-center">{getTypeBadge(admin.admin_type)}</TableCell>
                      <TableCell className="text-center">{admin.total_work_days} วัน</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center gap-2">
                          <Progress value={admin.on_time_rate} className="w-16 h-2" />
                          <span className={admin.on_time_rate >= 90 ? 'text-green-400' : admin.on_time_rate >= 70 ? 'text-yellow-400' : 'text-red-400'}>
                            {admin.on_time_rate.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{formatNumber(admin.total_customers_served)}</TableCell>
                      <TableCell className="text-center">{formatNumber(admin.total_entries)}</TableCell>
                      <TableCell className="text-right font-medium">฿{formatNumber(admin.total_amount)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {admin.accuracy_rate >= 99 ? (
                            <CheckCircle className="size-4 text-green-500" />
                          ) : admin.accuracy_rate < 95 ? (
                            <XCircle className="size-4 text-red-500" />
                          ) : null}
                          <span className={admin.accuracy_rate >= 99 ? 'text-green-400' : admin.accuracy_rate >= 95 ? 'text-white' : 'text-red-400'}>
                            {admin.accuracy_rate.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-lg font-bold">{admin.performance_score.toFixed(0)}</span>
                      </TableCell>
                      <TableCell className="text-center">{getPerformanceBadge(admin.performance_score)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Criteria */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm">เกณฑ์การประเมิน</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="p-3 rounded-lg bg-white/5">
              <p className="text-slate-500 mb-1">ตรงเวลา (20%)</p>
              <p>เข้างานตรงเวลา ไม่สาย</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5">
              <p className="text-slate-500 mb-1">จำนวนลูกค้า (25%)</p>
              <p>รับลูกค้าได้มาก</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5">
              <p className="text-slate-500 mb-1">ยอดรายการ (25%)</p>
              <p>ยอดแทงรวมสูง</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5">
              <p className="text-slate-500 mb-1">ความแม่นยำ (30%)</p>
              <p>ไม่มีข้อผิดพลาด</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
