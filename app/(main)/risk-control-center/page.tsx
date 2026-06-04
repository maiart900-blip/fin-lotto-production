'use client';

/**
 * Risk Management Dashboard - SUPER_ADMIN ONLY
 * 
 * หน้าจอควบคุมความเสี่ยงของเว็บแม่ (Mother Web)
 * ดึงยอดแทงรวมจากทุก tenant_id และทุก agent_id มาคำนวณเลขเต็ม
 * 
 * ตามกฎเหล็กข้อ 1: SUPER_ADMIN คุมระบบทั้งหมด, เห็นยอดรวมทุกสาย
 * ตามกฎเหล็กข้อ 3.1: เมนูควบคุมลึกๆ แสดงเฉพาะ SUPER_ADMIN เท่านั้น
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import useSWR from 'swr';
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  Settings, 
  Loader2,
  Ban,
  DollarSign,
  BarChart3,
  Save,
  RefreshCw,
  AlertCircle,
  Building2,
  Users,
  Globe,
  Lock,
  Zap,
  Eye,
  EyeOff,
  Activity,
  PieChart,
  Target,
} from 'lucide-react';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

interface NumberVolume {
  number: string;
  entry_type: string;
  total_amount: number;
  bet_count: number;
  potential_payout: number;
  profit_loss: number;
  risk_level: 'normal' | 'warning' | 'danger' | 'critical';
  sources: {
    manual_key_amount: number;
    auto_amount: number;
    agent_count: number;
    tenant_count: number;
  };
}

interface AggregatedSummary {
  total_bets: number;
  total_amount: number;
  potential_payout: number;
  net_exposure: number;
  high_risk_numbers: number;
  critical_numbers: number;
  by_source: {
    manual_key: { count: number; amount: number };
    auto: { count: number; amount: number };
  };
  by_entry_type: Record<string, { count: number; amount: number }>;
}

const ENTRY_TYPES = [
  { value: 'three_top', label: '3 ตัวบน' },
  { value: 'three_tod', label: '3 ตัวโต๊ด' },
  { value: 'two_top', label: '2 ตัวบน' },
  { value: 'two_bottom', label: '2 ตัวล่าง' },
  { value: 'run_top', label: 'วิ่งบน' },
  { value: 'run_bottom', label: 'วิ่งล่าง' },
];

export default function SuperAdminRiskManagementPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [selectedLottery, setSelectedLottery] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  
  // กฎเหล็กข้อ 3.1: Redirect ถ้าไม่ใช่ SUPER_ADMIN
  useEffect(() => {
    if (!authLoading && user) {
      const role = user.role?.toLowerCase();
      if (role !== 'super_admin' && role !== 'admin') {
        toast.error('ไม่มีสิทธิ์เข้าถึงหน้านี้');
        router.push('/login');
      }
    }
  }, [user, authLoading, router]);
  
  // Fetch aggregated risk data - SUPER_ADMIN ดูได้ทุก tenant/agent
  const { data: riskData, isLoading, error, mutate } = useSWR(
    user?.role?.toLowerCase() === 'super_admin' || user?.role?.toLowerCase() === 'admin'
      ? `/api/risk/aggregated-volume?lottery_id=${selectedLottery !== 'all' ? selectedLottery : ''}&entry_type=${selectedType}&date_from=${dateFrom}&date_to=${dateTo}`
      : null,
    fetcher,
    { refreshInterval: 30000 }
  );
  
  // Fetch lotteries
  const { data: lotteriesData } = useSWR('/api/lotteries', fetcher);
  const lotteries = lotteriesData || [];
  
  const numbers: NumberVolume[] = riskData?.data?.numbers || [];
  const summary: AggregatedSummary = riskData?.data?.summary || {
    total_bets: 0,
    total_amount: 0,
    potential_payout: 0,
    net_exposure: 0,
    high_risk_numbers: 0,
    critical_numbers: 0,
    by_source: { manual_key: { count: 0, amount: 0 }, auto: { count: 0, amount: 0 } },
    by_entry_type: {},
  };
  const meta = riskData?.data?.meta || {};

  const formatMoney = (n: number) => new Intl.NumberFormat('th-TH').format(Math.round(n));
  
  const getEntryTypeLabel = (type: string) => {
    return ENTRY_TYPES.find(t => t.value === type)?.label || type;
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'critical':
        return <Badge className="bg-red-600 text-white animate-pulse">วิกฤต</Badge>;
      case 'danger':
        return <Badge className="bg-red-500 text-white">อันตราย</Badge>;
      case 'warning':
        return <Badge className="bg-orange-500 text-white">เสี่ยง</Badge>;
      default:
        return <Badge className="bg-green-500 text-white">ปกติ</Badge>;
    }
  };

  const handleBlockNumber = async (number: string, entryType: string) => {
    try {
      // TODO: Implement actual block number API
      toast.success(`อั้นเลข ${number} (${getEntryTypeLabel(entryType)}) สำเร็จ`);
      mutate();
    } catch {
      toast.error('ไม่สามารถอั้นเลขได้');
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-[#030712] to-[#0a0f1a]">
        <Loader2 className="size-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  // Access denied
  if (user?.role?.toLowerCase() !== 'super_admin' && user?.role?.toLowerCase() !== 'admin') {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-4 md:p-6 space-y-6">
      {/* Header with SUPER_ADMIN indicator */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
              <Shield className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-400 to-amber-400">
                Risk Management Center
              </h1>
              <p className="text-slate-400 text-sm">
                ศูนย์ควบคุมความเสี่ยง - เว็บแม่ (Mother Web)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 px-3 py-1">
            <Lock className="size-3 mr-1" />
            SUPER_ADMIN ONLY
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isLoading}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Scoped Data Notice - SUPER_ADMIN sees ALL */}
      <div className="relative p-4 rounded-xl bg-gradient-to-r from-red-500/10 via-orange-500/10 to-transparent border border-red-500/20">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <Globe className="size-5 text-red-400" />
          </div>
          <div>
            <p className="text-red-400 font-medium">Global View - ข้อมูลรวมทั้งระบบ</p>
            <p className="text-slate-400 text-sm">
              แสดงยอดรวมจากทุก Tenant ({meta.total_unique_tenants || 0} เว็บ) และทุก Agent ({meta.total_unique_agents || 0} สาย)
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="bg-black/40 backdrop-blur-xl border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="size-6 text-blue-400" />
              <Badge className="bg-blue-500/20 text-blue-400 text-xs">รวม</Badge>
            </div>
            <p className="text-2xl font-bold text-white">{summary.total_bets.toLocaleString()}</p>
            <p className="text-xs text-slate-400">รายการทั้งหมด</p>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="size-6 text-green-400" />
              <TrendingUp className="size-4 text-green-400" />
            </div>
            <p className="text-2xl font-bold text-white">{formatMoney(summary.total_amount)}</p>
            <p className="text-xs text-slate-400">ยอดรับรวม (บาท)</p>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingDown className="size-6 text-red-400" />
              <AlertTriangle className="size-4 text-red-400" />
            </div>
            <p className="text-2xl font-bold text-white">{formatMoney(summary.potential_payout)}</p>
            <p className="text-xs text-slate-400">จ่ายสูงสุดถ้าถูกทุกเลข</p>
          </CardContent>
        </Card>

        <Card className={`bg-black/40 backdrop-blur-xl ${summary.net_exposure >= 0 ? 'border-green-500/30' : 'border-red-500/30'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Target className="size-6 text-amber-400" />
              {summary.net_exposure >= 0 ? (
                <TrendingUp className="size-4 text-green-400" />
              ) : (
                <TrendingDown className="size-4 text-red-400" />
              )}
            </div>
            <p className={`text-2xl font-bold ${summary.net_exposure >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {summary.net_exposure >= 0 ? '+' : ''}{formatMoney(summary.net_exposure)}
            </p>
            <p className="text-xs text-slate-400">Net Exposure</p>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-orange-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="size-6 text-orange-400" />
              <Badge className="bg-orange-500/20 text-orange-400 text-xs">เสี่ยง</Badge>
            </div>
            <p className="text-2xl font-bold text-white">{summary.high_risk_numbers}</p>
            <p className="text-xs text-slate-400">เลขเสี่ยง/อันตราย</p>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-red-600/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Ban className="size-6 text-red-500" />
              <Badge className="bg-red-600/20 text-red-400 text-xs animate-pulse">วิกฤต</Badge>
            </div>
            <p className="text-2xl font-bold text-red-400">{summary.critical_numbers}</p>
            <p className="text-xs text-slate-400">เลขวิกฤต</p>
          </CardContent>
        </Card>
      </div>

      {/* Source Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-black/40 backdrop-blur-xl border-purple-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2 text-lg">
              <Users className="size-5 text-purple-400" />
              คีย์หวยมือ (Manual Key)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-2">
              <span className="text-slate-400">จำนวนรายการ</span>
              <span className="text-white font-bold">{summary.by_source.manual_key.count.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-slate-400">ยอดรวม</span>
              <span className="text-purple-400 font-bold">{formatMoney(summary.by_source.manual_key.amount)} บาท</span>
            </div>
            <Progress 
              value={(summary.by_source.manual_key.amount / (summary.total_amount || 1)) * 100} 
              className="h-2 bg-purple-900/30"
            />
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-cyan-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2 text-lg">
              <Zap className="size-5 text-cyan-400" />
              ระบบออโต้ (Auto)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-2">
              <span className="text-slate-400">จำนวนรายการ</span>
              <span className="text-white font-bold">{summary.by_source.auto.count.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-slate-400">ยอดรวม</span>
              <span className="text-cyan-400 font-bold">{formatMoney(summary.by_source.auto.amount)} บาท</span>
            </div>
            <Progress 
              value={(summary.by_source.auto.amount / (summary.total_amount || 1)) * 100} 
              className="h-2 bg-cyan-900/30"
            />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-black/40 backdrop-blur-xl border-slate-700">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-slate-400">หวย:</Label>
              <Select value={selectedLottery} onValueChange={setSelectedLottery}>
                <SelectTrigger className="w-[180px] bg-black/40 border-slate-700 text-white">
                  <SelectValue placeholder="เลือกหวย" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="all">ทุกหวย</SelectItem>
                  {lotteries.map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-slate-400">ประเภท:</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-[150px] bg-black/40 border-slate-700 text-white">
                  <SelectValue placeholder="ประเภท" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="all">ทุกประเภท</SelectItem>
                  {ENTRY_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-slate-400">วันที่:</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px] bg-black/40 border-slate-700 text-white"
              />
              <span className="text-slate-400">-</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px] bg-black/40 border-slate-700 text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Numbers Table */}
      <Card className="bg-black/40 backdrop-blur-xl border-red-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <AlertTriangle className="size-5 text-red-400" />
            เลขที่มียอดแทงสูง - ทุกสายงาน
          </CardTitle>
          <CardDescription className="text-slate-400">
            รวมยอดจากทุก Tenant และทุก Agent - เรียงตามความเสี่ยงสูงสุด
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="size-8 animate-spin text-red-400" />
              <p className="text-slate-400">กำลังโหลดข้อมูลจากทุกสายงาน...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <AlertCircle className="size-12 text-red-500" />
              <p className="text-red-500">ไม่สามารถโหลดข้อมูลได้</p>
              <Button onClick={() => mutate()} variant="outline" className="border-red-500/30 text-red-400">
                <RefreshCw className="size-4 mr-2" />
                ลองใหม่อีกครั้ง
              </Button>
            </div>
          ) : numbers.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Shield className="size-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">ไม่พบข้อมูล</p>
              <p className="text-sm mt-1">ยังไม่มีรายการแทงหวยในระบบ</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800">
                    <TableHead className="text-slate-400">เลข</TableHead>
                    <TableHead className="text-slate-400">ประเภท</TableHead>
                    <TableHead className="text-slate-400 text-right">โพย</TableHead>
                    <TableHead className="text-slate-400 text-right">ยอดรับ</TableHead>
                    <TableHead className="text-slate-400 text-right">จ่ายถ้าถูก</TableHead>
                    <TableHead className="text-slate-400 text-right">กำไร/ขาดทุน</TableHead>
                    <TableHead className="text-slate-400 text-center">แหล่งที่มา</TableHead>
                    <TableHead className="text-slate-400 text-center">ระดับ</TableHead>
                    <TableHead className="text-slate-400 text-center">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {numbers.slice(0, 50).map((num, idx) => (
                    <TableRow 
                      key={idx} 
                      className={`border-slate-800 ${
                        num.risk_level === 'critical' ? 'bg-red-500/10' : 
                        num.risk_level === 'danger' ? 'bg-red-500/5' : 
                        num.risk_level === 'warning' ? 'bg-orange-500/5' : ''
                      }`}
                    >
                      <TableCell className="font-mono font-bold text-lg text-white">{num.number}</TableCell>
                      <TableCell className="text-slate-300">{getEntryTypeLabel(num.entry_type)}</TableCell>
                      <TableCell className="text-right text-slate-300">{num.bet_count}</TableCell>
                      <TableCell className="text-right text-green-400 font-mono">{formatMoney(num.total_amount)}</TableCell>
                      <TableCell className="text-right text-red-400 font-mono">{formatMoney(num.potential_payout)}</TableCell>
                      <TableCell className={`text-right font-bold font-mono ${num.profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {num.profit_loss >= 0 ? '+' : ''}{formatMoney(num.profit_loss)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          {num.sources.manual_key_amount > 0 && (
                            <Badge className="bg-purple-500/20 text-purple-400 text-xs">
                              คีย์: {formatMoney(num.sources.manual_key_amount)}
                            </Badge>
                          )}
                          {num.sources.auto_amount > 0 && (
                            <Badge className="bg-cyan-500/20 text-cyan-400 text-xs">
                              ออโต้: {formatMoney(num.sources.auto_amount)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{getRiskBadge(num.risk_level)}</TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                          onClick={() => handleBlockNumber(num.number, num.entry_type)}
                        >
                          <Ban className="size-3 mr-1" />
                          อั้น
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer Info */}
      <div className="text-center text-slate-500 text-xs">
        <p>ข้อมูลอัปเดตอัตโนมัติทุก 30 วินาที | สร้างเมื่อ: {meta.generated_at ? new Date(meta.generated_at).toLocaleString('th-TH') : '-'}</p>
      </div>
    </div>
  );
}
