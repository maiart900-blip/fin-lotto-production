'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  DollarSign,
  Calculator,
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  Award,
  Settings,
  Download,
  RefreshCw,
  Wallet,
  AlertCircle,
  Trophy,
  Target,
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('th-TH').format(num || 0);
};

const MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export default function PayrollPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [calculating, setCalculating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data, error, mutate } = useSWR(
    `/api/payroll?month=${selectedMonth}&year=${selectedYear}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const payrolls = data?.payrolls || [];
  const settings = data?.settings || {};

  // คำนวณ summary
  const summary = {
    totalAdmins: payrolls.length,
    totalBaseSalary: payrolls.reduce((sum: number, p: { base_salary: number }) => sum + (p.base_salary || 0), 0),
    totalOTPay: payrolls.reduce((sum: number, p: { total_ot_pay: number }) => sum + (p.total_ot_pay || 0), 0),
    totalBonus: payrolls.reduce((sum: number, p: { total_bonus: number }) => sum + (p.total_bonus || 0), 0),
    totalDeductions: payrolls.reduce((sum: number, p: { total_deductions: number }) => sum + (p.total_deductions || 0), 0),
    totalNetSalary: payrolls.reduce((sum: number, p: { net_salary: number }) => sum + (p.net_salary || 0), 0),
  };

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth, year: selectedYear }),
      });
      const result = await res.json();
      
      if (res.ok) {
        toast.success(`คำนวณเงินเดือนสำเร็จ ${result.count} คน`);
        mutate();
      } else {
        toast.error(result.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการคำนวณ');
    } finally {
      setCalculating(false);
    }
  };

  const handleExportCSV = () => {
    if (payrolls.length === 0) {
      toast.error('ไม่มีข้อมูลให้ export');
      return;
    }

    const headers = [
      'แอดมิน', 'ประเภท', 'วันทำงาน', 'ชั่วโมงทำงาน', 'สาย(นาที)', 'หักสาย',
      'OT(ชม.)', 'ค่าOT', 'ลูกค้า', 'โบนัสลูกค้า', 'โบนัสไม่พลาด', 'โบนัสTop',
      'รวมโบนัส', 'รวมหัก', 'เงินสุทธิ', 'สถานะ'
    ];
    
    const rows = payrolls.map((p: {
      admin_name: string;
      admin_type: string;
      total_work_days: number;
      total_work_hours: number;
      total_late_minutes: number;
      total_late_penalty: number;
      total_ot_hours: number;
      total_ot_pay: number;
      total_customers_served: number;
      customer_bonus: number;
      no_error_bonus: number;
      top_performer_bonus: number;
      total_bonus: number;
      total_deductions: number;
      net_salary: number;
      status: string;
    }) => [
      p.admin_name,
      p.admin_type,
      p.total_work_days,
      p.total_work_hours,
      p.total_late_minutes,
      p.total_late_penalty,
      p.total_ot_hours,
      p.total_ot_pay,
      p.total_customers_served,
      p.customer_bonus,
      p.no_error_bonus,
      p.top_performer_bonus,
      p.total_bonus,
      p.total_deductions,
      p.net_salary,
      p.status,
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payroll_${selectedYear}_${selectedMonth}.csv`;
    link.click();
    toast.success('Export สำเร็จ');
  };

  const handleSaveSettings = async (newSettings: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/payroll', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      
      if (res.ok) {
        toast.success('บันทึกการตั้งค่าสำเร็จ');
        mutate();
        setSettingsOpen(false);
      } else {
        toast.error('เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  if (error) {
    return (
      <div className="p-6 text-center text-red-500">
        <AlertCircle className="size-12 mx-auto mb-4" />
        <p>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wallet className="size-7 text-amber-400" />
            สรุปเงินเดือน
          </h1>
          <p className="text-white/60 mt-1">
            คำนวณเงินเดือน โอที โบนัส และหักเงินสาย อัตโนมัติ
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-36 bg-white/10 border-amber-500/30 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-28 bg-white/10 border-amber-500/30 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((y) => (
                <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => mutate()} className="border-white/20">
            <RefreshCw className="size-4 mr-2" />
            รีเฟรช
          </Button>

          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-amber-500/30">
                <Settings className="size-4 mr-2" />
                ตั้งค่า
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#1a1f2e] border-amber-500/30 text-white max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-amber-400">
                  <Settings className="size-5" />
                  ตั้งค่า Payroll
                </DialogTitle>
              </DialogHeader>
              <PayrollSettingsForm settings={settings} onSave={handleSaveSettings} />
            </DialogContent>
          </Dialog>
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

        <Card className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/30">
                <DollarSign className="size-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-200/90">เงินเดือนพื้นฐาน</p>
                <p className="text-xl font-bold text-white">฿{formatNumber(summary.totalBaseSalary)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/30">
                <Clock className="size-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-200/90">ค่าล่วงเวลา (OT)</p>
                <p className="text-xl font-bold text-white">฿{formatNumber(summary.totalOTPay)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/30">
                <Award className="size-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-200/90">รวมโบนัส</p>
                <p className="text-xl font-bold text-green-400">฿{formatNumber(summary.totalBonus)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/30">
                <TrendingDown className="size-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-200/90">รวมหักเงิน</p>
                <p className="text-xl font-bold text-red-400">฿{formatNumber(summary.totalDeductions)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-emerald-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/30">
                <Wallet className="size-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-200/90">รวมจ่ายสุทธิ</p>
                <p className="text-xl font-bold text-white">฿{formatNumber(summary.totalNetSalary)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleCalculate}
          disabled={calculating}
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold"
        >
          {calculating ? (
            <RefreshCw className="size-4 mr-2 animate-spin" />
          ) : (
            <Calculator className="size-4 mr-2" />
          )}
          คำนวณเงินเดือน {MONTHS[selectedMonth - 1]} {selectedYear + 543}
        </Button>

        <Button
          variant="outline"
          onClick={handleExportCSV}
          disabled={payrolls.length === 0}
          className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
        >
          <Download className="size-4 mr-2" />
          EXPORT CSV
        </Button>
      </div>

      {/* Payroll Table */}
      <Card className="bg-white border-2 border-amber-400 shadow-lg">
        <CardHeader className="border-b border-amber-200">
          <CardTitle className="text-lg text-neutral-900 flex items-center gap-2">
            <TrendingUp className="size-5 text-amber-500" />
            รายละเอียดเงินเดือน - {MONTHS[selectedMonth - 1]} {selectedYear + 543}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-amber-200 hover:bg-amber-50">
                  <TableHead className="text-neutral-800 font-semibold">แอดมิน</TableHead>
                  <TableHead className="text-neutral-800 font-semibold">ประเภท</TableHead>
                  <TableHead className="text-neutral-800 font-semibold text-center">วันทำงาน</TableHead>
                  <TableHead className="text-neutral-800 font-semibold text-center">ชม.ทำงาน</TableHead>
                  <TableHead className="text-neutral-800 font-semibold text-center">สาย</TableHead>
                  <TableHead className="text-neutral-800 font-semibold text-right">หักสาย</TableHead>
                  <TableHead className="text-neutral-800 font-semibold text-center">OT</TableHead>
                  <TableHead className="text-neutral-800 font-semibold text-right">ค่าOT</TableHead>
                  <TableHead className="text-neutral-800 font-semibold text-center">ลูกค้า</TableHead>
                  <TableHead className="text-neutral-800 font-semibold text-right">โบนัส</TableHead>
                  <TableHead className="text-neutral-800 font-semibold text-right">เงินสุทธิ</TableHead>
                  <TableHead className="text-neutral-800 font-semibold text-center">สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrolls.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-12 bg-amber-50/50">
                      <Calculator className="size-12 mx-auto mb-4 text-amber-400" />
                      <p className="text-neutral-700 font-medium">ยังไม่มีข้อมูลเงินเดือน</p>
                      <p className="text-neutral-500 text-sm mt-1">กดปุ่ม &quot;คำนวณเงินเดือน&quot; เพื่อเริ่มคำนวณ</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  payrolls.map((p: {
                    id: string;
                    admin_name: string;
                    admin_type: string;
                    total_work_days: number;
                    total_work_hours: number;
                    total_late_minutes: number;
                    total_late_penalty: number;
                    total_ot_hours: number;
                    total_ot_pay: number;
                    total_customers_served: number;
                    total_bonus: number;
                    net_salary: number;
                    status: string;
                    top_performer_bonus: number;
                    no_error_bonus: number;
                  }, index: number) => (
                    <TableRow key={p.id} className="border-amber-100 hover:bg-amber-50">
                      <TableCell className="font-medium text-neutral-900">
                        <div className="flex items-center gap-2">
                          {index === 0 && payrolls.length > 1 && (
                            <Trophy className="size-4 text-amber-500" />
                          )}
                          {p.admin_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-amber-100 text-amber-700 border border-amber-300">
                          {p.admin_type === 'keyin' ? 'คีย์หวย' : 'ทั่วไป'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-neutral-900">{p.total_work_days}</TableCell>
                      <TableCell className="text-center text-neutral-900">{p.total_work_hours}</TableCell>
                      <TableCell className="text-center">
                        {p.total_late_minutes > 0 ? (
                          <span className="text-red-600 font-medium">{p.total_late_minutes} นาที</span>
                        ) : (
                          <span className="text-green-600">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-red-600 font-medium">
                        {p.total_late_penalty > 0 ? `-฿${formatNumber(p.total_late_penalty)}` : '-'}
                      </TableCell>
                      <TableCell className="text-center text-purple-600">
                        {p.total_ot_hours > 0 ? `${p.total_ot_hours.toFixed(1)} ชม.` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-purple-600 font-medium">
                        {p.total_ot_pay > 0 ? `+฿${formatNumber(p.total_ot_pay)}` : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Target className="size-4 text-blue-500" />
                          <span className="text-neutral-900">{p.total_customers_served}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-green-600 font-semibold">
                            +฿{formatNumber(p.total_bonus)}
                          </span>
                          {p.top_performer_bonus > 0 && (
                            <span className="text-xs text-amber-600 font-medium">Top</span>
                          )}
                          {p.no_error_bonus > 0 && (
                            <span className="text-xs text-green-600">ไม่พลาด</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-neutral-900 text-lg">
                        ฿{formatNumber(p.net_salary)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={
                          p.status === 'approved' ? 'bg-green-100 text-green-700 border border-green-300' :
                          p.status === 'calculated' ? 'bg-blue-100 text-blue-700 border border-blue-300' :
                          'bg-yellow-100 text-yellow-700 border border-yellow-300'
                        }>
                          {p.status === 'approved' ? 'อนุมัติแล้ว' :
                           p.status === 'calculated' ? 'คำนวณแล้ว' : 'รอดำเนินการ'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payroll Info */}
      <Card className="bg-white border-2 border-amber-400 shadow-lg">
        <CardHeader className="border-b border-amber-200">
          <CardTitle className="text-lg text-amber-600 flex items-center gap-2">
            <AlertCircle className="size-5" />
            กฎการคำนวณเงินเดือน
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <Clock className="size-4 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-neutral-900">เข้างานสาย</p>
                <p className="text-neutral-700">หักนาทีละ ฿{settings.late_penalty_per_minute || 5}</p>
                <p className="text-neutral-500">เริ่มงาน {settings.work_start_hour || 9}:00 น.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <TrendingUp className="size-4 text-purple-500 mt-0.5" />
              <div>
                <p className="font-medium text-neutral-900">ค่าล่วงเวลา (OT)</p>
                <p className="text-neutral-700">ชั่วโมงละ ฿{settings.ot_rate_per_hour || 45}</p>
                <p className="text-neutral-500">เกิน {settings.work_hours_per_day || 8} ชม./วัน</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Award className="size-4 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium text-neutral-900">โบนัส</p>
                <p className="text-neutral-700">รับลูกค้า: ฿{settings.bonus_per_customer || 10}/คน</p>
                <p className="text-neutral-700">ไม่พลาด: ฿{settings.bonus_no_error || 500}/เดือน</p>
                <p className="text-neutral-700">Top: ฿{settings.bonus_top_performer || 1000}/เดือน</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Users className="size-4 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium text-neutral-900">วันหยุด</p>
                <p className="text-neutral-700">{settings.rest_days_per_week || 1} วัน/สัปดาห์</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Settings Form Component
function PayrollSettingsForm({ 
  settings, 
  onSave 
}: { 
  settings: Record<string, number | string>;
  onSave: (settings: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    base_salary: settings.base_salary || 15000,
    late_penalty_per_minute: settings.late_penalty_per_minute || 5,
    ot_rate_per_hour: settings.ot_rate_per_hour || 45,
    work_hours_per_day: settings.work_hours_per_day || 8,
    work_start_hour: settings.work_start_hour || 9,
    rest_days_per_week: settings.rest_days_per_week || 1,
    bonus_per_customer: settings.bonus_per_customer || 10,
    bonus_no_error: settings.bonus_no_error || 500,
    bonus_top_performer: settings.bonus_top_performer || 1000,
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-white/70">เงินเดือนพื้นฐาน (บาท)</Label>
          <Input
            type="number"
            value={form.base_salary}
            onChange={(e) => setForm({ ...form, base_salary: parseFloat(e.target.value) })}
            className="mt-1 bg-white/10 border-amber-500/30 text-white"
          />
        </div>
        <div>
          <Label className="text-white/70">เวลาเข้างาน (น.)</Label>
          <Input
            type="number"
            value={form.work_start_hour}
            onChange={(e) => setForm({ ...form, work_start_hour: parseInt(e.target.value) })}
            className="mt-1 bg-white/10 border-amber-500/30 text-white"
          />
        </div>
        <div>
          <Label className="text-white/70">หักสายนาทีละ (บาท)</Label>
          <Input
            type="number"
            value={form.late_penalty_per_minute}
            onChange={(e) => setForm({ ...form, late_penalty_per_minute: parseFloat(e.target.value) })}
            className="mt-1 bg-white/10 border-amber-500/30 text-white"
          />
        </div>
        <div>
          <Label className="text-white/70">ค่า OT ชั่วโมงละ (บาท)</Label>
          <Input
            type="number"
            value={form.ot_rate_per_hour}
            onChange={(e) => setForm({ ...form, ot_rate_per_hour: parseFloat(e.target.value) })}
            className="mt-1 bg-white/10 border-amber-500/30 text-white"
          />
        </div>
        <div>
          <Label className="text-white/70">ชม.ทำงาน/วัน</Label>
          <Input
            type="number"
            value={form.work_hours_per_day}
            onChange={(e) => setForm({ ...form, work_hours_per_day: parseInt(e.target.value) })}
            className="mt-1 bg-white/10 border-amber-500/30 text-white"
          />
        </div>
        <div>
          <Label className="text-white/70">วันหยุด/สัปดาห์</Label>
          <Input
            type="number"
            value={form.rest_days_per_week}
            onChange={(e) => setForm({ ...form, rest_days_per_week: parseInt(e.target.value) })}
            className="mt-1 bg-white/10 border-amber-500/30 text-white"
          />
        </div>
        <div>
          <Label className="text-white/70">โบนัสรับลูกค้า (บาท/คน)</Label>
          <Input
            type="number"
            value={form.bonus_per_customer}
            onChange={(e) => setForm({ ...form, bonus_per_customer: parseFloat(e.target.value) })}
            className="mt-1 bg-white/10 border-amber-500/30 text-white"
          />
        </div>
        <div>
          <Label className="text-white/70">โบนัสไม่พลาด (บาท/เดือน)</Label>
          <Input
            type="number"
            value={form.bonus_no_error}
            onChange={(e) => setForm({ ...form, bonus_no_error: parseFloat(e.target.value) })}
            className="mt-1 bg-white/10 border-amber-500/30 text-white"
          />
        </div>
        <div className="col-span-2">
          <Label className="text-white/70">โบนัส Top Performer (บาท/เดือน)</Label>
          <Input
            type="number"
            value={form.bonus_top_performer}
            onChange={(e) => setForm({ ...form, bonus_top_performer: parseFloat(e.target.value) })}
            className="mt-1 bg-white/10 border-amber-500/30 text-white"
          />
        </div>
      </div>
      <Button
        onClick={() => onSave(form)}
        className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold"
      >
        บันทึกการตั้งค่า
      </Button>
    </div>
  );
}
