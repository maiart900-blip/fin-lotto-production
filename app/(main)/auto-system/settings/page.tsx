'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Settings, 
  Zap, 
  Power, 
  RefreshCw,
  RotateCcw,
  Save,
  TrendingUp,
  DollarSign,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Wifi,
  WifiOff,
  BarChart3,
  Percent,
  Crown,
  Database
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Rate settings type
interface RateSettings {
  two_top: number;
  two_bottom: number;
  three_top: number;
  three_tod: number;
  run_top: number;
  run_bottom: number;
}

// System status type
interface SystemStatus {
  isOnline: boolean;
  lastSync: string;
  todaySales: number;
  todayEntries: number;
  activeConnections: number;
  uptime: string;
  autoPayoutEnabled: boolean;
  autoProcessEnabled: boolean;
}

export default function AutoSystemSettingsPage() {
  // Auto system toggle states
  const [autoSystemEnabled, setAutoSystemEnabled] = useState(true);
  const [autoPayoutEnabled, setAutoPayoutEnabled] = useState(true);
  const [autoProcessEnabled, setAutoProcessEnabled] = useState(true);
  
  // Rate settings state
  const [rates, setRates] = useState<RateSettings>({
    two_top: 95,
    two_bottom: 95,
    three_top: 850,
    three_tod: 140,
    run_top: 3.5,
    run_bottom: 4.5
  });
  
  // UI states
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch system status - Real-time with 3 second refresh
  const { data: systemStatus, mutate: refreshStatus } = useSWR<SystemStatus>(
    '/api/auto-system/status',
    fetcher,
    { 
      refreshInterval: 3000, // Real-time update every 3 seconds
      revalidateOnFocus: true,
      dedupingInterval: 1000,
    }
  );

  // Fetch rate settings from database
  const { data: savedRates, mutate: refreshRates } = useSWR<RateSettings>(
    '/api/auto-system/rates',
    fetcher,
    {
      revalidateOnFocus: true,
      onSuccess: (data) => {
        if (data) setRates(data);
      }
    }
  );

  // Sync system status to local state when data changes
  useEffect(() => {
    if (systemStatus) {
      setAutoSystemEnabled(systemStatus.isOnline);
      setAutoPayoutEnabled(systemStatus.autoPayoutEnabled);
      setAutoProcessEnabled(systemStatus.autoProcessEnabled);
      setLastUpdated(new Date(systemStatus.lastSync));
    }
  }, [systemStatus]);

  // Handle rate change
  const handleRateChange = (field: keyof RateSettings, value: string) => {
    const numValue = parseFloat(value) || 0;
    setRates(prev => ({ ...prev, [field]: numValue }));
  };

  // Save rates to database
  const handleSaveRates = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/auto-system/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rates),
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success('บันทึกเรทราคาสำเร็จ');
        refreshRates(); // Refresh rates from database
        setLastUpdated(new Date());
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset system - clear cache and refresh all data
  const handleResetSystem = async () => {
    setIsResetting(true);
    try {
      // Reset to default settings
      const defaultRates = {
        two_top: 95,
        two_bottom: 95,
        three_top: 850,
        three_tod: 140,
        run_top: 3.5,
        run_bottom: 4.5
      };
      
      await fetch('/api/auto-system/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultRates),
      });
      
      setRates(defaultRates);
      await refreshStatus();
      await refreshRates();
      
      toast.success('รีเซ็ตระบบสำเร็จ');
      setLastUpdated(new Date());
    } catch {
      toast.error('เกิดข้อผิดพลาดในการรีเซ็ต');
    } finally {
      setIsResetting(false);
    }
  };

  // Refresh all data from database
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshStatus(), refreshRates()]);
      toast.success('ดึงข้อมูลล่าสุดสำเร็จ');
      setLastUpdated(new Date());
    } catch {
      toast.error('เกิดข้อผิดพลาดในการดึงข้อมูล');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Toggle auto system - save to database
  const handleToggleAutoSystem = async (enabled: boolean) => {
    setAutoSystemEnabled(enabled);
    try {
      const response = await fetch('/api/auto-system/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoSystemEnabled: enabled,
          autoPayoutEnabled,
          autoProcessEnabled,
        }),
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success(enabled ? 'เปิดระบบออโต้แล้ว' : 'ปิดระบบออโต้แล้ว');
        refreshStatus();
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ');
      setAutoSystemEnabled(!enabled); // Revert on error
    }
  };

  // Toggle sub-settings with API save
  const handleToggleAutoPayout = async (enabled: boolean) => {
    setAutoPayoutEnabled(enabled);
    try {
      await fetch('/api/auto-system/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoSystemEnabled,
          autoPayoutEnabled: enabled,
          autoProcessEnabled,
        }),
      });
      refreshStatus();
    } catch {
      setAutoPayoutEnabled(!enabled);
    }
  };

  const handleToggleAutoProcess = async (enabled: boolean) => {
    setAutoProcessEnabled(enabled);
    try {
      await fetch('/api/auto-system/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoSystemEnabled,
          autoPayoutEnabled,
          autoProcessEnabled: enabled,
        }),
      });
      refreshStatus();
    } catch {
      setAutoProcessEnabled(!enabled);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-[#F8FAFC] min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
            <div className="p-2 rounded-lg metallic-shine">
              <Settings className="size-6 text-white" />
            </div>
            <span>แผงควบคุมระบบออโต้</span>
          </h1>
          <p className="text-[#64748B] mt-1">
            จัดการระบบออโต้ ตั้งค่าเรท และติดตามสถานะระบบ
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            className={autoSystemEnabled 
              ? 'bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white border-0 glow-gold' 
              : 'bg-[#EF4444] text-white border-0'
            }
          >
            {autoSystemEnabled ? 'ระบบออนไลน์' : 'ระบบออฟไลน์'}
          </Badge>
          <span className="text-xs text-[#94A3B8]">
            อัปเดต: {lastUpdated.toLocaleTimeString('th-TH')}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Auto Toggle */}
          <Card className="border-[rgba(234,179,8,0.3)] bg-white overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#bf953f] via-[#fcf6ba] to-[#aa771c]" />
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-[#B8860B]">
                <div className="flex items-center gap-2">
                  <Power className="size-5" />
                  ระบบซื้อขายอัตโนมัติ
                </div>
                <Switch
                  checked={autoSystemEnabled}
                  onCheckedChange={handleToggleAutoSystem}
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[#EAB308] data-[state=checked]:to-[#B8860B]"
                />
              </CardTitle>
              <CardDescription className="text-[#64748B]">
                เปิด/ปิด การทำงานของระบบรับแทงอัตโนมัติทั้งหมด
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sub toggles */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="flex items-center gap-3">
                  <Zap className="size-5 text-[#EAB308]" />
                  <div>
                    <p className="font-medium text-[#0F172A]">Auto Process</p>
                    <p className="text-sm text-[#64748B]">ประมวลผลรายการอัตโนมัติ</p>
                  </div>
                </div>
                <Switch
                  checked={autoProcessEnabled}
                  onCheckedChange={handleToggleAutoProcess}
                  disabled={!autoSystemEnabled}
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[#EAB308] data-[state=checked]:to-[#B8860B]"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="flex items-center gap-3">
                  <DollarSign className="size-5 text-[#22C55E]" />
                  <div>
                    <p className="font-medium text-[#0F172A]">Auto Payout</p>
                    <p className="text-sm text-[#64748B]">จ่ายรางวัลอัตโนมัติ</p>
                  </div>
                </div>
                <Switch
                  checked={autoPayoutEnabled}
                  onCheckedChange={handleToggleAutoPayout}
                  disabled={!autoSystemEnabled}
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[#EAB308] data-[state=checked]:to-[#B8860B]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Rate Settings */}
          <Card className="border-[rgba(234,179,8,0.3)] bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#B8860B]">
                <Percent className="size-5" />
                ตั้งค่าเรทราคา
              </CardTitle>
              <CardDescription className="text-[#64748B]">
                กำหนดอัตราจ่ายสำหรับหวยออโต้ (บาท/1 บาท)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* 2 Top */}
                <div className="space-y-2">
                  <Label htmlFor="two_top" className="text-[#0F172A] font-medium">2 ตัวบน</Label>
                  <Input
                    id="two_top"
                    type="number"
                    value={rates.two_top}
                    onChange={(e) => handleRateChange('two_top', e.target.value)}
                    className="bg-white border-[#E2E8F0] focus:border-[#EAB308] focus:ring-[rgba(234,179,8,0.3)]"
                  />
                </div>

                {/* 2 Bottom */}
                <div className="space-y-2">
                  <Label htmlFor="two_bottom" className="text-[#0F172A] font-medium">2 ตัวล่าง</Label>
                  <Input
                    id="two_bottom"
                    type="number"
                    value={rates.two_bottom}
                    onChange={(e) => handleRateChange('two_bottom', e.target.value)}
                    className="bg-white border-[#E2E8F0] focus:border-[#EAB308] focus:ring-[rgba(234,179,8,0.3)]"
                  />
                </div>

                {/* 3 Top */}
                <div className="space-y-2">
                  <Label htmlFor="three_top" className="text-[#0F172A] font-medium">3 ตัวบน</Label>
                  <Input
                    id="three_top"
                    type="number"
                    value={rates.three_top}
                    onChange={(e) => handleRateChange('three_top', e.target.value)}
                    className="bg-white border-[#E2E8F0] focus:border-[#EAB308] focus:ring-[rgba(234,179,8,0.3)]"
                  />
                </div>

                {/* 3 Tod */}
                <div className="space-y-2">
                  <Label htmlFor="three_tod" className="text-[#0F172A] font-medium">3 ตัวโต๊ด</Label>
                  <Input
                    id="three_tod"
                    type="number"
                    value={rates.three_tod}
                    onChange={(e) => handleRateChange('three_tod', e.target.value)}
                    className="bg-white border-[#E2E8F0] focus:border-[#EAB308] focus:ring-[rgba(234,179,8,0.3)]"
                  />
                </div>

                {/* Run Top */}
                <div className="space-y-2">
                  <Label htmlFor="run_top" className="text-[#0F172A] font-medium">วิ่งบน</Label>
                  <Input
                    id="run_top"
                    type="number"
                    step="0.1"
                    value={rates.run_top}
                    onChange={(e) => handleRateChange('run_top', e.target.value)}
                    className="bg-white border-[#E2E8F0] focus:border-[#EAB308] focus:ring-[rgba(234,179,8,0.3)]"
                  />
                </div>

                {/* Run Bottom */}
                <div className="space-y-2">
                  <Label htmlFor="run_bottom" className="text-[#0F172A] font-medium">วิ่งล่าง</Label>
                  <Input
                    id="run_bottom"
                    type="number"
                    step="0.1"
                    value={rates.run_bottom}
                    onChange={(e) => handleRateChange('run_bottom', e.target.value)}
                    className="bg-white border-[#E2E8F0] focus:border-[#EAB308] focus:ring-[rgba(234,179,8,0.3)]"
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleSaveRates}
                  disabled={isSaving}
                  className="btn-reflective-gold px-8"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="size-4 animate-spin mr-2" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <Save className="size-4 mr-2" />
                      บันทึกเรท
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card className="border-[rgba(234,179,8,0.3)] bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#B8860B]">
                <Activity className="size-5" />
                การดำเนินการ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <Button
                  variant="outline"
                  onClick={handleResetSystem}
                  disabled={isResetting}
                  className="h-14 border-[#EF4444] text-[#EF4444] hover:bg-[rgba(239,68,68,0.1)]"
                >
                  {isResetting ? (
                    <>
                      <RefreshCw className="size-5 animate-spin mr-2" />
                      กำลังรีเซ็ต...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="size-5 mr-2" />
                      รีเซ็ตระบบ
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="h-14 border-[#3B82F6] text-[#3B82F6] hover:bg-[rgba(59,130,246,0.1)]"
                >
                  {isRefreshing ? (
                    <>
                      <RefreshCw className="size-5 animate-spin mr-2" />
                      กำลังดึงข้อมูล...
                    </>
                  ) : (
                    <>
                      <Database className="size-5 mr-2" />
                      ดึงข้อมูลล่าสุด
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Status Dashboard */}
        <div className="space-y-6">
          {/* System Status */}
          <Card className="border-[rgba(234,179,8,0.3)] bg-white overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#22C55E] via-[#16A34A] to-[#15803D]" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#B8860B]">
                <Activity className="size-5" />
                สถานะระบบ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Online Status */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0]">
                <div className="flex items-center gap-2">
                  {autoSystemEnabled ? (
                    <Wifi className="size-5 text-[#22C55E]" />
                  ) : (
                    <WifiOff className="size-5 text-[#EF4444]" />
                  )}
                  <span className="font-medium text-[#0F172A]">สถานะบอท</span>
                </div>
                <Badge className={autoSystemEnabled 
                  ? 'bg-[#22C55E] text-white' 
                  : 'bg-[#EF4444] text-white'
                }>
                  {autoSystemEnabled ? 'กำลังทำงาน' : 'หยุดทำงาน'}
                </Badge>
              </div>

              {/* Stats */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">ยอดขายวันนี้</span>
                  <span className="font-bold text-[#0F172A]">
                    {formatCurrency(systemStatus?.todaySales || 0)}
                  </span>
                </div>
                <Separator className="bg-[#E2E8F0]" />
                
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">รายการวันนี้</span>
                  <span className="font-bold text-[#0F172A]">
                    {systemStatus?.todayEntries || 0} รายการ
                  </span>
                </div>
                <Separator className="bg-[#E2E8F0]" />
                
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">การเชื่อมต่อ</span>
                  <span className="font-bold text-[#22C55E]">
                    {systemStatus?.activeConnections || 0} Active
                  </span>
                </div>
                <Separator className="bg-[#E2E8F0]" />
                
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Uptime</span>
                  <span className="font-bold text-[#0F172A]">
                    {systemStatus?.uptime || '99.9%'}
                  </span>
                </div>
              </div>

              {/* Last Sync */}
              <div className="pt-3 border-t border-[#E2E8F0]">
                <div className="flex items-center gap-2 text-sm text-[#64748B]">
                  <Clock className="size-4" />
                  <span>
                    ซิงค์ล่าสุด: {systemStatus?.lastSync 
                      ? new Date(systemStatus.lastSync).toLocaleString('th-TH')
                      : '-'
                    }
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Feature Status */}
          <Card className="border-[rgba(234,179,8,0.3)] bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#B8860B]">
                <CheckCircle className="size-5" />
                สถานะฟีเจอร์
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2">
                <span className="text-[#0F172A]">Auto Process</span>
                {autoProcessEnabled && autoSystemEnabled ? (
                  <CheckCircle className="size-5 text-[#22C55E]" />
                ) : (
                  <XCircle className="size-5 text-[#94A3B8]" />
                )}
              </div>
              <div className="flex items-center justify-between p-2">
                <span className="text-[#0F172A]">Auto Payout</span>
                {autoPayoutEnabled && autoSystemEnabled ? (
                  <CheckCircle className="size-5 text-[#22C55E]" />
                ) : (
                  <XCircle className="size-5 text-[#94A3B8]" />
                )}
              </div>
              <div className="flex items-center justify-between p-2">
                <span className="text-[#0F172A]">Entry Sync</span>
                <CheckCircle className="size-5 text-[#22C55E]" />
              </div>
              <div className="flex items-center justify-between p-2">
                <span className="text-[#0F172A]">Rate Update</span>
                <CheckCircle className="size-5 text-[#22C55E]" />
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card className="border-[rgba(234,179,8,0.3)] bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#B8860B]">
                <Crown className="size-5" />
                ลิงก์ด่วน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start text-[#0F172A] hover:bg-[rgba(234,179,8,0.1)] hover:text-[#B8860B]"
                asChild
              >
                <a href="/entry">
                  <TrendingUp className="size-4 mr-2" />
                  หน้าคีย์เลข
                </a>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-[#0F172A] hover:bg-[rgba(234,179,8,0.1)] hover:text-[#B8860B]"
                asChild
              >
                <a href="/auto-system">
                  <BarChart3 className="size-4 mr-2" />
                  Dashboard ออโต้
                </a>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-[#0F172A] hover:bg-[rgba(234,179,8,0.1)] hover:text-[#B8860B]"
                asChild
              >
                <a href="/auto-system/customers">
                  <DollarSign className="size-4 mr-2" />
                  ลูกค้าออโต้
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
