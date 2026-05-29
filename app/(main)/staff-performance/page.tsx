'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Users, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Award,
  RefreshCw,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle2,
  Timer,
} from 'lucide-react';

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

interface AdminPerformance {
  admin_id: string;
  admin_name: string;
  admin_type: string;
  admin_role: string;
  shift_status: 'on_duty' | 'off_duty' | 'no_shift';
  current_shift_start: string | null;
  total_work_days: number;
  total_work_hours: number;
  on_time_rate: number;
  late_count: number;
  total_slips: number;
  total_volume: number;
  commission_rate: number;
  commission_tier: string;
  daily_payout: number;
  performance_score: number;
  rank: number;
}

interface PerformanceData {
  admins: AdminPerformance[];
  summary: {
    totalAdmins: number;
    avgPerformance: number;
    topPerformer: string | null;
    needsImprovement: number;
    totalSlips: number;
    totalVolume: number;
    onDutyCount: number;
  };
  commissionTiers: {
    tier: string;
    minSlips: number;
    maxSlips: number | null;
    rate: number;
  }[];
}

export default function StaffPerformancePage() {
  const [viewType, setViewType] = useState<'daily' | 'monthly'>('daily');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const { data, error, isLoading, mutate } = useSWR<PerformanceData>(
    `/api/admin-performance?month=${selectedMonth}&view=${viewType}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const getShiftStatusBadge = (status: string) => {
    switch (status) {
      case 'on_duty':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40">กำลังทำงาน</Badge>;
      case 'off_duty':
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/40">ออกงานแล้ว</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/40">ไม่มีกะ</Badge>;
    }
  };

  const getCommissionTierBadge = (tier: string) => {
    switch (tier) {
      case 'Gold':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40">Gold 25%</Badge>;
      case 'Silver':
        return <Badge className="bg-slate-400/20 text-slate-300 border-slate-400/40">Silver 20%</Badge>;
      default:
        return <Badge className="bg-orange-700/20 text-orange-400 border-orange-700/40">Bronze 15%</Badge>;
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-amber-500 text-black">1st</Badge>;
    if (rank === 2) return <Badge className="bg-slate-400 text-black">2nd</Badge>;
    if (rank === 3) return <Badge className="bg-orange-600 text-white">3rd</Badge>;
    return <Badge variant="outline">{rank}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="size-6 text-amber-400" />
            Staff Performance Overview
          </h1>
          <p className="text-slate-400 mt-1">
            ติดตามผลงานพนักงาน, จำนวนโพยที่คีย์, และค่าคอมมิชชั่นอัตโนมัติ
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={viewType} onValueChange={(v) => setViewType(v as 'daily' | 'monthly')}>
            <SelectTrigger className="w-[140px] bg-slate-800 border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">รายวัน</SelectItem>
              <SelectItem value="monthly">รายเดือน</SelectItem>
            </SelectContent>
          </Select>
          {viewType === 'monthly' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white"
            />
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => mutate()}
            disabled={isLoading}
            className="border-slate-700"
          >
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Commission Tier Info */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-amber-400 flex items-center gap-2">
            <Award className="size-5" />
            ระบบค่าคอมมิชชั่นอัตโนมัติ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-orange-700/10 rounded-lg border border-orange-700/30">
              <div className="size-10 rounded-full bg-orange-700/20 flex items-center justify-center">
                <span className="text-orange-400 font-bold">15%</span>
              </div>
              <div>
                <div className="font-medium text-orange-400">Bronze Tier</div>
                <div className="text-sm text-slate-400">0-49 โพย</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-400/10 rounded-lg border border-slate-400/30">
              <div className="size-10 rounded-full bg-slate-400/20 flex items-center justify-center">
                <span className="text-slate-300 font-bold">20%</span>
              </div>
              <div>
                <div className="font-medium text-slate-300">Silver Tier</div>
                <div className="text-sm text-slate-400">50-99 โพย</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
              <div className="size-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <span className="text-amber-400 font-bold">25%</span>
              </div>
              <div>
                <div className="font-medium text-amber-400">Gold Tier</div>
                <div className="text-sm text-slate-400">100+ โพย</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">พนักงานทั้งหมด</p>
                <p className="text-2xl font-bold text-white">{data?.summary.totalAdmins || 0}</p>
              </div>
              <Users className="size-8 text-blue-400" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" />
              <span className="text-sm text-emerald-400">{data?.summary.onDutyCount || 0} กำลังทำงาน</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">โพยทั้งหมด</p>
                <p className="text-2xl font-bold text-white">{(data?.summary.totalSlips || 0).toLocaleString()}</p>
              </div>
              <FileText className="size-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">ยอดรวม</p>
                <p className="text-2xl font-bold text-amber-400">
                  {(data?.summary.totalVolume || 0).toLocaleString()} ฿
                </p>
              </div>
              <DollarSign className="size-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Top Performer</p>
                <p className="text-lg font-bold text-emerald-400 truncate">
                  {data?.summary.topPerformer || '-'}
                </p>
              </div>
              <Award className="size-8 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">รายละเอียดผลงานพนักงาน</CardTitle>
          <CardDescription>
            {viewType === 'daily' ? 'ข้อมูลวันนี้' : `ข้อมูลเดือน ${selectedMonth}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="size-8 animate-spin text-amber-400" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-red-400">
              <AlertCircle className="size-12 mb-2" />
              <p>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
              <Button variant="outline" className="mt-4" onClick={() => mutate()}>
                ลองใหม่
              </Button>
            </div>
          ) : !data?.admins.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Users className="size-12 mb-2" />
              <p>ไม่พบข้อมูลพนักงาน</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">อันดับ</TableHead>
                    <TableHead className="text-slate-400">ชื่อพนักงาน</TableHead>
                    <TableHead className="text-slate-400">สถานะกะ</TableHead>
                    <TableHead className="text-slate-400 text-right">โพยที่คีย์</TableHead>
                    <TableHead className="text-slate-400 text-right">ยอดรวม</TableHead>
                    <TableHead className="text-slate-400 text-center">ค่าคอมฯ</TableHead>
                    <TableHead className="text-slate-400 text-right">รายได้วันนี้</TableHead>
                    <TableHead className="text-slate-400 text-right">คะแนน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.admins.map((admin) => (
                    <TableRow key={admin.admin_id} className="border-slate-700 hover:bg-slate-700/30">
                      <TableCell>{getRankBadge(admin.rank)}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-white">{admin.admin_name}</div>
                          <div className="text-xs text-slate-400">{admin.admin_role}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {getShiftStatusBadge(admin.shift_status)}
                          {admin.current_shift_start && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Timer className="size-3" />
                              {new Date(admin.current_shift_start).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-medium ${admin.total_slips >= 100 ? 'text-emerald-400' : admin.total_slips >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                          {admin.total_slips.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-white">
                        {admin.total_volume.toLocaleString()} ฿
                      </TableCell>
                      <TableCell className="text-center">
                        {getCommissionTierBadge(admin.commission_tier)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-amber-400">
                        {admin.daily_payout.toLocaleString()} ฿
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                admin.performance_score >= 80 ? 'bg-emerald-500' :
                                admin.performance_score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(admin.performance_score, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-slate-300 w-10 text-right">
                            {admin.performance_score.toFixed(0)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Low Performers Alert */}
      {data && data.summary.needsImprovement > 0 && (
        <Card className="bg-red-900/20 border-red-800/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="size-6 text-red-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-medium text-red-400">พนักงานที่ต้องปรับปรุง</h3>
                <p className="text-sm text-slate-400 mt-1">
                  มี {data.summary.needsImprovement} คนที่มีคะแนนต่ำกว่า 60 และได้รับค่าคอมมิชชั่น Bronze Tier (15%)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
