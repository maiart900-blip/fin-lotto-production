'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Wallet, 
  Send, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  TrendingUp,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

interface Settlement {
  id: string;
  amount: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  period_start: string;
  period_end: string;
  created_at: string;
  notes: string | null;
}

interface SettlementStats {
  pendingAmount: number;
  totalSentThisMonth: number;
  lastSettlementDate: string | null;
}

export default function TenantSettlementsPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [stats, setStats] = useState<SettlementStats>({
    pendingAmount: 0,
    totalSentThisMonth: 0,
    lastSettlementDate: null,
  });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/tenant/${slug}/admin/settlements`);
      if (res.ok) {
        const data = await res.json();
        setSettlements(data.settlements || []);
        setStats(data.stats || {});
      }
    } catch (error) {
      console.error('Error fetching settlements:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [slug]);

  const handleSendSettlement = async () => {
    if (stats.pendingAmount <= 0) {
      toast.error('ไม่มียอดที่ต้องส่ง');
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/tenant/${slug}/admin/settlements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: stats.pendingAmount }),
      });

      if (res.ok) {
        toast.success('ส่งยอดสำเร็จ รอเว็บกลางอนุมัติ');
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.message || 'ไม่สามารถส่งยอดได้');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setSending(false);
    }
  };

  const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    pending: { label: 'รออนุมัติ', color: 'bg-yellow-500/20 text-yellow-400', icon: Clock },
    approved: { label: 'อนุมัติแล้ว', color: 'bg-blue-500/20 text-blue-400', icon: CheckCircle },
    paid: { label: 'จ่ายแล้ว', color: 'bg-green-500/20 text-green-400', icon: CheckCircle },
    rejected: { label: 'ถูกปฏิเสธ', color: 'bg-red-500/20 text-red-400', icon: AlertCircle },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-amber-400">ส่งยอดเว็บกลาง</h1>
        <p className="text-muted-foreground">จัดการยอดส่งให้เว็บแม่</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#0d0d24] border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Wallet className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">฿{stats.pendingAmount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">ยอดค้างส่ง</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0d0d24] border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <TrendingUp className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">฿{stats.totalSentThisMonth.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">ส่งเดือนนี้</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0d0d24] border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{settlements.length}</p>
                <p className="text-xs text-muted-foreground">รายการทั้งหมด</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Send Settlement */}
      {stats.pendingAmount > 0 && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="font-medium text-amber-400">คุณมียอดที่ต้องส่งเว็บกลาง</p>
                <p className="text-sm text-muted-foreground">
                  ยอด ฿{stats.pendingAmount.toLocaleString()} กรุณาส่งยอดเพื่อหักส่วนแบ่งเว็บกลาง
                </p>
              </div>
              <Button 
                onClick={handleSendSettlement}
                disabled={sending}
                className="bg-amber-500 hover:bg-amber-600 text-black"
              >
                <Send className="h-4 w-4 mr-2" />
                {sending ? 'กำลังส่ง...' : 'ส่งยอด'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settlement History */}
      <Card className="bg-[#0d0d24] border-white/10">
        <CardHeader>
          <CardTitle className="text-lg">ประวัติการส่งยอด</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
            </div>
          ) : settlements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>ยังไม่มีประวัติการส่งยอด</p>
            </div>
          ) : (
            <div className="space-y-3">
              {settlements.map((settlement) => {
                const config = statusConfig[settlement.status];
                const StatusIcon = config.icon;
                
                return (
                  <div
                    key={settlement.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.color.split(' ')[0]}`}>
                        <StatusIcon className={`h-4 w-4 ${config.color.split(' ')[1]}`} />
                      </div>
                      <div>
                        <p className="font-medium">฿{settlement.amount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(settlement.created_at).toLocaleDateString('th-TH')}
                        </p>
                      </div>
                    </div>
                    <Badge className={config.color}>
                      {config.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
