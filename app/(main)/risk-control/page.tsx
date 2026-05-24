'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { 
  AlertTriangle, Shield, Ban, Play, TrendingUp, 
  AlertOctagon, Settings, Globe, Lock, Unlock,
  RefreshCw, History, Search, Bell, Zap, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface NumberStat {
  number: string;
  betType: string;
  totalBets: number;
  betCount: number;
  potentialPayout: number;
  profitLoss: number;
  riskLevel: 'normal' | 'risky' | 'danger';
  sources: {
    auto: number;
    manual_key: number;
  };
}

interface Summary {
  totalNumbers: number;
  totalBetsAmount: number;
  totalPotentialPayout: number;
  dangerCount: number;
  riskyCount: number;
  normalCount: number;
  autoTotal: number;
  manualKeyTotal: number;
}

interface Lottery {
  id: string;
  name: string;
}

export default function RiskControlPage() {
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);
  const [searchNumber, setSearchNumber] = useState('');
  
  // Filters
  const [selectedLottery, setSelectedLottery] = useState<string>('all');
  const [numberType, setNumberType] = useState<string>('all'); // 2, 3, all
  const [sourceType, setSourceType] = useState<string>('all'); // auto, manual_key, all
  const [drawDate, setDrawDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Build API URL with filters
  const buildApiUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedLottery && selectedLottery !== 'all') params.set('lottery_id', selectedLottery);
    if (numberType !== 'all') params.set('number_type', numberType);
    if (sourceType !== 'all') params.set('source_type', sourceType);
    params.set('draw_date', drawDate);
    return `/api/risk-control/numbers?${params.toString()}`;
  }, [selectedLottery, numberType, sourceType, drawDate]);
  
  // Fetch data
  const { data, mutate, isLoading } = useSWR(buildApiUrl(), fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
  });
  
  const numbers: NumberStat[] = data?.numbers || [];
  const summary: Summary = data?.summary || {
    totalNumbers: 0,
    totalBetsAmount: 0,
    totalPotentialPayout: 0,
    dangerCount: 0,
    riskyCount: 0,
    normalCount: 0,
    autoTotal: 0,
    manualKeyTotal: 0,
  };
  
  // Fetch lotteries for filter
  const { data: lotteriesData } = useSWR('/api/lotteries', fetcher);
  const lotteries: Lottery[] = lotteriesData || [];
  
  // Filter by search
  const filteredNumbers = numbers.filter(n => 
    searchNumber === '' || n.number.includes(searchNumber)
  );

  const handleEmergencyStop = () => {
    setIsEmergencyMode(true);
    setShowEmergencyDialog(false);
  };

  const handleResumeOperations = () => {
    setIsEmergencyMode(false);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'normal': return 'text-emerald-400 bg-emerald-500/20';
      case 'risky': return 'text-amber-400 bg-amber-500/20';
      case 'danger': return 'text-red-400 bg-red-500/20';
      default: return 'text-slate-400 bg-slate-500/20';
    }
  };
  
  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'normal': return 'ปกติ';
      case 'risky': return 'เสี่ยง';
      case 'danger': return 'อันตราย';
      default: return level;
    }
  };
  
  const formatNumber = (num: number) => {
    return num.toLocaleString('th-TH');
  };
  
  const getBetTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      '2top': '2 ตัวบน',
      '2bot': '2 ตัวล่าง',
      '3top': '3 ตัวบน',
      '3tod': '3 ตัวโต๊ด',
      '1top': 'วิ่งบน',
      '1bot': 'วิ่งล่าง',
    };
    return labels[type] || type;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 
            className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
            style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
          >
            ควบคุมความเสี่ยง
          </h1>
          <p className="text-slate-400 mt-1">วิเคราะห์ยอดแทงเลข - เรียงจากยอดมากไปน้อย</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={() => mutate()}
            variant="outline"
            className="border-amber-500/30 text-amber-400"
            disabled={isLoading}
          >
            <RefreshCw className={cn("size-4 mr-2", isLoading && "animate-spin")} />
            รีเฟรช
          </Button>
          
          {isEmergencyMode ? (
            <Button
              onClick={handleResumeOperations}
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white"
            >
              <Play className="size-4 mr-2" />
              Resume
            </Button>
          ) : (
            <Button
              onClick={() => setShowEmergencyDialog(true)}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white"
            >
              <AlertOctagon className="size-4 mr-2" />
              EMERGENCY STOP
            </Button>
          )}
        </div>
      </div>

      {/* Emergency Mode Banner */}
      {isEmergencyMode && (
        <div className="p-4 rounded-xl bg-red-900/50 border border-red-500/50 flex items-center gap-4">
          <AlertOctagon className="size-8 text-red-400 animate-pulse" />
          <div>
            <h3 className="text-lg font-bold text-red-300">EMERGENCY MODE ACTIVE</h3>
            <p className="text-red-400/80 text-sm">การรับแทงถูกระงับทุกเว็บในเครือ</p>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
                <TrendingUp className="size-6 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">ยอดแทงรวม</p>
                <p className="text-xl font-bold text-amber-300">{formatNumber(summary.totalBetsAmount)} ฿</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center">
                <Shield className="size-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">เลขทั้งหมด</p>
                <p className="text-xl font-bold text-emerald-400">{summary.totalNumbers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-orange-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex items-center justify-center">
                <AlertTriangle className="size-6 text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">เลขเสี่ยง</p>
                <p className="text-xl font-bold text-orange-400">{summary.riskyCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center">
                <AlertOctagon className="size-6 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">เลขอันตราย</p>
                <p className="text-xl font-bold text-red-400">{summary.dangerCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-black/40 backdrop-blur-xl border-slate-700">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Lottery Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">หวย:</span>
              <Select value={selectedLottery} onValueChange={setSelectedLottery}>
                <SelectTrigger className="w-40 bg-black/40 border-slate-700">
                  <SelectValue placeholder="เลือกหวย" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {lotteries.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">วันที่:</span>
              <Input
                type="date"
                value={drawDate}
                onChange={(e) => setDrawDate(e.target.value)}
                className="w-40 bg-black/40 border-slate-700"
              />
            </div>
            
            {/* Source Type Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">แหล่ง:</span>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger className="w-32 bg-black/40 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="auto">ออโต้</SelectItem>
                  <SelectItem value="manual_key">คีย์หวย</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                <Input
                  placeholder="ค้นหาเลข..."
                  value={searchNumber}
                  onChange={(e) => setSearchNumber(e.target.value)}
                  className="pl-10 bg-black/40 border-slate-700"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Number Type Tabs */}
      <Tabs defaultValue="all" value={numberType} onValueChange={setNumberType}>
        <TabsList className="bg-black/40 border border-slate-700">
          <TabsTrigger value="all" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">
            ทั้งหมด
          </TabsTrigger>
          <TabsTrigger value="2" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">
            เลข 2 ตัว
          </TabsTrigger>
          <TabsTrigger value="3" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">
            เลข 3 ตัว
          </TabsTrigger>
        </TabsList>

        <TabsContent value={numberType} className="mt-4">
          {/* Numbers Table */}
          <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-amber-300 flex items-center gap-2">
                  <Shield className="size-5" />
                  เลขที่มียอดแทงสูง (เรียงจากมากไปน้อย)
                </CardTitle>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-slate-400">
                    ออโต้: <span className="text-cyan-400 font-bold">{formatNumber(summary.autoTotal)} ฿</span>
                  </span>
                  <span className="text-slate-400">
                    คีย์หวย: <span className="text-amber-400 font-bold">{formatNumber(summary.manualKeyTotal)} ฿</span>
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="size-8 text-amber-400 animate-spin" />
                </div>
              ) : filteredNumbers.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Shield className="size-12 mx-auto mb-4 opacity-50" />
                  <p>ไม่พบข้อมูลเลขที่มียอดแทง</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-400 w-16">อันดับ</TableHead>
                        <TableHead className="text-slate-400">เลข</TableHead>
                        <TableHead className="text-slate-400">ประเภท</TableHead>
                        <TableHead className="text-slate-400 text-right">จำนวนโพย</TableHead>
                        <TableHead className="text-slate-400 text-right">ยอดรับ</TableHead>
                        <TableHead className="text-slate-400 text-right">จ่ายถ้าถูก</TableHead>
                        <TableHead className="text-slate-400 text-right">กำไร/ขาดทุน</TableHead>
                        <TableHead className="text-slate-400 text-center">ความเสี่ยง</TableHead>
                        <TableHead className="text-slate-400 text-center">แหล่ง</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredNumbers.map((num, index) => (
                        <TableRow 
                          key={`${num.number}_${num.betType}`} 
                          className={cn(
                            "border-slate-700/50 transition-colors",
                            num.riskLevel === 'danger' && "bg-red-900/20",
                            num.riskLevel === 'risky' && "bg-orange-900/20"
                          )}
                        >
                          <TableCell className="font-mono text-slate-500">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            <div className={cn(
                              "inline-flex items-center justify-center size-12 rounded-lg text-xl font-bold",
                              num.riskLevel === 'danger' ? "bg-red-500/20 text-red-300" :
                              num.riskLevel === 'risky' ? "bg-orange-500/20 text-orange-300" :
                              "bg-amber-500/20 text-amber-300"
                            )}>
                              {num.number}
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-300">
                            {getBetTypeLabel(num.betType)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-300">
                            {num.betCount}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-amber-300">
                            {formatNumber(num.totalBets)} ฿
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-400">
                            {formatNumber(num.potentialPayout)} ฿
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-mono font-bold",
                            num.profitLoss >= 0 ? "text-emerald-400" : "text-red-400"
                          )}>
                            {num.profitLoss >= 0 ? '+' : ''}{formatNumber(num.profitLoss)} ฿
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={getRiskColor(num.riskLevel)}>
                              {getRiskLabel(num.riskLevel)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2 text-xs">
                              {num.sources.auto > 0 && (
                                <span className="text-cyan-400">
                                  A:{formatNumber(num.sources.auto)}
                                </span>
                              )}
                              {num.sources.manual_key > 0 && (
                                <span className="text-amber-400">
                                  K:{formatNumber(num.sources.manual_key)}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Auto-Lock Settings */}
      <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30">
        <CardHeader>
          <CardTitle className="text-amber-300 flex items-center gap-2">
            <Zap className="size-5" />
            ระบบอั้นอัตโนมัติ (Auto-Lock)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-xl bg-black/30 border border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium">อั้นเมื่อถึงเพดาน</span>
                <Switch defaultChecked />
              </div>
              <p className="text-sm text-slate-400">
                ล็อคเลขอัตโนมัติเมื่อยอดแทงถึงระดับ &quot;อันตราย&quot;
              </p>
            </div>
            
            <div className="p-4 rounded-xl bg-black/30 border border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium">แจ้งเตือนเลขเสี่ยง</span>
                <Switch defaultChecked />
              </div>
              <p className="text-sm text-slate-400">
                ส่งการแจ้งเตือนเมื่อเลขถึงระดับ &quot;เสี่ยง&quot;
              </p>
            </div>
            
            <div className="p-4 rounded-xl bg-black/30 border border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium">รวมทุกแหล่ง</span>
                <Switch defaultChecked />
              </div>
              <p className="text-sm text-slate-400">
                รวมยอดจากทั้งออโต้และคีย์หวยในการคำนวณ
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Stop Dialog */}
      <Dialog open={showEmergencyDialog} onOpenChange={setShowEmergencyDialog}>
        <DialogContent className="bg-[#0a0f1a] border-red-500/50">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <AlertOctagon className="size-6" />
              ยืนยันการหยุดฉุกเฉิน
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              การกดปุ่มนี้จะ <span className="text-red-400 font-bold">ปิดการรับแทงทันที</span>
              <br /><br />
              สมาชิกจะไม่สามารถแทงหวยได้จนกว่าคุณจะกด Resume
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEmergencyDialog(false)}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleEmergencyStop}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <AlertOctagon className="size-4 mr-2" />
              ยืนยัน EMERGENCY STOP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
