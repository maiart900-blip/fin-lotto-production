'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  LogIn,
  LogOut,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Timer,
  Banknote,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const ADMIN_TYPE = 'manual_key';

function formatTime(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatCurrency(num: number): string {
  return new Intl.NumberFormat('th-TH').format(num);
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'on_duty':
      return <Badge className="bg-green-500">กำลังทำงาน</Badge>;
    case 'off_duty':
      return <Badge variant="secondary">ออกงานแล้ว</Badge>;
    case 'absent':
      return <Badge variant="destructive">ขาดงาน</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function WorkHoursPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [isClockingOut, setIsClockingOut] = useState(false);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  // Get admin ID from localStorage on mount
  useEffect(() => {
    // Try lottery_session first (from use-auth hook)
    let userStr = localStorage.getItem('lottery_session');
    // Fallback to 'user' key (from verify-2fa)
    if (!userStr) {
      userStr = localStorage.getItem('user');
    }
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setAdminId(user.id);
      } catch {
        // Invalid user data
      }
    }
  }, []);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Get today's date in Thai timezone
  const today = new Date().toISOString().split('T')[0];

  // Fetch today's attendance
  const { data: todayAttendance, mutate: mutateTodayAttendance } = useSWR(
    adminId ? `/api/admin-attendance?admin_id=${adminId}&date=${today}` : null,
    fetcher
  );

  // Fetch attendance history
  const { data: attendanceHistory, isLoading: historyLoading, mutate: mutateHistory } = useSWR(
    adminId ? `/api/admin-attendance?admin_id=${adminId}&start_date=${dateRange.start}&end_date=${dateRange.end}` : null,
    fetcher
  );

  const todayRecord = Array.isArray(todayAttendance) ? todayAttendance[0] : null;
  const isOnDuty = todayRecord?.status === 'on_duty';

  // Calculate summary stats
  const summaryStats = {
    totalDays: Array.isArray(attendanceHistory) ? attendanceHistory.length : 0,
    totalHours: Array.isArray(attendanceHistory)
      ? attendanceHistory.reduce((sum: number, r: any) => sum + (r.worked_hours || 0), 0)
      : 0,
    totalOT: Array.isArray(attendanceHistory)
      ? attendanceHistory.reduce((sum: number, r: any) => sum + (r.ot_hours || 0), 0)
      : 0,
    totalOTPay: Array.isArray(attendanceHistory)
      ? attendanceHistory.reduce((sum: number, r: any) => sum + (r.ot_pay || 0), 0)
      : 0,
    totalLatePenalty: Array.isArray(attendanceHistory)
      ? attendanceHistory.reduce((sum: number, r: any) => sum + (r.late_penalty || 0), 0)
      : 0,
    lateCount: Array.isArray(attendanceHistory)
      ? attendanceHistory.filter((r: any) => r.late_minutes > 0).length
      : 0,
  };

  const handleClockIn = async () => {
    if (!adminId) {
      toast.error('กรุณาเข้าสู่ระบบก่อน');
      return;
    }
    setIsClockingIn(true);
    try {
      const res = await fetch('/api/admin-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_id: adminId,
          admin_type: ADMIN_TYPE,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'ไม่สามารถเข้างานได้');
        return;
      }

      toast.success('เข้างานสำเร็จ');
      mutateTodayAttendance();
      mutateHistory();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    if (!adminId) {
      toast.error('กรุณาเข้าสู่ระบบก่อน');
      return;
    }
    setIsClockingOut(true);
    try {
      const res = await fetch('/api/admin-attendance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_id: adminId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'ไม่สามารถออกงานได้');
        return;
      }

      toast.success('ออกงานสำเร็จ');
      mutateTodayAttendance();
      mutateHistory();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsClockingOut(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ลงเวลางาน</h1>
          <p className="text-muted-foreground">บันทึกเวลาเข้า-ออกงานประจำวัน</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-mono font-bold">
            {currentTime.toLocaleTimeString('th-TH')}
          </p>
          <p className="text-sm text-muted-foreground">
            {currentTime.toLocaleDateString('th-TH', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Clock In/Out Card */}
      <Card className={isOnDuty ? 'border-green-200 bg-green-50' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            สถานะวันนี้
          </CardTitle>
          <CardDescription>
            {isOnDuty ? 'คุณกำลังอยู่ในเวลางาน' : 'คุณยังไม่ได้เข้างานวันนี้'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Today's Record */}
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
              <div className="text-center p-4 bg-background rounded-lg">
                <p className="text-sm text-muted-foreground">เวลาเข้างาน</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatTime(todayRecord?.clock_in_at)}
                </p>
              </div>
              <div className="text-center p-4 bg-background rounded-lg">
                <p className="text-sm text-muted-foreground">เวลาออกงาน</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatTime(todayRecord?.clock_out_at)}
                </p>
              </div>
              <div className="text-center p-4 bg-background rounded-lg">
                <p className="text-sm text-muted-foreground">ชั่วโมงทำงาน</p>
                <p className="text-2xl font-bold">
                  {todayRecord?.worked_hours || 0}:{String(todayRecord?.worked_minutes || 0).padStart(2, '0')}
                </p>
              </div>
              <div className="text-center p-4 bg-background rounded-lg">
                <p className="text-sm text-muted-foreground">สาย/OT</p>
                <p className="text-lg font-bold">
                  {todayRecord?.late_minutes > 0 && (
                    <span className="text-red-600">สาย {todayRecord.late_minutes} นาที</span>
                  )}
                  {todayRecord?.ot_hours > 0 && (
                    <span className="text-green-600">OT {todayRecord.ot_hours.toFixed(1)} ชม.</span>
                  )}
                  {!todayRecord?.late_minutes && !todayRecord?.ot_hours && '-'}
                </p>
              </div>
            </div>

            {/* Clock In/Out Buttons */}
            <div className="flex flex-col gap-2">
              {!isOnDuty ? (
                <Button
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 min-w-[140px]"
                  onClick={handleClockIn}
                  disabled={isClockingIn}
                >
                  {isClockingIn ? (
                    <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <LogIn className="h-5 w-5 mr-2" />
                  )}
                  เข้างาน
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="destructive"
                  className="min-w-[140px]"
                  onClick={handleClockOut}
                  disabled={isClockingOut}
                >
                  {isClockingOut ? (
                    <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <LogOut className="h-5 w-5 mr-2" />
                  )}
                  ออกงาน
                </Button>
              )}
            </div>
          </div>

          {/* Late/OT Info */}
          {todayRecord && (todayRecord.late_penalty > 0 || todayRecord.ot_pay > 0) && (
            <div className="mt-4 flex gap-4 text-sm">
              {todayRecord.late_penalty > 0 && (
                <div className="flex items-center gap-2 text-red-600">
                  <TrendingDown className="h-4 w-4" />
                  หักสาย: -{formatCurrency(todayRecord.late_penalty)} บาท
                </div>
              )}
              {todayRecord.ot_pay > 0 && (
                <div className="flex items-center gap-2 text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  ค่า OT: +{formatCurrency(todayRecord.ot_pay)} บาท
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="h-6 w-6 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold">{summaryStats.totalDays}</p>
            <p className="text-xs text-muted-foreground">วันทำงาน</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-6 w-6 mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold">{summaryStats.totalHours}</p>
            <p className="text-xs text-muted-foreground">ชั่วโมงรวม</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Timer className="h-6 w-6 mx-auto mb-2 text-purple-500" />
            <p className="text-2xl font-bold">{summaryStats.totalOT.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">ชั่วโมง OT</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold text-green-600">+{formatCurrency(summaryStats.totalOTPay)}</p>
            <p className="text-xs text-muted-foreground">ค่า OT (บาท)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 text-orange-500" />
            <p className="text-2xl font-bold">{summaryStats.lateCount}</p>
            <p className="text-xs text-muted-foreground">วันมาสาย</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingDown className="h-6 w-6 mx-auto mb-2 text-red-500" />
            <p className="text-2xl font-bold text-red-600">-{formatCurrency(summaryStats.totalLatePenalty)}</p>
            <p className="text-xs text-muted-foreground">หักสาย (บาท)</p>
          </CardContent>
        </Card>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ประวัติการเข้างาน</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="start">จาก</Label>
              <Input
                id="start"
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-auto"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="end">ถึง</Label>
              <Input
                id="end"
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-auto"
              />
            </div>
            <Button variant="outline" onClick={() => mutateHistory()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              โหลดใหม่
            </Button>
          </div>

          {/* History Table */}
          {historyLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>เข้างาน</TableHead>
                    <TableHead>ออกงาน</TableHead>
                    <TableHead>ชั่วโมง</TableHead>
                    <TableHead>สาย</TableHead>
                    <TableHead>OT</TableHead>
                    <TableHead>หัก/เพิ่ม</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(attendanceHistory) && attendanceHistory.length > 0 ? (
                    attendanceHistory.map((record: any) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {formatDate(record.shift_date)}
                        </TableCell>
                        <TableCell className="text-green-600">
                          {formatTime(record.clock_in_at)}
                        </TableCell>
                        <TableCell className="text-red-600">
                          {formatTime(record.clock_out_at)}
                        </TableCell>
                        <TableCell>
                          {record.worked_hours || 0}:{String(record.worked_minutes || 0).padStart(2, '0')}
                        </TableCell>
                        <TableCell>
                          {record.late_minutes > 0 ? (
                            <span className="text-red-600">{record.late_minutes} นาที</span>
                          ) : (
                            <span className="text-green-600">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {record.ot_hours > 0 ? (
                            <span className="text-purple-600">{record.ot_hours.toFixed(1)} ชม.</span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {record.late_penalty > 0 && (
                            <span className="text-red-600">-{formatCurrency(record.late_penalty)}</span>
                          )}
                          {record.ot_pay > 0 && (
                            <span className="text-green-600">+{formatCurrency(record.ot_pay)}</span>
                          )}
                          {!record.late_penalty && !record.ot_pay && '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        ไม่พบข้อมูลการเข้างานในช่วงเวลาที่เลือก
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
