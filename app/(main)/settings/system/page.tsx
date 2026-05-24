'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Globe, 
  Bell, 
  Shield, 
  Database,
  Clock,
  Save,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState({
    siteName: 'FIN LOTTO R+',
    siteUrl: 'https://finlotto.com',
    adminEmail: 'admin@finlotto.com',
    timezone: 'Asia/Bangkok',
    maintenanceMode: false,
    enableRegistration: true,
    enableDeposit: true,
    enableWithdraw: true,
    enableBetting: true,
    autoApproveDeposit: false,
    autoApproveWithdraw: false,
    minDeposit: 100,
    maxDeposit: 100000,
    minWithdraw: 100,
    maxWithdraw: 50000,
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    twoFactorAuth: false,
    ipWhitelist: '',
  });

  const handleSave = () => {
    toast.success('บันทึกการตั้งค่าสำเร็จ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            ตั้งค่าระบบ
          </h1>
          <p className="text-muted-foreground">จัดการการตั้งค่าระบบทั้งหมด</p>
        </div>
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          บันทึกการตั้งค่า
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Globe className="h-4 w-4" />
            ทั่วไป
          </TabsTrigger>
          <TabsTrigger value="finance" className="gap-2">
            <Database className="h-4 w-4" />
            การเงิน
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            ความปลอดภัย
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            การแจ้งเตือน
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลเว็บไซต์</CardTitle>
              <CardDescription>ตั้งค่าข้อมูลพื้นฐานของเว็บไซต์</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ชื่อเว็บไซต์</Label>
                  <Input 
                    value={settings.siteName}
                    onChange={(e) => setSettings({...settings, siteName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL เว็บไซต์</Label>
                  <Input 
                    value={settings.siteUrl}
                    onChange={(e) => setSettings({...settings, siteUrl: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>อีเมลผู้ดูแลระบบ</Label>
                  <Input 
                    type="email"
                    value={settings.adminEmail}
                    onChange={(e) => setSettings({...settings, adminEmail: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input 
                    value={settings.timezone}
                    onChange={(e) => setSettings({...settings, timezone: e.target.value})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>สถานะระบบ</CardTitle>
              <CardDescription>เปิด/ปิดฟังก์ชันหลักของระบบ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>โหมดบำรุงรักษา</Label>
                  <p className="text-sm text-muted-foreground">ปิดการเข้าถึงเว็บไซต์ชั่วคราว</p>
                </div>
                <Switch 
                  checked={settings.maintenanceMode}
                  onCheckedChange={(checked) => setSettings({...settings, maintenanceMode: checked})}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>เปิดรับสมัครสมาชิก</Label>
                  <p className="text-sm text-muted-foreground">อนุญาตให้ลงทะเบียนสมาชิกใหม่</p>
                </div>
                <Switch 
                  checked={settings.enableRegistration}
                  onCheckedChange={(checked) => setSettings({...settings, enableRegistration: checked})}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>เปิดรับฝากเงิน</Label>
                  <p className="text-sm text-muted-foreground">อนุญาตให้สมาชิกฝากเงิน</p>
                </div>
                <Switch 
                  checked={settings.enableDeposit}
                  onCheckedChange={(checked) => setSettings({...settings, enableDeposit: checked})}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>เปิดรับถอนเงิน</Label>
                  <p className="text-sm text-muted-foreground">อนุญาตให้สมาชิกถอนเงิน</p>
                </div>
                <Switch 
                  checked={settings.enableWithdraw}
                  onCheckedChange={(checked) => setSettings({...settings, enableWithdraw: checked})}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>เปิดรับแทง</Label>
                  <p className="text-sm text-muted-foreground">อนุญาตให้สมาชิกแทงหวย</p>
                </div>
                <Switch 
                  checked={settings.enableBetting}
                  onCheckedChange={(checked) => setSettings({...settings, enableBetting: checked})}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Finance Settings */}
        <TabsContent value="finance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>การฝากเงิน</CardTitle>
              <CardDescription>ตั้งค่าขีดจำกัดการฝากเงิน</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ฝากขั้นต่ำ (บาท)</Label>
                  <Input 
                    type="number"
                    value={settings.minDeposit}
                    onChange={(e) => setSettings({...settings, minDeposit: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ฝากสูงสุด (บาท)</Label>
                  <Input 
                    type="number"
                    value={settings.maxDeposit}
                    onChange={(e) => setSettings({...settings, maxDeposit: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>อนุมัติฝากอัตโนมัติ</Label>
                  <p className="text-sm text-muted-foreground">อนุมัติรายการฝากโดยอัตโนมัติ</p>
                </div>
                <Switch 
                  checked={settings.autoApproveDeposit}
                  onCheckedChange={(checked) => setSettings({...settings, autoApproveDeposit: checked})}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>การถอนเงิน</CardTitle>
              <CardDescription>ตั้งค่าขีดจำกัดการถอนเงิน</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ถอนขั้นต่ำ (บาท)</Label>
                  <Input 
                    type="number"
                    value={settings.minWithdraw}
                    onChange={(e) => setSettings({...settings, minWithdraw: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ถอนสูงสุด (บาท)</Label>
                  <Input 
                    type="number"
                    value={settings.maxWithdraw}
                    onChange={(e) => setSettings({...settings, maxWithdraw: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>อนุมัติถอนอัตโนมัติ</Label>
                  <p className="text-sm text-muted-foreground">อนุมัติรายการถอนโดยอัตโนมัติ</p>
                </div>
                <Switch 
                  checked={settings.autoApproveWithdraw}
                  onCheckedChange={(checked) => setSettings({...settings, autoApproveWithdraw: checked})}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>การเข้าสู่ระบบ</CardTitle>
              <CardDescription>ตั้งค่าความปลอดภัยในการเข้าสู่ระบบ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Session Timeout (นาที)
                  </Label>
                  <Input 
                    type="number"
                    value={settings.sessionTimeout}
                    onChange={(e) => setSettings({...settings, sessionTimeout: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>จำนวนครั้งที่ล็อกอินผิดสูงสุด</Label>
                  <Input 
                    type="number"
                    value={settings.maxLoginAttempts}
                    onChange={(e) => setSettings({...settings, maxLoginAttempts: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">บังคับใช้ 2FA สำหรับผู้ดูแลระบบ</p>
                </div>
                <Switch 
                  checked={settings.twoFactorAuth}
                  onCheckedChange={(checked) => setSettings({...settings, twoFactorAuth: checked})}
                />
              </div>
              <div className="space-y-2">
                <Label>IP Whitelist</Label>
                <Input 
                  placeholder="192.168.1.1, 10.0.0.1"
                  value={settings.ipWhitelist}
                  onChange={(e) => setSettings({...settings, ipWhitelist: e.target.value})}
                />
                <p className="text-sm text-muted-foreground">IP ที่อนุญาตให้เข้าถึงแอดมิน (คั่นด้วย ,)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>การแจ้งเตือน</CardTitle>
              <CardDescription>ตั้งค่าการแจ้งเตือนต่างๆ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>แจ้งเตือนฝากเงิน</Label>
                  <p className="text-sm text-muted-foreground">รับการแจ้งเตือนเมื่อมีรายการฝากเงินใหม่</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>แจ้งเตือนถอนเงิน</Label>
                  <p className="text-sm text-muted-foreground">รับการแจ้งเตือนเมื่อมีรายการถอนเงินใหม่</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>แจ้งเตือนสมาชิกใหม่</Label>
                  <p className="text-sm text-muted-foreground">รับการแจ้งเตือนเมื่อมีสมาชิกลงทะเบียนใหม่</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>แจ้งเตือนเลขเสี่ยง</Label>
                  <p className="text-sm text-muted-foreground">รับการแจ้งเตือนเมื่อมีเลขที่มียอดแทงสูง</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
