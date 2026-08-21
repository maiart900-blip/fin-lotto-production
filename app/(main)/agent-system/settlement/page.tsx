'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Send,
  RefreshCw,
  History,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Settlement {
  id: string;
  tenant_id: string;
  period_start: string;
  period_end: string;
  total_bets: number;
  total_wins: number;
  total_deposits: number;
  total_withdrawals: number;
  net_profit: number;
  commission_amount: number;
  settlement_amount: number;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
}

export default function SettlementPage() {
  // TODO: Get tenant_id from context or session
  const tenantId = 'current-tenant-id'; // Replace with actual tenant context
  
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ดึงยอดสรุปปัจจุบัน
  const { data: summary, mutate: mutateSummary } = useSWR(
    `/api/tenant/settlements?tenant_id=${tenantId}&action=summary`,
    fetcher,
    { refreshInterval: 30000 }
  );

  // ดึงประวัติการส่งยอด
  const { data: historyData, mutate: mutateHistory } = useSWR<{ settlements: Settlement[] }>(
    `/api/tenant/settlements?tenant_id=${tenantId}&action=history`,
    fetcher
  );

  const settlements = historyData?.settlements || [];

  const handleSubmitSettlement = async () => {
    if (!summary) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/tenant/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          period_start: summary.periodStart,
          period_end: summary.periodEnd,
          total_bets: summary.totalBets,
          total_wins: summary.totalWins,
          total_deposits: summary.totalDeposits,
          total_withdrawals: summary.totalWithdrawals,
          net_profit: summary.netProfit,
          commission_amount: summary.commission,
          settlement_amount: summary.settlementAmount,
          notes
        }),
      });

      const data = await res.json();
      
      if (res.ok) {
        toast.success('ส่งยอดสำเร็จ รอการอนุมัติจากเว็บกลาง');
        setShowSubmitDialog(false);
        setNotes('');
        mutateSummary();
        mutateHistory();
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการส่งยอด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-500"><Clock className="size-3 mr-1" />รอดำเนินการ</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-green-600 border-green-500"><CheckCircle className="size-3 mr-1" />อนุมัติแล้ว</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-red-600 border-red-500"><XCircle className="size-3 mr-1" />ปฏิเสธ</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Check if there's a pending settlement
  const hasPendingSettlement = settlements.some(s => s.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Send className="size-6 text-[#D4AF37]" />
            ส่งยอดเข้าเว็บกลาง
          </h1>
          <p className="text-muted-foreground">สรุปยอดและส่งเข้าระบบเว็บกลาง</p>
        </div>
        <Button variant="outline" onClick={() => { mutateSummary(); mutateHistory(); }}>
          <RefreshCw className="size-4 mr-2" />
          รีเฟรช
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ยอดแทงรวม</p>
                <p className="text-2xl font-bold text-green-600">
                  {(summary?.totalBets || 0).toLocaleString()}
                </p>
              </div>
              <TrendingUp className="size-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ยอดถูกรางวัล</p>
                <p className="text-2xl font-bold text-red-600">
                  {(summary?.totalWins || 0).toLocaleString()}
                </p>
              </div>
              <TrendingDown className="size-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">กำไรสุทธิ</p>
                <p className={`text-2xl font-bold ${(summary?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(summary?.netProfit || 0).toLocaleString()}
                </p>
              </div>
              <DollarSign className="size-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#D4AF37]/20 bg-[#D4AF37]/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ยอดที่ต้องส่ง</p>
                <p className="text-2xl font-bold text-[#D4AF37]">
                  {(summary?.settlementAmount || 0).toLocaleString()}
                </p>
              </div>
              <Send className="size-8 text-[#D4AF37]/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Summary */}
      <Card>
        <CardHeader>
          <CardTitle>รายละเอียดยอดปัจจุบัน</CardTitle>
          <CardDescription>
            ช่วงเวลา: {summary?.periodStart ? formatDate(summary.periodStart) : '-'} ถึง {summary?.periodEnd ? formatDate(summary.periodEnd) : '-'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">ยอดฝากรวม</span>
                <span className="font-medium text-green-600">+{(summary?.totalDeposits || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">ยอดถอนรวม</span>
                <span className="font-medium text-red-600">-{(summary?.totalWithdrawals || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">ยอดแทงรวม</span>
                <span className="font-medium">{(summary?.totalBets || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">ยอดถูกรางวัล</span>
                <span className="font-medium text-red-600">-{(summary?.totalWins || 0).toLocaleString()}</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">กำไรสุทธิ</span>
                <span className={`font-medium ${(summary?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(summary?.netProfit || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">ค่าคอมมิชชั่น (5%)</span>
                <span className="font-medium text-orange-600">-{(summary?.commission || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b bg-[#D4AF37]/10 px-2 rounded">
                <span className="font-semibold">ยอดที่ต้องส่งเข้าเว็บกลาง</span>
                <span className="font-bold text-[#D4AF37]">{(summary?.settlementAmount || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button 
              onClick={() => setShowSubmitDialog(true)}
              disabled={hasPendingSettlement || (summary?.settlementAmount || 0) <= 0}
              className="bg-[#D4AF37] hover:bg-[#B8972E] text-black"
            >
              <Send className="size-4 mr-2" />
              {hasPendingSettlement ? 'มียอดรอดำเนินการ' : 'ส่งยอดเข้าเว็บกลาง'}
            </Button>
          </div>

          {hasPendingSettlement && (
            <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
              <AlertCircle className="size-5 text-yellow-600" />
              <span className="text-sm text-yellow-600">มียอดที่รอการอนุมัติอยู่ กรุณารอให้เว็บกลางอนุมัติก่อนส่งยอดใหม่</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settlement History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-5" />
            ประวัติการส่งยอด
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วันที่ส่ง</TableHead>
                <TableHead>ช่วงเวลา</TableHead>
                <TableHead className="text-right">ยอดแทง</TableHead>
                <TableHead className="text-right">ยอดถูก</TableHead>
                <TableHead className="text-right">กำไร</TableHead>
                <TableHead className="text-right">ยอดส่ง</TableHead>
                <TableHead>สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    ยังไม่มีประวัติการส่งยอด
                  </TableCell>
                </TableRow>
              ) : (
                settlements.map((settlement) => (
                  <TableRow key={settlement.id}>
                    <TableCell>{formatDate(settlement.submitted_at)}</TableCell>
                    <TableCell className="text-xs">
                      {formatDate(settlement.period_start)} - {formatDate(settlement.period_end)}
                    </TableCell>
                    <TableCell className="text-right">{Number(settlement.total_bets).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-red-600">{Number(settlement.total_wins).toLocaleString()}</TableCell>
                    <TableCell className={`text-right ${Number(settlement.net_profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Number(settlement.net_profit).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium text-[#D4AF37]">
                      {Number(settlement.settlement_amount).toLocaleString()}
                    </TableCell>
                    <TableCell>{getStatusBadge(settlement.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Submit Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการส่งยอด</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/20">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">ยอดที่จะส่งเข้าเว็บกลาง</p>
                <p className="text-3xl font-bold text-[#D4AF37]">
                  {(summary?.settlementAmount || 0).toLocaleString()} บาท
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>หมายเหตุ (ถ้ามี)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="เพิ่มหมายเหตุ..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleSubmitSettlement} 
              disabled={isSubmitting}
              className="bg-[#D4AF37] hover:bg-[#B8972E] text-black"
            >
              {isSubmitting ? 'กำลังส่ง...' : 'ยืนยันส่งยอด'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
