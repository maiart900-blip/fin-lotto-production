'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Crown,
  Zap,
  Settings,
  Bot,
  Hand,
  Activity,
  Shield,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Save,
  Lock,
  Unlock,
  Users,
  DollarSign,
  BarChart3,
  Bell,
  ChevronRight,
  Gauge,
  Target,
  Flame,
  Ban,
} from 'lucide-react';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface SystemMode {
  mode: 'auto' | 'manual' | 'hybrid';
  autoProcess: boolean;
  autoPayout: boolean;
  autoRiskManagement: boolean;
  maxAutoAmount: number;
}

interface RiskNumber {
  number: string;
  totalBets: number;
  potentialPayout: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  action: 'normal' | 'reduced' | 'blocked';
  adjustedRate?: number;
}

export default function ControlCenterPage() {
  const [systemMode, setSystemMode] = useState<SystemMode>({
    mode: 'hybrid',
    autoProcess: true,
    autoPayout: true,
    autoRiskManagement: true,
    maxAutoAmount: 10000,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch system status
  const { data: systemStatus, mutate: refreshStatus } = useSWR(
    '/api/auto-system/status',
    fetcher,
    { refreshInterval: 3000 }
  );

  // Fetch risk numbers (เลขอั้น/เลขเต็ม)
  const { data: riskData, mutate: refreshRisk } = useSWR(
    '/api/risk-management/numbers',
    fetcher,
    { refreshInterval: 5000 }
  );

  // ใช้ข้อมูลจาก API เท่านั้น - ถ้าไม่มีข้อมูลจะแสดง empty state
  const riskNumbers: RiskNumber[] = riskData?.numbers || [];

  const handleModeChange = async (mode: 'auto' | 'manual' | 'hybrid') => {
    setSystemMode(prev => ({ ...prev, mode }));
    toast.success(`เปลี่ยนโหมดเป็น ${mode === 'auto' ? 'อัตโนมัติ' : mode === 'manual' ? 'แมนวล' : 'ไฮบริด'}`);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/system-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_mode: systemMode }),
      });
      toast.success('บันทึกการตั้งค่าสำเร็จ');
    } catch {
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBlockNumber = async (number: string) => {
    toast.success(`บล็อคเลข ${number} แล้ว`);
    refreshRisk();
  };

  const handleUnblockNumber = async (number: string) => {
    toast.success(`ปลดบล็อคเลข ${number} แล้ว`);
    refreshRisk();
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  const getRiskBorderColor = (level: string) => {
    switch (level) {
      case 'critical': return 'border-red-500/50';
      case 'high': return 'border-orange-500/50';
      case 'medium': return 'border-yellow-500/50';
      default: return 'border-green-500/50';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-[#1E293B] p-6 -m-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] shadow-lg shadow-[rgba(234,179,8,0.4)]">
              <Gauge className="size-6 text-white" />
            </div>
            <span className="text-gold-gradient">Control Center</span>
          </h1>
          <p className="text-[#94A3B8] mt-1">ศูนย์ควบคุมระบบ Auto + Manual</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${systemMode.mode === 'auto' ? 'bg-green-500' : systemMode.mode === 'manual' ? 'bg-blue-500' : 'bg-gradient-to-r from-[#EAB308] to-[#B8860B]'} text-white`}>
            <Activity className="size-3 mr-1 animate-pulse" />
            {systemMode.mode === 'auto' ? 'Full Auto' : systemMode.mode === 'manual' ? 'Manual' : 'Hybrid'}
          </Badge>
          <Button
            onClick={() => { refreshStatus(); refreshRisk(); }}
            variant="outline"
            size="sm"
            className="border-[#EAB308]/50 text-[#EAB308] hover:bg-[#EAB308]/10"
          >
            <RefreshCw className="size-4 mr-1" />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Mode Selection Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {/* Manual Mode */}
        <Card 
          className={`cursor-pointer transition-all duration-300 ${
            systemMode.mode === 'manual' 
              ? 'bg-gradient-to-br from-blue-600/20 to-blue-800/20 border-blue-500 shadow-lg shadow-blue-500/20' 
              : 'bg-[#1E293B]/80 border-[#334155] hover:border-blue-500/50'
          }`}
          onClick={() => handleModeChange('manual')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-2xl ${systemMode.mode === 'manual' ? 'bg-blue-500' : 'bg-blue-500/20'}`}>
                <Hand className={`size-8 ${systemMode.mode === 'manual' ? 'text-white' : 'text-blue-400'}`} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Manual Mode</h3>
                <p className="text-sm text-[#94A3B8]">แอดมินตรวจสอบและอนุมัติทุกรายการ</p>
              </div>
            </div>
            {systemMode.mode === 'manual' && (
              <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <p className="text-xs text-blue-300">กำลังใช้งาน - ทุกรายการต้องได้รับการอนุมัติ</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hybrid Mode */}
        <Card 
          className={`cursor-pointer transition-all duration-300 ${
            systemMode.mode === 'hybrid' 
              ? 'bg-gradient-to-br from-[#EAB308]/20 to-[#B8860B]/20 border-[#EAB308] shadow-lg shadow-[#EAB308]/20' 
              : 'bg-[#1E293B]/80 border-[#334155] hover:border-[#EAB308]/50'
          }`}
          onClick={() => handleModeChange('hybrid')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-2xl ${systemMode.mode === 'hybrid' ? 'bg-gradient-to-br from-[#EAB308] to-[#B8860B]' : 'bg-[#EAB308]/20'}`}>
                <Settings className={`size-8 ${systemMode.mode === 'hybrid' ? 'text-white' : 'text-[#EAB308]'}`} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Hybrid Mode</h3>
                <p className="text-sm text-[#94A3B8]">Auto สำหรับยอดเล็ก, Manual สำหรับยอดใหญ่</p>
              </div>
            </div>
            {systemMode.mode === 'hybrid' && (
              <div className="mt-4 p-3 rounded-lg bg-[#EAB308]/10 border border-[#EAB308]/30">
                <p className="text-xs text-[#EAB308]">แนะนำ - สมดุลระหว่างความเร็วและความปลอดภัย</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Auto Mode */}
        <Card 
          className={`cursor-pointer transition-all duration-300 ${
            systemMode.mode === 'auto' 
              ? 'bg-gradient-to-br from-green-600/20 to-green-800/20 border-green-500 shadow-lg shadow-green-500/20' 
              : 'bg-[#1E293B]/80 border-[#334155] hover:border-green-500/50'
          }`}
          onClick={() => handleModeChange('auto')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-2xl ${systemMode.mode === 'auto' ? 'bg-green-500' : 'bg-green-500/20'}`}>
                <Bot className={`size-8 ${systemMode.mode === 'auto' ? 'text-white' : 'text-green-400'}`} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Full Auto Mode</h3>
                <p className="text-sm text-[#94A3B8]">บอทจัดการทุกอย่าง 100%</p>
              </div>
            </div>
            {systemMode.mode === 'auto' && (
              <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                <p className="text-xs text-green-300">กำลังใช้งาน - ระบบทำงานอัตโนมัติเต็มรูปแบบ</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Controls & Risk Management */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* System Controls */}
        <Card className="bg-[#1E293B]/80 border-[#334155]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Settings className="size-5 text-[#EAB308]" />
              การควบคุมระบบ
            </CardTitle>
            <CardDescription className="text-[#94A3B8]">
              ตั้งค่าการทำงานของระบบอัตโนมัติ
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Auto Process */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#0F172A] border border-[#334155]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#EAB308]/20">
                  <Zap className="size-5 text-[#EAB308]" />
                </div>
                <div>
                  <p className="font-medium text-white">Auto Process</p>
                  <p className="text-xs text-[#94A3B8]">ประมวลผลรายการอัตโนมัติ</p>
                </div>
              </div>
              <Switch
                checked={systemMode.autoProcess}
                onCheckedChange={(checked) => setSystemMode(prev => ({ ...prev, autoProcess: checked }))}
                className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[#EAB308] data-[state=checked]:to-[#B8860B]"
              />
            </div>

            {/* Auto Payout */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#0F172A] border border-[#334155]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#EAB308]/20">
                  <DollarSign className="size-5 text-[#EAB308]" />
                </div>
                <div>
                  <p className="font-medium text-white">Auto Payout</p>
                  <p className="text-xs text-[#94A3B8]">จ่ายรางวัลอัตโนมัติ</p>
                </div>
              </div>
              <Switch
                checked={systemMode.autoPayout}
                onCheckedChange={(checked) => setSystemMode(prev => ({ ...prev, autoPayout: checked }))}
                className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[#EAB308] data-[state=checked]:to-[#B8860B]"
              />
            </div>

            {/* Auto Risk Management */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#0F172A] border border-[#334155]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#EAB308]/20">
                  <Shield className="size-5 text-[#EAB308]" />
                </div>
                <div>
                  <p className="font-medium text-white">Auto Risk Management</p>
                  <p className="text-xs text-[#94A3B8]">วิเคราะห์และจัดการความเสี่ยงอัตโนมัติ</p>
                </div>
              </div>
              <Switch
                checked={systemMode.autoRiskManagement}
                onCheckedChange={(checked) => setSystemMode(prev => ({ ...prev, autoRiskManagement: checked }))}
                className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[#EAB308] data-[state=checked]:to-[#B8860B]"
              />
            </div>

            {/* Max Auto Amount */}
            {systemMode.mode === 'hybrid' && (
              <div className="p-4 rounded-xl bg-[#0F172A] border border-[#334155]">
                <Label className="text-white mb-2 block">วงเงิน Auto สูงสุด (บาท)</Label>
                <Input
                  type="number"
                  value={systemMode.maxAutoAmount}
                  onChange={(e) => setSystemMode(prev => ({ ...prev, maxAutoAmount: parseInt(e.target.value) || 0 }))}
                  className="bg-[#0F172A] border-[#334155] text-white"
                />
                <p className="text-xs text-[#94A3B8] mt-2">รายการที่เกินวงเงินนี้จะต้องได้รับการอนุมัติจากแอดมิน</p>
              </div>
            )}

            <Button 
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="w-full premium-gold-btn"
            >
              {isSaving ? (
                <RefreshCw className="size-4 mr-2 animate-spin" />
              ) : (
                <Save className="size-4 mr-2" />
              )}
              บันทึกการตั้งค่า
            </Button>
          </CardContent>
        </Card>

        {/* Risk Numbers (เลขอั้น/เลขเต็ม) */}
        <Card className="bg-[#1E293B]/80 border-[#334155]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              เลขอั้น / เลขเต็ม
              <Badge className="bg-red-500/20 text-red-400 ml-auto">
                {riskNumbers.filter(n => n.riskLevel === 'critical' || n.riskLevel === 'high').length} เลขเสี่ยง
              </Badge>
            </CardTitle>
            <CardDescription className="text-[#94A3B8]">
              ระบบ AI วิเคราะห์เลขที่มียอดแทงสูงผิดปกติ
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
            {riskNumbers.map((item) => (
              <div 
                key={item.number}
                className={`p-4 rounded-xl bg-[#0F172A] border ${getRiskBorderColor(item.riskLevel)} transition-all hover:scale-[1.02]`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`size-12 rounded-xl ${getRiskColor(item.riskLevel)} flex items-center justify-center`}>
                      <span className="text-xl font-bold text-white">{item.number}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">เลข {item.number}</p>
                        <Badge className={`${getRiskColor(item.riskLevel)} text-white text-xs`}>
                          {item.riskLevel === 'critical' ? 'วิกฤต' : 
                           item.riskLevel === 'high' ? 'สูง' : 
                           item.riskLevel === 'medium' ? 'ปานกลาง' : 'ต่ำ'}
                        </Badge>
                        {item.action === 'blocked' && (
                          <Badge className="bg-red-900 text-red-300">บล็อคแล้ว</Badge>
                        )}
                        {item.action === 'reduced' && (
                          <Badge className="bg-orange-900 text-orange-300">ลดเรท {item.adjustedRate}%</Badge>
                        )}
                      </div>
                      <p className="text-xs text-[#94A3B8] mt-1">
                        ยอดแทง: {item.totalBets.toLocaleString()} | ต้องจ่าย: {item.potentialPayout.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {item.action === 'blocked' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUnblockNumber(item.number)}
                        className="border-green-500 text-green-500 hover:bg-green-500/10"
                      >
                        <Unlock className="size-4 mr-1" />
                        ปลด
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBlockNumber(item.number)}
                        className="border-red-500 text-red-500 hover:bg-red-500/10"
                      >
                        <Ban className="size-4 mr-1" />
                        บล็อค
                      </Button>
                    )}
                  </div>
                </div>
                {/* Risk Progress Bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-[#94A3B8] mb-1">
                    <span>ระดับความเสี่ยง</span>
                    <span>{Math.min((item.totalBets / 150000) * 100, 100).toFixed(0)}%</span>
                  </div>
                  <Progress 
                    value={Math.min((item.totalBets / 150000) * 100, 100)} 
                    className={`h-2 ${
                      item.riskLevel === 'critical' ? '[&>div]:bg-red-500' :
                      item.riskLevel === 'high' ? '[&>div]:bg-orange-500' :
                      item.riskLevel === 'medium' ? '[&>div]:bg-yellow-500' :
                      '[&>div]:bg-green-500'
                    }`}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Link href="/master/agent-network">
          <Card className="bg-[#1E293B]/80 border-[#334155] hover:border-[#EAB308] transition-all cursor-pointer group">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] group-hover:shadow-lg group-hover:shadow-[#EAB308]/30 transition-all">
                <Users className="size-6 text-white" />
              </div>
              <div>
                <p className="font-medium text-white">Agent Network</p>
                <p className="text-xs text-[#94A3B8]">จัดการสายงาน</p>
              </div>
              <ChevronRight className="size-5 text-[#94A3B8] ml-auto group-hover:text-[#EAB308] transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/master/live-bets">
          <Card className="bg-[#1E293B]/80 border-[#334155] hover:border-[#EAB308] transition-all cursor-pointer group">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] group-hover:shadow-lg group-hover:shadow-[#EAB308]/30 transition-all">
                <Activity className="size-6 text-white" />
              </div>
              <div>
                <p className="font-medium text-white">Live Bets</p>
                <p className="text-xs text-[#94A3B8]">ยอดแทง Real-time</p>
              </div>
              <ChevronRight className="size-5 text-[#94A3B8] ml-auto group-hover:text-[#EAB308] transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/auto-system/settings">
          <Card className="bg-[#1E293B]/80 border-[#334155] hover:border-[#EAB308] transition-all cursor-pointer group">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] group-hover:shadow-lg group-hover:shadow-[#EAB308]/30 transition-all">
                <Settings className="size-6 text-white" />
              </div>
              <div>
                <p className="font-medium text-white">Auto Settings</p>
                <p className="text-xs text-[#94A3B8]">ตั้งค่าเรทจ่าย</p>
              </div>
              <ChevronRight className="size-5 text-[#94A3B8] ml-auto group-hover:text-[#EAB308] transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/activity-logs">
          <Card className="bg-[#1E293B]/80 border-[#334155] hover:border-[#EAB308] transition-all cursor-pointer group">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] group-hover:shadow-lg group-hover:shadow-[#EAB308]/30 transition-all">
                <BarChart3 className="size-6 text-white" />
              </div>
              <div>
                <p className="font-medium text-white">Activity Logs</p>
                <p className="text-xs text-[#94A3B8]">ประวัติการทำงาน</p>
              </div>
              <ChevronRight className="size-5 text-[#94A3B8] ml-auto group-hover:text-[#EAB308] transition-colors" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
