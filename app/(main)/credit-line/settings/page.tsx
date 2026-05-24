'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, ArrowLeft, Save, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function CreditLineSettingsPage() {
  const [settings, setSettings] = useState({
    enableCreditLine: true,
    defaultCreditLine: 10000,
    maxCreditLine: 1000000,
    minCreditLine: 1000,
    autoResetDaily: false,
    requireApproval: true,
    notifyOnLowCredit: true,
    lowCreditThreshold: 20
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('บันทึกการตั้งค่าเรียบร้อย');
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/credit-line">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Settings className="size-6 text-[#D4AF37]" />
              ตั้งค่า Credit Line
            </h1>
            <p className="text-slate-400 mt-1">กำหนดเงื่อนไขและวงเงินเริ่มต้น</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-[#D4AF37] text-black hover:bg-[#B4941F]">
          <Save className="size-4 mr-2" />
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-black/40 border-[#D4AF37]/20">
          <CardHeader>
            <CardTitle className="text-white">ตั้งค่าทั่วไป</CardTitle>
            <CardDescription>การตั้งค่าพื้นฐานของระบบ Credit Line</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">เปิดใช้งานระบบ Credit Line</Label>
                <p className="text-sm text-slate-400">อนุญาตให้เอเย่นใช้วงเงินหุ้นลม</p>
              </div>
              <Switch checked={settings.enableCreditLine} onCheckedChange={(v) => setSettings({...settings, enableCreditLine: v})} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">ต้องขออนุมัติ</Label>
                <p className="text-sm text-slate-400">ต้องให้ Admin อนุมัติก่อนใช้วงเงิน</p>
              </div>
              <Switch checked={settings.requireApproval} onCheckedChange={(v) => setSettings({...settings, requireApproval: v})} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">รีเซ็ตวงเงินรายวัน</Label>
                <p className="text-sm text-slate-400">รีเซ็ตวงเงินที่ใช้ไปทุกวัน</p>
              </div>
              <Switch checked={settings.autoResetDaily} onCheckedChange={(v) => setSettings({...settings, autoResetDaily: v})} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-[#D4AF37]/20">
          <CardHeader>
            <CardTitle className="text-white">วงเงิน</CardTitle>
            <CardDescription>กำหนดวงเงินเริ่มต้นและขีดจำกัด</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-slate-300">วงเงินเริ่มต้น (บาท)</Label>
              <Input type="number" value={settings.defaultCreditLine} onChange={(e) => setSettings({...settings, defaultCreditLine: Number(e.target.value)})} className="mt-2 bg-slate-800 border-slate-700" />
            </div>
            <div>
              <Label className="text-slate-300">วงเงินขั้นต่ำ (บาท)</Label>
              <Input type="number" value={settings.minCreditLine} onChange={(e) => setSettings({...settings, minCreditLine: Number(e.target.value)})} className="mt-2 bg-slate-800 border-slate-700" />
            </div>
            <div>
              <Label className="text-slate-300">วงเงินสูงสุด (บาท)</Label>
              <Input type="number" value={settings.maxCreditLine} onChange={(e) => setSettings({...settings, maxCreditLine: Number(e.target.value)})} className="mt-2 bg-slate-800 border-slate-700" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-[#D4AF37]/20 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white">การแจ้งเตือน</CardTitle>
            <CardDescription>ตั้งค่าการแจ้งเตือนเมื่อวงเงินต่ำ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">แจ้งเตือนเมื่อวงเงินต่ำ</Label>
                <p className="text-sm text-slate-400">ส่งการแจ้งเตือนเมื่อวงเงินคงเหลือต่ำกว่าที่กำหนด</p>
              </div>
              <Switch checked={settings.notifyOnLowCredit} onCheckedChange={(v) => setSettings({...settings, notifyOnLowCredit: v})} />
            </div>
            {settings.notifyOnLowCredit && (
              <div className="flex items-center gap-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertCircle className="size-5 text-amber-400" />
                <div className="flex-1">
                  <Label className="text-slate-300">เปอร์เซ็นต์ที่แจ้งเตือน</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input type="number" value={settings.lowCreditThreshold} onChange={(e) => setSettings({...settings, lowCreditThreshold: Number(e.target.value)})} className="w-24 bg-slate-800 border-slate-700" />
                    <span className="text-slate-400">% ของวงเงินทั้งหมด</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
