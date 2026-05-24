'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useEntries, useCustomers, useSettings, useBackup } from '@/hooks/use-lottery';
import { useAuth } from '@/hooks/use-auth';
import { BET_TYPE_LABELS } from '@/types/lottery';
import { 
  Settings, 
  Save, 
  Trash2, 
  AlertTriangle, 
  Download, 
  Upload, 
  FileJson, 
  Database,
  Crown,
  FileText,
  Shield,
  Cloud,
  Loader2,
  RefreshCw,
  Percent,
} from 'lucide-react';

export default function SettingsPage() {
  const { entries, mutate: mutateEntries, isLoading: entriesLoading } = useEntries();
  const { customers, mutate: mutateCustomers, isLoading: customersLoading } = useCustomers();
  const { settings, updateSettings, isLoading: settingsLoading } = useSettings();
  const { createBackup, restoreBackup, clearAllData } = useBackup();
  const { user, canAccess } = useAuth();

  const [siteName, setSiteName] = useState(settings.site_name);
  const [turnoverEnabled, setTurnoverEnabled] = useState(settings.turnover_enabled || false);
  const [turnoverPercentage, setTurnoverPercentage] = useState(settings.turnover_percentage || 100);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect if not admin
  if (!canAccess('settings')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <Shield className="size-16 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold text-foreground">ไม่มีสิทธิ์เข้าถึง</h1>
        <p className="text-muted-foreground mt-2">
          เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถเข้าถึงหน้านี้ได้
        </p>
      </div>
    );
  }

  const isLoading = entriesLoading || customersLoading || settingsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="size-8 animate-spin text-accent" />
      </div>
    );
  }

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await updateSettings({ 
        siteName: siteName.trim() || 'สลากพลัส Lotto',
        turnover_enabled: turnoverEnabled,
        turnover_percentage: Math.min(100, Math.max(1, turnoverPercentage)),
      });
      toast.success('บันทึกการตั้งค่าสำเร็จ');
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearAllData = async () => {
    setIsSubmitting(true);
    try {
      await clearAllData();
      await mutateEntries();
      await mutateCustomers();
      toast.success('ล้างข้อมูลทั้งหมดสำเร็จ');
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportJSON = async () => {
    setIsSubmitting(true);
    try {
      const result = await createBackup(user?.id);
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `salakplus-backup-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('สำรองข้อมูลสำเร็จ (Backup สู่ Cloud + ดาวน์โหลด)');
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['เลข', 'ประเภท', 'ยอด', 'ลูกค้า', 'วันที่'];
    const rows = entries.map((e) => [
      e.number,
      BET_TYPE_LABELS[e.bet_type] || e.bet_type,
      e.amount.toString(),
      e.customer?.name || '-',
      new Date(e.created_at).toLocaleString('th-TH'),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `salakplus-entries-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('ส่งออก CSV สำเร็จ');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        await restoreBackup(data);
        await mutateEntries();
        await mutateCustomers();
        toast.success('กู้คืนข้อมูลสำเร็จ');
      } catch {
        toast.error('ไฟล์ไม่ถูกต้อง กรุณาใช้ไฟล์ JSON ที่ส่งออกจากระบบ');
      } finally {
        setIsSubmitting(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="size-6" />
          ตั้งค่า
        </h1>
        <p className="text-muted-foreground">จัดการการตั้งค่าและข้อมูลของระบบ</p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="size-5 text-accent" />
            ตั้งค่าทั่วไป
          </CardTitle>
          <CardDescription>ปรับแต่งชื่อเว็บไซต์</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="siteName">ชื่อเว็บไซต์</Label>
            <Input
              id="siteName"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="สลากพลัส Lotto"
            />
            <p className="text-xs text-muted-foreground">
              แสดงใน Sidebar และ Title ของเว็บ
            </p>
          </div>
          <Button 
            onClick={handleSave} 
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
            บันทึกการตั้งค่า
          </Button>
        </CardContent>
      </Card>

      {/* Turnover Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="size-5 text-amber-500" />
            ตั้งค่าเทิร์นโอเวอร์
          </CardTitle>
          <CardDescription>กำหนดเงื่อนไขการถอนเงินของลูกค้า</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle Enable/Disable */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border">
            <div className="space-y-1">
              <Label htmlFor="turnoverEnabled" className="text-base font-medium">เปิดใช้งานระบบเทิร์นโอเวอร์</Label>
              <p className="text-sm text-muted-foreground">
                เมื่อเปิดใช้งาน ลูกค้าต้องเดิมพันตามเงื่อนไขก่อนถอนเงินได้
              </p>
            </div>
            <button
              id="turnoverEnabled"
              type="button"
              role="switch"
              aria-checked={turnoverEnabled}
              onClick={() => setTurnoverEnabled(!turnoverEnabled)}
              className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${turnoverEnabled ? 'bg-amber-500' : 'bg-muted'}`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${turnoverEnabled ? 'translate-x-7' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Turnover Percentage */}
          {turnoverEnabled && (
            <div className="space-y-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
              <div className="space-y-2">
                <Label htmlFor="turnoverPercentage" className="flex items-center gap-2">
                  <Percent className="size-4 text-amber-500" />
                  เปอร์เซ็นต์เทิร์นโอเวอร์
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="turnoverPercentage"
                    type="number"
                    min={1}
                    max={100}
                    value={turnoverPercentage}
                    onChange={(e) => setTurnoverPercentage(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-32"
                  />
                  <span className="text-muted-foreground">% ของยอดฝาก</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  ตั้งค่า 1-100% เช่น ตั้ง 50% หมายความว่า ลูกค้าฝาก 1,000 บาท ต้องเดิมพัน 500 บาท จึงจะถอนได้
                </p>
              </div>

              {/* Preview */}
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium text-foreground mb-2">ตัวอย่างการคำนวณ:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">ลูกค้าฝาก:</span>
                  <span className="font-mono">1,000 บาท</span>
                  <span className="text-muted-foreground">ต้องเดิมพัน:</span>
                  <span className="font-mono text-amber-500">{(1000 * turnoverPercentage / 100).toLocaleString()} บาท</span>
                </div>
              </div>
            </div>
          )}

          <Button 
            onClick={handleSave} 
            className="bg-amber-500 text-black hover:bg-amber-600"
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
            บันทึกการตั้งค่าเทิร์นโอเวอร์
          </Button>
        </CardContent>
      </Card>

      {/* Data Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-5 text-accent" />
            ข้อมูลในระบบ
          </CardTitle>
          <CardDescription>สถิติข้อมูลที่บันทึกไว้ใน Cloud</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/20 to-transparent border border-primary/20">
              <p className="text-muted-foreground text-sm">จำนวนรายการ</p>
              <p className="text-2xl font-bold text-primary">{entries.length}</p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-transparent border border-blue-500/20">
              <p className="text-muted-foreground text-sm">จำนวนลูกค้า</p>
              <p className="text-2xl font-bold text-blue-500">{customers.length}</p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-accent/20 to-transparent border border-accent/20">
              <p className="text-muted-foreground text-sm">ยอดรวม</p>
              <p className="text-2xl font-bold text-accent">
                {entries.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export/Import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="size-5 text-accent" />
            สำรองและกู้คืนข้อมูล
          </CardTitle>
          <CardDescription>ส่งออกและนำเข้าข้อมูลทั้งหมด</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Button variant="outline" onClick={handleExportJSON} className="justify-start" disabled={isSubmitting}>
              <Download className="size-4 mr-2" />
              สำรองข้อมูล (JSON)
            </Button>
            <Button variant="outline" onClick={handleExportCSV} className="justify-start" disabled={isSubmitting}>
              <FileText className="size-4 mr-2" />
              ส่งออก CSV
            </Button>
            <Button variant="outline" onClick={handleImportClick} className="justify-start" disabled={isSubmitting}>
              <Upload className="size-4 mr-2" />
              กู้คืนข้อมูล (JSON)
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Cloud className="size-3" />
            ข้อมูลถูกบันทึกใน Supabase Cloud Database โดยอัตโนมัติ
          </p>
        </CardContent>
      </Card>

      {/* Danger Zone - Only for Admin */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            การดำเนินการในส่วนนี้ไม่สามารถย้อนกลับได้
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isSubmitting}>
                <Trash2 className="size-4 mr-2" />
                ล้างข้อมูลทั้งหมด
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-5 text-destructive" />
                  ยืนยันการล้างข้อมูล
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>คุณกำลังจะลบข้อมูลทั้งหมดในระบบ:</p>
                  <ul className="list-disc list-inside text-sm">
                    <li>รายการคีย์เลขทั้งหมด ({entries.length} รายการ)</li>
                    <li>ข้อมูลลูกค้าทั้งหมด ({customers.length} คน)</li>
                  </ul>
                  <p className="font-medium text-destructive">
                    แนะนำให้สำรองข้อมูลก่อนลบ!
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearAllData}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  ล้างข้อมูลทั้งหมด
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="size-5 text-accent" />
            เกี่ยวกับระบบ
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p className="text-accent font-medium">สลากพลัส Lotto - ระบบจัดการข้อมูลภายใน Premium</p>
          <div className="flex items-center gap-2">
            <Cloud className="size-4 text-emerald-500" />
            <span>เชื่อมต่อ Supabase Cloud Database - ข้อมูลไม่หายเมื่อปิดเครื่อง</span>
          </div>
          <p className="text-xs opacity-70">สำหรับใช้งานภายในเท่านั้น</p>
        </CardContent>
      </Card>
    </div>
  );
}
