'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  ArrowUpRight,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  History,
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());
const MOCK_AGENT_ID = '7cf23d72-858d-4395-9b94-67e7a7ca821f';

export default function AgentSettlementPage() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ดึงข้อมูลยอดส่ง
  const { data: settlementData, isLoading } = useSWR(
    `/api/agent/settlement?agent_id=${MOCK_AGENT_ID}&period=${period}`,
    fetcher
  );

  const agent = settlementData?.agent || {};
  const summary = settlementData?.summary || {};
  const periodInfo = settlementData?.period || {};
  const settlements = settlementData?.settlements || [];

  const handleSubmitSettlement = async () => {
    if (summary.master_share <= 0) {
      toast.error('ไม่มียอดที่ต้องส่ง');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/agent/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: MOCK_AGENT_ID,
          amount: summary.master_share,
          period_start: periodInfo.start_date,
          period_end: periodInfo.end_date,
          note,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('บันทึกการส่งยอดสำเร็จ');
        setIsDialogOpen(false);
        setNote('');
        mutate(`/api/agent/settlement?agent_id=${MOCK_AGENT_ID}&period=${period}`);
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="size-3 mr-1" />จ่ายแล้ว</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="size-3 mr-1" />รอตรวจสอบ</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="size-3 mr-1" />ยกเลิก</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f5f0] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-amber-600">ส่งยอดเว็บกลาง</h1>
            <p className="text-muted-foreground">สรุปยอดที่ต้องส่งให้เว็บกลาง</p>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2 mb-6">
          {(['daily', 'weekly', 'monthly'] as const).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'outline'}
              onClick={() => setPeriod(p)}
              className={period === p ? 'bg-amber-500 hover:bg-amber-600' : ''}
            >
              {p === 'daily' ? 'รายวัน' : p === 'weekly' ? 'รายสัปดาห์' : 'รายเดือน'}
            </Button>
          ))}
        </div>

        {/* Summary Card */}
        <Card className="mb-6 bg-[#0D1321] text-white border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-amber-400">
              สรุปยอด{period === 'daily' ? 'วันนี้' : period === 'weekly' ? 'สัปดาห์นี้' : 'เดือนนี้'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-white/60 text-sm">ยอดขายรวม</p>
                <p className="text-xl font-bold">{(summary.total_amount || 0).toLocaleString()} บ.</p>
              </div>
              <div>
                <p className="text-white/60 text-sm">จ่ายรางวัล</p>
                <p className="text-xl font-bold text-red-400">-{(summary.total_payout || 0).toLocaleString()} บ.</p>
              </div>
              <div>
                <p className="text-white/60 text-sm">กำไรสุทธิ</p>
                <p className={`text-xl font-bold ${summary.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(summary.profit || 0).toLocaleString()} บ.
                </p>
              </div>
              <div>
                <p className="text-white/60 text-sm">ส่วนของคุณ ({agent.share_percent || 90}%)</p>
                <p className="text-xl font-bold text-green-400">{(summary.agent_share || 0).toLocaleString()} บ.</p>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">ยอดที่ต้องส่งเว็บกลาง ({agent.master_share_percent || 10}%)</p>
                  <p className="text-3xl font-bold text-orange-400">{(summary.master_share || 0).toLocaleString()} บาท</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                      disabled={summary.master_share <= 0}
                    >
                      <Send className="size-4 mr-2" />
                      ส่งยอด
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>ยืนยันการส่งยอด</DialogTitle>
                      <DialogDescription>
                        คุณกำลังจะส่งยอด {(summary.master_share || 0).toLocaleString()} บาท ให้เว็บกลาง
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-muted-foreground">หมายเหตุ (ถ้ามี)</label>
                        <Textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="หมายเหตุเพิ่มเติม..."
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>ยกเลิก</Button>
                      <Button 
                        onClick={handleSubmitSettlement}
                        disabled={isSubmitting}
                        className="bg-orange-500 hover:bg-orange-600"
                      >
                        {isSubmitting ? 'กำลังส่ง...' : 'ยืนยันส่งยอด'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settlement History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="size-5 text-amber-500" />
              ประวัติการส่งยอด
            </CardTitle>
          </CardHeader>
          <CardContent>
            {settlements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">ยังไม่มีประวัติการส่งยอด</div>
            ) : (
              <div className="space-y-3">
                {settlements.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{Number(s.amount).toLocaleString()} บาท</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {s.note && <p className="text-sm text-muted-foreground">{s.note}</p>}
                    </div>
                    {getStatusBadge(s.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
