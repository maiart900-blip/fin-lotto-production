'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Users,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// หน้านี้สำหรับเว็บกลาง - ดูส่วนแบ่งที่ต้องรับจากเอเย่น
export default function AgentSharePage() {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSettlement, setSelectedSettlement] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // ดึงรายงานเอเย่น
  const { data: reportData, isLoading } = useSWR(
    `/api/master/agent-reports?start_date=${startDate}&end_date=${endDate}`,
    fetcher
  );

  // ดึงยอดส่งที่รอตรวจสอบ
  const { data: pendingData } = useSWR(
    '/api/master/settlements?status=pending',
    fetcher
  );

  const summary = reportData?.summary || {};
  const agents = reportData?.agents || [];
  const pendingSettlements = pendingData?.settlements || [];

  const handleApproveSettlement = async (settlementId: string, status: 'paid' | 'cancelled') => {
    try {
      const res = await fetch('/api/master/settlements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settlement_id: settlementId,
          status,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(status === 'paid' ? 'ยืนยันการรับยอดสำเร็จ' : 'ยกเลิกรายการสำเร็จ');
        mutate('/api/master/settlements?status=pending');
        mutate(`/api/master/agent-reports?start_date=${startDate}&end_date=${endDate}`);
        setIsDialogOpen(false);
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#D4AF37]">ส่วนแบ่งจากเอเย่น</h1>
        <p className="text-muted-foreground">ดูยอดส่วนแบ่งที่เอเย่นต้องส่งให้เว็บกลาง</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">วันที่เริ่ม</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">วันที่สิ้นสุด</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#0D1321] text-white border-[#D4AF37]/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">เอเย่นทั้งหมด</p>
                <p className="text-2xl font-bold">{summary.total_agents || 0}</p>
              </div>
              <Users className="size-10 text-[#D4AF37]/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0D1321] text-white border-[#D4AF37]/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">ยอดขายรวม</p>
                <p className="text-2xl font-bold">{(summary.total_amount || 0).toLocaleString()}</p>
              </div>
              <DollarSign className="size-10 text-green-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0D1321] text-white border-[#D4AF37]/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">กำไรรวม</p>
                <p className={`text-2xl font-bold ${summary.total_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(summary.total_profit || 0).toLocaleString()}
                </p>
              </div>
              <TrendingUp className="size-10 text-green-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#D4AF37] text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#0D1321]/70 text-sm">ส่วนแบ่งเว็บกลาง</p>
                <p className="text-2xl font-bold text-[#0D1321]">{(summary.total_master_share || 0).toLocaleString()}</p>
                <p className="text-[#0D1321]/70 text-xs">ค้างจ่าย: {(summary.total_outstanding || 0).toLocaleString()}</p>
              </div>
              <ArrowUpRight className="size-10 text-[#0D1321]/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Settlements */}
      {pendingSettlements.length > 0 && (
        <Card className="border-orange-500/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-orange-500">
              <Clock className="size-5" />
              ยอดรอตรวจสอบ ({pendingSettlements.length} รายการ)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingSettlements.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div>
                    <p className="font-medium">{s.agents?.name || 'เอเย่น'} ({s.agents?.code})</p>
                    <p className="text-2xl font-bold text-orange-600">{Number(s.amount).toLocaleString()} บาท</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString('th-TH')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-green-500 hover:bg-green-600"
                      onClick={() => handleApproveSettlement(s.id, 'paid')}
                    >
                      <CheckCircle className="size-4 mr-1" />
                      ยืนยัน
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 border-red-500"
                      onClick={() => {
                        setSelectedSettlement(s);
                        setIsDialogOpen(true);
                      }}
                    >
                      <XCircle className="size-4 mr-1" />
                      ปฏิเสธ
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Details Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">รายละเอียดแต่ละเอเย่น</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
          ) : agents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">ไม่มีข้อมูลเอเย่น</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr className="text-left text-muted-foreground text-sm">
                    <th className="p-3">เอเย่น</th>
                    <th className="p-3 text-right">ยอดขาย</th>
                    <th className="p-3 text-right">จ่ายรางวัล</th>
                    <th className="p-3 text-right">กำไร</th>
                    <th className="p-3 text-right">ส่วนเอเย่น</th>
                    <th className="p-3 text-right">ส่วนเว็บกลาง</th>
                    <th className="p-3 text-right">ส่งแล้ว</th>
                    <th className="p-3 text-right">ค้างจ่าย</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {agents.map((item: any) => (
                    <tr key={item.agent.id} className="hover:bg-muted/50">
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{item.agent.name}</p>
                          <p className="text-sm text-muted-foreground">{item.agent.code}</p>
                        </div>
                      </td>
                      <td className="p-3 text-right">{item.stats.total_amount.toLocaleString()}</td>
                      <td className="p-3 text-right text-red-500">-{item.stats.total_payout.toLocaleString()}</td>
                      <td className="p-3 text-right">
                        <span className={item.stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {item.stats.profit.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {item.stats.agent_share.toLocaleString()}
                        <span className="text-xs text-muted-foreground ml-1">({item.agent.share_percent}%)</span>
                      </td>
                      <td className="p-3 text-right font-medium text-[#D4AF37]">
                        {item.stats.master_share.toLocaleString()}
                      </td>
                      <td className="p-3 text-right text-green-600">{item.stats.paid_amount.toLocaleString()}</td>
                      <td className="p-3 text-right">
                        {item.stats.outstanding > 0 ? (
                          <span className="text-red-500 font-medium">{item.stats.outstanding.toLocaleString()}</span>
                        ) : (
                          <Badge className="bg-green-500/20 text-green-600 border-green-500/30">ครบ</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="size-5" />
              ปฏิเสธการส่งยอด
            </DialogTitle>
            <DialogDescription>
              คุณแน่ใจหรือไม่ที่จะปฏิเสธยอด {selectedSettlement?.amount?.toLocaleString()} บาท จาก {selectedSettlement?.agents?.name}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>ยกเลิก</Button>
            <Button
              variant="destructive"
              onClick={() => selectedSettlement && handleApproveSettlement(selectedSettlement.id, 'cancelled')}
            >
              ยืนยันปฏิเสธ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
