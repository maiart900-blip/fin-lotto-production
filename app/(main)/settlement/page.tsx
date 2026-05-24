'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { 
  Calculator, Download, FileText, Check, Clock,
  TrendingUp, TrendingDown, DollarSign, Percent,
  Building, CreditCard, History, Filter, RefreshCw,
  ArrowUpRight, ArrowDownRight, Wallet, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Settlement {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  isActive: boolean;
  period: string;
  totalBets: number;
  totalPayouts: number;
  totalDeposits: number;
  totalWithdrawals: number;
  grossProfit: number;
  depositFeePercent: number;
  withdrawFeePercent: number;
  depositFee: number;
  withdrawFee: number;
  platformFee: number;
  netAmount: number;
  status: 'pending' | 'calculating' | 'ready' | 'settled';
  settledAt?: string;
  settledBy?: string;
}

export default function SettlementPage() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedPeriod, setSelectedPeriod] = useState(currentMonth);
  const [showSettleDialog, setShowSettleDialog] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Settlement | null>(null);
  const [isSettling, setIsSettling] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<{
    settlements: Settlement[];
    summary: {
      totalBets: number;
      totalPayouts: number;
      totalDeposits: number;
      totalWithdrawals: number;
      totalPlatformFee: number;
      totalGrossProfit: number;
      pendingCount: number;
    };
    period: string;
  }>(`/api/settlement?period=${selectedPeriod}`, fetcher);

  const settlements = data?.settlements || [];
  const summary = data?.summary || {
    totalBets: 0, totalPayouts: 0, totalDeposits: 0, totalWithdrawals: 0,
    totalPlatformFee: 0, totalGrossProfit: 0, pendingCount: 0
  };

  const formatMoney = (amount: number) => {
    if (Math.abs(amount) >= 1000000) {
      return `${(amount / 1000000).toFixed(2)}M`;
    }
    return amount.toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-slate-500/20 text-slate-400">รอคำนวณ</Badge>;
      case 'calculating':
        return <Badge className="bg-blue-500/20 text-blue-400">กำลังคำนวณ</Badge>;
      case 'ready':
        return <Badge className="bg-amber-500/20 text-amber-400">พร้อมเคลียร์</Badge>;
      case 'settled':
        return <Badge className="bg-emerald-500/20 text-emerald-400">เคลียร์แล้ว</Badge>;
      default:
        return null;
    }
  };

  const handleSettle = async () => {
    if (!selectedSite) return;
    
    setIsSettling(true);
    try {
      const res = await fetch('/api/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: selectedSite.tenantId,
          period: selectedSite.period,
          amount: selectedSite.platformFee,
          settledBy: 'Admin',
        }),
      });

      if (!res.ok) throw new Error('Settlement failed');

      toast.success(`เคลียร์ยอด ${selectedSite.tenantName} สำเร็จ`);
      setShowSettleDialog(false);
      setSelectedSite(null);
      mutate();
    } catch {
      toast.error('เกิดข้อผิดพลาดในการเคลียร์ยอด');
    } finally {
      setIsSettling(false);
    }
  };

  // Generate period options (last 12 months)
  const periodOptions = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const value = date.toISOString().slice(0, 7);
    const label = date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' });
    return { value, label };
  });

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6 flex items-center justify-center">
        <Card className="bg-red-500/10 border-red-500/30 p-6 text-center">
          <AlertCircle className="size-12 mx-auto text-red-400 mb-4" />
          <p className="text-red-400">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
          <Button onClick={() => mutate()} className="mt-4">ลองใหม่</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 
            className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
            style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
          >
            Financial Settlement
          </h1>
          <p className="text-slate-400 mt-1">ระบบเคลียร์ยอดและค่าธรรมเนียมเว็บลูก</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[200px] bg-black/40 border-slate-700">
              <SelectValue placeholder="เลือกงวด" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            className="border-slate-600"
            onClick={() => mutate()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("size-4 mr-2", isLoading && "animate-spin")} />
            รีเฟรช
          </Button>
          
          <Button variant="outline" className="border-amber-500/30 text-amber-400">
            <Download className="size-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* No Sub-Sites Notice */}
      {settlements.length === 0 && !isLoading && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-6 text-center">
            <Building className="size-12 mx-auto text-amber-400/50 mb-4" />
            <h3 className="text-lg font-medium text-amber-300 mb-2">ยังไม่มีเว็บลูกในระบบ</h3>
            <p className="text-slate-400">
              เมื่อคุณเพิ่มเว็บลูกแล้ว ข้อมูลค่าธรรมเนียมจะแสดงที่นี่
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
                <Building className="size-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">เว็บลูก</p>
                <p className="text-xl font-bold text-amber-300">{settlements.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center">
                <ArrowDownRight className="size-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">ยอดฝากรวม</p>
                <p className="text-lg font-bold text-emerald-400">{formatMoney(summary.totalDeposits)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center">
                <ArrowUpRight className="size-5 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">ยอดถอนรวม</p>
                <p className="text-lg font-bold text-red-400">{formatMoney(summary.totalWithdrawals)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center">
                <Percent className="size-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">ค่าธรรมเนียมรวม</p>
                <p className="text-lg font-bold text-purple-400">{formatMoney(summary.totalPlatformFee)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center">
                <TrendingUp className="size-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">กำไรสุทธิรวม</p>
                <p className={cn(
                  "text-lg font-bold",
                  summary.totalGrossProfit >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {summary.totalGrossProfit >= 0 ? '+' : ''}{formatMoney(summary.totalGrossProfit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-orange-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex items-center justify-center">
                <Clock className="size-5 text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">รอเคลียร์</p>
                <p className="text-xl font-bold text-orange-400">{summary.pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settlement Table */}
      {settlements.length > 0 && (
        <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-amber-300 flex items-center gap-2">
                <Calculator className="size-5" />
                รายละเอียดค่าธรรมเนียมเว็บลูก
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="border-slate-600">
                  <Filter className="size-4 mr-1" />
                  กรอง
                </Button>
                <Button size="sm" variant="outline" className="border-slate-600">
                  <History className="size-4 mr-1" />
                  ประวัติ
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">เว็บลูก</TableHead>
                    <TableHead className="text-slate-400 text-right">ยอดฝาก</TableHead>
                    <TableHead className="text-slate-400 text-right">ค่าฝาก (%)</TableHead>
                    <TableHead className="text-slate-400 text-right">ยอดถอน</TableHead>
                    <TableHead className="text-slate-400 text-right">ค่าถอน (%)</TableHead>
                    <TableHead className="text-slate-400 text-right">ค่าธรรมเนียมรวม</TableHead>
                    <TableHead className="text-slate-400 text-center">สถานะ</TableHead>
                    <TableHead className="text-slate-400 text-center">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.map((site) => (
                    <TableRow key={site.tenantId} className="border-slate-700/50 hover:bg-white/5">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
                            <Building className="size-5 text-amber-400" />
                          </div>
                          <div>
                            <p className="font-medium text-white">{site.tenantName}</p>
                            <p className="text-xs text-slate-500">{site.tenantSlug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-400">
                        +{site.totalDeposits.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <span className="font-mono text-purple-400">
                            {site.depositFee.toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-500 ml-1">
                            ({site.depositFeePercent}%)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-400">
                        -{site.totalWithdrawals.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <span className="font-mono text-purple-400">
                            {site.withdrawFee.toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-500 ml-1">
                            ({site.withdrawFeePercent}%)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-amber-300">
                        {site.platformFee.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(site.status)}
                      </TableCell>
                      <TableCell className="text-center">
                        {site.status === 'settled' ? (
                          <Button size="sm" variant="outline" className="border-slate-600">
                            <FileText className="size-4 mr-1" />
                            ดูใบเสร็จ
                          </Button>
                        ) : site.platformFee > 0 ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedSite(site);
                              setShowSettleDialog(true);
                            }}
                            className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600"
                          >
                            <Check className="size-4 mr-1" />
                            เคลียร์
                          </Button>
                        ) : (
                          <span className="text-slate-500 text-sm">ไม่มียอด</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fee Info Card */}
      <Card className="bg-black/40 backdrop-blur-xl border-blue-500/30">
        <CardHeader>
          <CardTitle className="text-blue-300 flex items-center gap-2">
            <Wallet className="size-5" />
            ค่าธรรมเนียม Payment Gateway
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center gap-3 mb-3">
                <ArrowDownRight className="size-6 text-emerald-400" />
                <span className="text-emerald-300 font-medium">ค่าธรรมเนียมฝากเงิน</span>
              </div>
              <p className="text-slate-400 text-sm">
                เว็บแม่เก็บค่าธรรมเนียมจากยอดฝากของเว็บลูก ตามเปอร์เซ็นต์ที่ตั้งไว้ในแต่ละเว็บลูก
              </p>
              <p className="text-xs text-slate-500 mt-2">
                ค่าเริ่มต้น: 1.5% ของยอดฝาก
              </p>
            </div>
            
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
              <div className="flex items-center gap-3 mb-3">
                <ArrowUpRight className="size-6 text-red-400" />
                <span className="text-red-300 font-medium">ค่าธรรมเนียมถอนเงิน</span>
              </div>
              <p className="text-slate-400 text-sm">
                เว็บแม่เก็บค่าธรรมเนียมจากยอดถอนของเว็บลูก ตามเปอร์เซ็นต์ที่ตั้งไว้ในแต่ละเว็บลูก
              </p>
              <p className="text-xs text-slate-500 mt-2">
                ค่าเริ่มต้น: 1.0% ของยอดถอน
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settlement Dialog */}
      <Dialog open={showSettleDialog} onOpenChange={setShowSettleDialog}>
        <DialogContent className="bg-[#0a0f1a] border-amber-500/30 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-amber-300 flex items-center gap-2">
              <CreditCard className="size-5" />
              ยืนยันการเคลียร์ยอด
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              กรุณาตรวจสอบรายละเอียดก่อนทำการเคลียร์ยอด
            </DialogDescription>
          </DialogHeader>
          
          {selectedSite && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-black/40 border border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
                    <Building className="size-6 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-lg">{selectedSite.tenantName}</p>
                    <p className="text-sm text-slate-400">งวด: {selectedSite.period}</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">ยอดฝากรวม</span>
                    <span className="font-mono text-emerald-400">
                      +{selectedSite.totalDeposits.toLocaleString()} บาท
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ค่าฝาก ({selectedSite.depositFeePercent}%)</span>
                    <span className="font-mono text-purple-400">
                      {selectedSite.depositFee.toLocaleString()} บาท
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ยอดถอนรวม</span>
                    <span className="font-mono text-red-400">
                      -{selectedSite.totalWithdrawals.toLocaleString()} บาท
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ค่าถอน ({selectedSite.withdrawFeePercent}%)</span>
                    <span className="font-mono text-purple-400">
                      {selectedSite.withdrawFee.toLocaleString()} บาท
                    </span>
                  </div>
                  <div className="h-px bg-slate-700" />
                  <div className="flex justify-between text-lg">
                    <span className="text-white font-medium">ค่าธรรมเนียมรวม</span>
                    <span className="font-mono font-bold text-amber-300">
                      {selectedSite.platformFee.toLocaleString()} บาท
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSettleDialog(false)}
              className="border-slate-600"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleSettle}
              disabled={isSettling}
              className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600"
            >
              {isSettling ? (
                <>
                  <RefreshCw className="size-4 mr-2 animate-spin" />
                  กำลังเคลียร์...
                </>
              ) : (
                <>
                  <Check className="size-4 mr-2" />
                  ยืนยันเคลียร์ยอด
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
