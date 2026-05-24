'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Settings,
  DollarSign,
  Clock,
  Calendar,
  Award,
  Save,
  RefreshCw,
} from 'lucide-react';

interface PayrollSettings {
  base_salary: number;
  late_penalty_per_minute: number;
  ot_rate_per_hour: number;
  work_hours_per_day: number;
  work_start_hour: number;
  rest_days_per_week: number;
  bonus_per_customer: number;
  bonus_no_error: number;
  bonus_top_performer: number;
}

export default function PayrollSettingsPage() {
  const [settings, setSettings] = useState<PayrollSettings>({
    base_salary: 15000,
    late_penalty_per_minute: 5,
    ot_rate_per_hour: 45,
    work_hours_per_day: 8,
    work_start_hour: 9,
    rest_days_per_week: 1,
    bonus_per_customer: 10,
    bonus_no_error: 500,
    bonus_top_performer: 1000,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payroll/settings');
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/payroll/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      
      if (res.ok) {
        toast.success('บันทึกการตั้งค่าสำเร็จ');
      } else {
        toast.error('เกิดข้อผิดพลาดในการบันทึก');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: keyof PayrollSettings, value: number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600">
            <Settings className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">ตั้งค่า Payroll</h1>
            <p className="text-slate-500">กำหนดอัตราเงินเดือน โอที โบนัส และการหักเงิน</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchSettings} disabled={loading}>
            <RefreshCw className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-amber-500 to-amber-600">
            <Save className="size-4 mr-2" />
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* เงินเดือนพื้นฐาน */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="size-5 text-green-500" />
              เงินเดือนพื้นฐาน
            </CardTitle>
            <CardDescription>กำหนดเงินเดือนพื้นฐานของแอดมิน</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>เงินเดือนพื้นฐาน (บาท/เดือน)</Label>
              <Input
                type="number"
                value={settings.base_salary}
                onChange={(e) => handleChange('base_salary', Number(e.target.value))}
                className="bg-white border-slate-200"
              />
            </div>
          </CardContent>
        </Card>

        {/* เวลาทำงาน */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="size-5 text-blue-500" />
              เวลาทำงาน
            </CardTitle>
            <CardDescription>กำหนดชั่วโมงทำงานและเวลาเข้างาน</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>เวลาเข้างาน (นาฬิกา)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={settings.work_start_hour}
                  onChange={(e) => handleChange('work_start_hour', Number(e.target.value))}
                  className="bg-white border-slate-200"
                />
                <p className="text-xs text-slate-500">เช่น 9 = 09:00 น.</p>
              </div>
              <div className="space-y-2">
                <Label>ชั่วโมงทำงาน/วัน</Label>
                <Input
                  type="number"
                  value={settings.work_hours_per_day}
                  onChange={(e) => handleChange('work_hours_per_day', Number(e.target.value))}
                  className="bg-white border-slate-200"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* วันหยุด */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="size-5 text-purple-500" />
              วันหยุด
            </CardTitle>
            <CardDescription>กำหนดจำนวนวันหยุดต่อสัปดาห์</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>วันหยุดต่อสัปดาห์</Label>
              <Input
                type="number"
                min={0}
                max={7}
                value={settings.rest_days_per_week}
                onChange={(e) => handleChange('rest_days_per_week', Number(e.target.value))}
                className="bg-white border-slate-200"
              />
            </div>
          </CardContent>
        </Card>

        {/* ค่าล่วงเวลา (OT) */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="size-5 text-amber-500" />
              ค่าล่วงเวลา (OT)
            </CardTitle>
            <CardDescription>อัตราค่าล่วงเวลาต่อชั่วโมง</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>ค่า OT (บาท/ชั่วโมง)</Label>
              <Input
                type="number"
                value={settings.ot_rate_per_hour}
                onChange={(e) => handleChange('ot_rate_per_hour', Number(e.target.value))}
                className="bg-white border-slate-200"
              />
              <p className="text-xs text-slate-500">ทำงานเกิน {settings.work_hours_per_day} ชม./วัน = OT</p>
            </div>
          </CardContent>
        </Card>

        {/* การหักเงินสาย */}
        <Card className="bg-card/50 border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="size-5 text-red-500" />
              หักเงินสาย
            </CardTitle>
            <CardDescription>อัตราหักเงินเมื่อเข้างานสาย</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>หักเงินสาย (บาท/นาที)</Label>
              <Input
                type="number"
                value={settings.late_penalty_per_minute}
                onChange={(e) => handleChange('late_penalty_per_minute', Number(e.target.value))}
                className="bg-white/10 border-red-500/30"
              />
              <p className="text-xs text-slate-500">เข้างานหลัง {settings.work_start_hour}:00 น. = หักเงิน</p>
            </div>
          </CardContent>
        </Card>

        {/* โบนัส */}
        <Card className="bg-card/50 border-green-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="size-5 text-green-500" />
              โบนัส
            </CardTitle>
            <CardDescription>กำหนดอัตราโบนัสต่างๆ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>โบนัสต่อลูกค้า (บาท/คน)</Label>
              <Input
                type="number"
                value={settings.bonus_per_customer}
                onChange={(e) => handleChange('bonus_per_customer', Number(e.target.value))}
                className="bg-white/10 border-green-500/30"
              />
            </div>
            <div className="space-y-2">
              <Label>โบนัสไม่พลาดเลย (บาท/เดือน)</Label>
              <Input
                type="number"
                value={settings.bonus_no_error}
                onChange={(e) => handleChange('bonus_no_error', Number(e.target.value))}
                className="bg-white/10 border-green-500/30"
              />
              <p className="text-xs text-slate-500">ได้รับเมื่อไม่มีข้อผิดพลาดตลอดเดือน</p>
            </div>
            <div className="space-y-2">
              <Label>โบนัส Top Performer (บาท/เดือน)</Label>
              <Input
                type="number"
                value={settings.bonus_top_performer}
                onChange={(e) => handleChange('bonus_top_performer', Number(e.target.value))}
                className="bg-white/10 border-green-500/30"
              />
              <p className="text-xs text-slate-500">ได้รับสำหรับแอดมินที่มีผลงานดีที่สุด</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card className="bg-gradient-to-r from-amber-500/10 to-amber-600/5 border-amber-500/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-sm">
              <span className="text-amber-200">สรุป:</span>
              <span className="text-white ml-2">เงินเดือน ฿{settings.base_salary.toLocaleString()}</span>
              <span className="text-slate-500 mx-2">|</span>
              <span className="text-white">OT ฿{settings.ot_rate_per_hour}/ชม.</span>
              <span className="text-slate-500 mx-2">|</span>
              <span className="text-red-400">หักสาย ฿{settings.late_penalty_per_minute}/นาที</span>
              <span className="text-slate-500 mx-2">|</span>
              <span className="text-green-400">โบนัส ฿{settings.bonus_per_customer}/ลูกค้า</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
