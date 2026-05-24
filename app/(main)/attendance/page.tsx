'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  LogIn, 
  LogOut, 
  Calendar,
  User,
  Loader2,
  CheckCircle,
  XCircle,
  Timer,
  AlertTriangle,
  Shield,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AttendancePage() {
  const [adminId, setAdminId] = useState<string | null>(null);
  const [adminType, setAdminType] = useState<'manual_key' | 'auto' | 'withdraw'>('manual_key');
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dateFilter, setDateFilter] = useState('');
  
  // Shift verification states
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [overrideReason, setOverrideReason] = useState('');

  // ดึง admin ID จาก localStorage on mount
  useEffect(() => {
    let userStr = localStorage.getItem('lottery_session');
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

  // ดึงข้อมูลการเข้างานวันนี้
  const today = new Date().toISOString().split('T')[0];
  const { data: todayAttendance, mutate: mutateTodayAttendance } = useSWR(
    adminId ? `/api/admin-attendance?admin_id=${adminId}&date=${today}` : null,
    fetcher
  );

  // ดึงประวัติการเข้างาน
  const { data: attendanceHistory, mutate: mutateHistory } = useSWR(
    adminId
      ? (dateFilter 
          ? `/api/admin-attendance?admin_id=${adminId}&date=${dateFilter}`
          : `/api/admin-attendance?admin_id=${adminId}`)
      : null,
    fetcher
  );

  // อัปเดตเวลาปัจจุบันทุกวินาที
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentRecord = Array.isArray(todayAttendance) && todayAttendance.length > 0 
    ? todayAttendance[0] 
    : null;
  const isOnDuty = currentRecord?.status === 'on_duty';

  const handleClockIn = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: adminId, admin_type: adminType }),
      });
      const data = await res.json();
      
      if (res.ok) {
        toast.success('เข้างานสำเร็จ');
        mutateTodayAttendance();
        mutateHistory();
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  // ตรวจสอบยอดก่อนออกกะ
  const handleRequestClockOut = async () => {
    setVerificationLoading(true);
    setShowVerificationDialog(true);
    
    try {
      const res = await fetch(`/api/shift-verification?admin_id=${adminId}&admin_type=${adminType}`);
      const data = await res.json();
      setVerificationResult(data);
    } catch {
      toast.error('เกิดข้อผิดพลาดในการตรวจสอบยอด');
      setShowVerificationDialog(false);
    } finally {
      setVerificationLoading(false);
    }
  };

  // ดำเนินการออกกะหลังตรวจสอบ
  const handleClockOut = async (forceEnd = false) => {
    if (!verificationResult?.canEndShift && !forceEnd) {
      toast.error('ไม่สามารถออกกะได้ เนื่องจากยอดไม่ตรง');
      return;
    }

    if (forceEnd && !overrideReason.trim()) {
      toast.error('กรุณาระบุเหตุผลในการ override');
      return;
    }

    setLoading(true);
    try {
      // บันทึกการตรวจสอบก่อน
      await fetch('/api/shift-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_id: adminId,
          admin_type: adminType,
          force_end: forceEnd,
          override_reason: overrideReason,
        }),
      });

      // ออกงาน
      const res = await fetch('/api/admin-attendance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: adminId }),
      });
      const data = await res.json();
      
      if (res.ok) {
        toast.success('ออกงานสำเร็จ');
        setShowVerificationDialog(false);
        setVerificationResult(null);
        setOverrideReason('');
        mutateTodayAttendance();
        mutateHistory();
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('th-TH', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('th-TH', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('th-TH');
  };

  const calculateDuration = (clockIn: string, clockOut: string | null) => {
    if (!clockIn) return '-';
    const start = new Date(clockIn);
    const end = clockOut ? new Date(clockOut) : new Date();
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours} ชม. ${minutes} นาที`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ระบบเข้า/ออกงาน</h1>
          <p className="text-muted-foreground">บันทึกเวลาเข้า-ออกงานของแอดมิน</p>
        </div>
      </div>

      {/* Current Time Card */}
      <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm">{formatDate(currentTime)}</p>
              <p className="text-5xl font-bold tracking-wider mt-2">{formatTime(currentTime)}</p>
            </div>
            <div className="text-right">
              <Badge variant={isOnDuty ? 'default' : 'secondary'} className={`text-lg px-4 py-2 ${isOnDuty ? 'bg-green-500' : 'bg-gray-500'}`}>
                {isOnDuty ? 'กำลังปฏิบัติงาน' : 'ไม่ได้เข้างาน'}
              </Badge>
              {isOnDuty && currentRecord?.clock_in_at && (
                <p className="text-white/80 text-sm mt-2">
                  <Timer className="inline size-4 mr-1" />
                  ทำงานมาแล้ว: {calculateDuration(currentRecord.clock_in_at, null)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* เลือกประเภทแอดมิน */}
      <Card className="bg-white border-2 border-amber-400 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <User className="size-5 text-amber-500" />
              <span className="font-medium text-neutral-900">ประเภทแอดมิน:</span>
            </div>
            <Select value={adminType} onValueChange={(v: 'manual_key' | 'auto' | 'withdraw') => setAdminType(v)}>
              <SelectTrigger className="w-[200px] bg-white border-amber-400 text-neutral-900">
                <SelectValue placeholder="เลือกประเภท" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual_key">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-amber-500" />
                    แอดมินคีย์หวย
                  </div>
                </SelectItem>
                <SelectItem value="auto">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-green-500" />
                    แอดมินออโต้
                  </div>
                </SelectItem>
                <SelectItem value="withdraw">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-blue-500" />
                    แอดมินถอนเงิน
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Badge className={
              adminType === 'manual_key' 
                ? 'bg-amber-100 text-amber-700 border border-amber-400' 
                : adminType === 'auto'
                  ? 'bg-green-100 text-green-700 border border-green-400'
                  : 'bg-blue-100 text-blue-700 border border-blue-400'
            }>
              {adminType === 'manual_key' ? 'รับลูกค้าคีย์หวย' : adminType === 'auto' ? 'ดูแลระบบออโต้' : 'จ่ายรางวัล/ถอนเงิน'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Clock In/Out Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="size-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <LogIn className="size-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">เข้างาน</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {currentRecord?.clock_in_at 
                  ? `เข้างานแล้วเวลา ${formatDateTime(currentRecord.clock_in_at)}`
                  : 'กดปุ่มเพื่อบันทึกเวลาเข้างาน'
                }
              </p>
              <Button
                onClick={handleClockIn}
                disabled={loading || isOnDuty}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                {loading ? (
                  <Loader2 className="size-5 animate-spin mr-2" />
                ) : (
                  <LogIn className="size-5 mr-2" />
                )}
                เข้างาน
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="size-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <LogOut className="size-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">ออกงาน</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {currentRecord?.clock_out_at 
                  ? `ออกงานแล้วเวลา ${formatDateTime(currentRecord.clock_out_at)}`
                  : isOnDuty 
                    ? 'กดปุ่มเพื่อบันทึกเวลาออกงาน'
                    : 'กรุณาเข้างานก่อน'
                }
              </p>
              <Button
                onClick={handleRequestClockOut}
                disabled={loading || !isOnDuty}
                className="w-full bg-red-600 hover:bg-red-700"
                size="lg"
              >
                {loading ? (
                  <Loader2 className="size-5 animate-spin mr-2" />
                ) : (
                  <LogOut className="size-5 mr-2" />
                )}
                ออกงาน (ตรวจสอบยอด)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="size-5" />
              ประวัติการเข้างาน
            </CardTitle>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-auto"
              placeholder="กรองตามวันที่"
            />
          </div>
        </CardHeader>
        <CardContent>
          {!attendanceHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : Array.isArray(attendanceHistory) && attendanceHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="size-12 mx-auto mb-2 opacity-50" />
              <p>ไม่มีประวัติการเข้างาน</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">วันที่</th>
                    <th className="text-left p-3">เข้างาน</th>
                    <th className="text-left p-3">ออกงาน</th>
                    <th className="text-left p-3">ระยะเวลา</th>
                    <th className="text-left p-3">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(attendanceHistory) && attendanceHistory.map((record: {
                    id: string;
                    shift_date: string;
                    clock_in_at: string;
                    clock_out_at: string | null;
                    status: string;
                  }) => (
                    <tr key={record.id} className="border-b hover:bg-muted/50">
                      <td className="p-3">
                        {new Date(record.shift_date).toLocaleDateString('th-TH', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="p-3">
                        {record.clock_in_at ? (
                          <span className="text-green-600">
                            {new Date(record.clock_in_at).toLocaleTimeString('th-TH', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-3">
                        {record.clock_out_at ? (
                          <span className="text-red-600">
                            {new Date(record.clock_out_at).toLocaleTimeString('th-TH', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-3">
                        {calculateDuration(record.clock_in_at, record.clock_out_at)}
                      </td>
                      <td className="p-3">
                        {record.status === 'on_duty' ? (
                          <Badge className="bg-green-500">
                            <CheckCircle className="size-3 mr-1" />
                            กำลังทำงาน
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="size-3 mr-1" />
                            ออกงานแล้ว
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shift Verification Dialog */}
      <Dialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Shield className="size-6 text-amber-500" />
              ตรวจสอบยอดก่อนออกกะ
            </DialogTitle>
            <DialogDescription>
              ระบบจะตรวจสอบความถูกต้องของยอดแทง เครดิต และรายการรอผล ก่อนอนุญาตให้ออกกะ
            </DialogDescription>
          </DialogHeader>

          {verificationLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="size-12 animate-spin text-amber-500 mb-4" />
              <p className="text-lg font-medium">กำลังตรวจสอบยอด...</p>
              <p className="text-muted-foreground">กรุณารอสักครู่</p>
            </div>
          ) : verificationResult ? (
            <div className="space-y-6">
              {/* Status Banner */}
              <Alert variant={verificationResult.canEndShift ? 'default' : 'destructive'}>
                <div className="flex items-center gap-3">
                  {verificationResult.canEndShift ? (
                    <CheckCircle className="size-6 text-green-500" />
                  ) : (
                    <AlertTriangle className="size-6" />
                  )}
                  <div>
                    <AlertTitle className="text-lg">
                      {verificationResult.canEndShift ? 'ผ่านการตรวจสอบ - สามารถออกกะได้' : 'ไม่ผ่านการตรวจสอบ - ห้ามออกกะ'}
                    </AlertTitle>
                    <AlertDescription>
                      {verificationResult.canEndShift 
                        ? 'ยอดเครดิตและรายการทั้งหมดถูกต้อง'
                        : `พบปัญหา ${verificationResult.issues?.length || 0} รายการที่ต้องแก้ไข`
                      }
                    </AlertDescription>
                  </div>
                </div>
              </Alert>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="bg-blue-500/10 border-blue-500/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Users className="size-5 text-blue-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">ลูกค้า</p>
                        <p className="text-xl font-bold">{verificationResult.summary?.totalCustomers || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-amber-500/10 border-amber-500/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="size-5 text-amber-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">ยอดแทง</p>
                        <p className="text-xl font-bold">{(verificationResult.summary?.totalBets || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-green-500/10 border-green-500/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="size-5 text-green-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">ยอดถูก</p>
                        <p className="text-xl font-bold text-green-500">{(verificationResult.summary?.totalWins || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-orange-500/10 border-orange-500/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Clock className="size-5 text-orange-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">รอผล</p>
                        <p className="text-xl font-bold text-orange-500">{(verificationResult.summary?.pendingBets || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Credit Comparison */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="size-5" />
                    เปรียบเทียบเครดิต
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground mb-1">เครดิตที่ควรจะมี</p>
                      <p className="text-2xl font-bold">{(verificationResult.summary?.expectedCredit || 0).toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground mb-1">เครดิตจริง</p>
                      <p className="text-2xl font-bold">{(verificationResult.summary?.actualCredit || 0).toLocaleString()}</p>
                    </div>
                    <div className={`p-4 rounded-lg ${Math.abs(verificationResult.summary?.difference || 0) < 10 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      <p className="text-sm text-muted-foreground mb-1">ส่วนต่าง</p>
                      <p className={`text-2xl font-bold ${Math.abs(verificationResult.summary?.difference || 0) < 10 ? 'text-green-500' : 'text-red-500'}`}>
                        {verificationResult.summary?.difference >= 0 ? '+' : ''}{(verificationResult.summary?.difference || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Issues */}
              {verificationResult.issues && verificationResult.issues.length > 0 && (
                <Card className="border-red-500/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-red-500">
                      <AlertCircle className="size-5" />
                      ปัญหาที่พบ ({verificationResult.issues.length} รายการ)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {verificationResult.issues.map((issue: any, idx: number) => (
                        <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg ${issue.severity === 'error' ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                          {issue.severity === 'error' ? (
                            <XCircle className="size-5 text-red-500 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className={`font-medium ${issue.severity === 'error' ? 'text-red-500' : 'text-amber-500'}`}>
                              {issue.message}
                            </p>
                            {issue.details && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {typeof issue.details === 'object' ? JSON.stringify(issue.details) : issue.details}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Customer Details */}
              {verificationResult.customerDetails && verificationResult.customerDetails.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="size-5" />
                      รายละเอียดลูกค้า
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">ลูกค้า</th>
                            <th className="text-right p-2">ยอดแทง</th>
                            <th className="text-right p-2">ยอดถูก</th>
                            <th className="text-right p-2">รอผล</th>
                            <th className="text-right p-2">เครดิต</th>
                            <th className="text-center p-2">สถานะ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {verificationResult.customerDetails.slice(0, 10).map((cust: any) => (
                            <tr key={cust.customerId} className="border-b hover:bg-muted/50">
                              <td className="p-2 font-medium">{cust.customerName}</td>
                              <td className="p-2 text-right">{cust.totalBets.toLocaleString()}</td>
                              <td className="p-2 text-right text-green-500">{cust.totalWins.toLocaleString()}</td>
                              <td className="p-2 text-right text-orange-500">{cust.pendingBets.toLocaleString()}</td>
                              <td className="p-2 text-right">{cust.creditBalance.toLocaleString()}</td>
                              <td className="p-2 text-center">
                                <Badge variant={cust.status === 'matched' ? 'default' : cust.status === 'pending' ? 'secondary' : 'destructive'}>
                                  {cust.status === 'matched' ? 'ตรง' : cust.status === 'pending' ? 'รอผล' : 'ไม่ตรง'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Override Section (only if verification failed) */}
              {!verificationResult.canEndShift && (
                <Card className="border-amber-500/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-amber-500">
                      <AlertTriangle className="size-5" />
                      Override (สำหรับกรณีพิเศษเท่านั้น)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        หากต้องการออกกะแม้ยอดไม่ตรง ต้องระบุเหตุผลและจะถูกบันทึกไว้ในระบบ
                      </p>
                      <div>
                        <Label>เหตุผลในการ Override *</Label>
                        <Textarea
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          placeholder="ระบุเหตุผลที่ต้อง override..."
                          className="mt-1"
                          rows={3}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowVerificationDialog(false)}>
              ยกเลิก
            </Button>
            {verificationResult?.canEndShift ? (
              <Button onClick={() => handleClockOut(false)} disabled={loading} className="bg-green-600 hover:bg-green-700">
                {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <CheckCircle className="size-4 mr-2" />}
                ยืนยันออกกะ
              </Button>
            ) : verificationResult && (
              <Button 
                onClick={() => handleClockOut(true)} 
                disabled={loading || !overrideReason.trim()}
                variant="destructive"
              >
                {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <AlertTriangle className="size-4 mr-2" />}
                Override และออกกะ
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
