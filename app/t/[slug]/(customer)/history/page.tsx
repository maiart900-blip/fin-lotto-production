'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { History, Ticket, CreditCard, Wallet, ArrowDownToLine, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type HistoryType = 'all' | 'bet' | 'deposit' | 'withdraw';

interface HistoryItem {
  id: string;
  type: 'bet' | 'deposit' | 'withdraw';
  amount: number;
  status: string;
  description: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: any }> = {
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock },
  approved: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle },
  won: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle },
  rejected: { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle },
  lost: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: XCircle },
};

const TYPE_ICONS: Record<string, any> = {
  bet: Ticket,
  deposit: CreditCard,
  withdraw: Wallet,
};

export default function TenantHistoryPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [filter, setFilter] = useState<HistoryType>('all');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [slug, filter]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/${slug}/customer/history?type=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filters = [
    { id: 'all', label: 'ทั้งหมด', icon: History },
    { id: 'bet', label: 'แทงหวย', icon: Ticket },
    { id: 'deposit', label: 'ฝากเงิน', icon: CreditCard },
    { id: 'withdraw', label: 'ถอนเงิน', icon: ArrowDownToLine },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <History className="h-5 w-5 text-amber-400" />
          ประวัติรายการ
        </h1>
        <p className="text-gray-400 text-sm">รายการทั้งหมดของคุณ</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {filters.map((f) => (
          <Button
            key={f.id}
            variant="outline"
            size="sm"
            onClick={() => setFilter(f.id as HistoryType)}
            className={`flex-shrink-0 gap-1 ${
              filter === f.id
                ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                : 'border-white/20 text-gray-400'
            }`}
          >
            <f.icon className="h-4 w-4" />
            {f.label}
          </Button>
        ))}
      </div>

      {/* History List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
        </div>
      ) : history.length === 0 ? (
        <div className="bg-[#1a1a3a] rounded-xl p-8 text-center">
          <History className="h-12 w-12 mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400">ยังไม่มีประวัติรายการ</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((item) => {
            const statusConfig = STATUS_COLORS[item.status] || STATUS_COLORS.pending;
            const TypeIcon = TYPE_ICONS[item.type] || Ticket;
            const StatusIcon = statusConfig.icon;

            return (
              <div key={item.id} className="bg-[#1a1a3a] rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      item.type === 'bet' ? 'bg-amber-500/20' :
                      item.type === 'deposit' ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}>
                      <TypeIcon className={`h-5 w-5 ${
                        item.type === 'bet' ? 'text-amber-400' :
                        item.type === 'deposit' ? 'text-green-400' : 'text-red-400'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(item.created_at).toLocaleString('th-TH')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${
                      item.type === 'deposit' || item.status === 'won' ? 'text-green-400' :
                      item.type === 'withdraw' || item.type === 'bet' ? 'text-red-400' : ''
                    }`}>
                      {item.type === 'deposit' || item.status === 'won' ? '+' : '-'}
                      {item.amount.toLocaleString()} บาท
                    </p>
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${statusConfig.bg} ${statusConfig.text}`}>
                      <StatusIcon className="h-3 w-3" />
                      {item.status === 'pending' ? 'รอดำเนินการ' :
                       item.status === 'approved' ? 'สำเร็จ' :
                       item.status === 'won' ? 'ถูกรางวัล' :
                       item.status === 'lost' ? 'ไม่ถูก' :
                       item.status === 'rejected' ? 'ปฏิเสธ' : item.status}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
