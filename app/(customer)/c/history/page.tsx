'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Loader2, Receipt, ChevronRight, RefreshCw } from 'lucide-react';
import useSWR from 'swr';
import Link from 'next/link';
import { toast } from 'sonner';

interface Ticket {
  id: string;
  slip_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  lottery_name: string;
  entries: {
    id: string;
    numbers: string;
    bet_type: string;
    amount: number;
    status: string;
    prize_amount: number;
  }[];
}

interface CustomerData {
  id: string;
  name: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (res.status === 401) return null;
  if (!res.ok) return [];
  const data = await res.json();
  return data;
};

const BET_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  '2top': { label: '2 บน', color: 'bg-blue-500' },
  '2bot': { label: '2 ล่าง', color: 'bg-cyan-500' },
  '3top': { label: '3 ตรง', color: 'bg-red-500' },
  '3tod': { label: '3 โต๊ด', color: 'bg-orange-500' },
  '1top': { label: 'วิ่งบน', color: 'bg-green-500' },
  '1bot': { label: 'วิ่งล่าง', color: 'bg-teal-500' },
};

export default function CustomerHistoryPage() {
  // Fetch customer from API
  const { data: customer, isLoading: loadingCustomer } = useSWR<CustomerData | null>(
    '/api/customer/me',
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch tickets (bets) - ไม่ต้องรอ customer เพราะ API จะอ่าน customer_id จาก cookie เอง
  const { data: entriesData, isLoading: loadingEntries, mutate } = useSWR(
    '/api/customer/tickets',
    fetcher,
    { revalidateOnFocus: true }
  );

  const tickets: Ticket[] = Array.isArray(entriesData) ? entriesData : [];
  const isLoading = loadingCustomer || loadingEntries;

  // Group tickets by date
  const groupedTickets = tickets.reduce((acc, ticket) => {
    const date = new Date(ticket.created_at).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(ticket);
    return acc;
  }, {} as Record<string, Ticket[]>);

  // Calculate totals
  const totalAmount = tickets.reduce((sum, t) => sum + (t.total_amount || 0), 0);

  const handleRefresh = () => {
    mutate();
    toast.success('รีเฟรชข้อมูลแล้ว');
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2 text-white">
          <Receipt className="size-5 text-amber-400" />
          โพยของฉัน
        </h1>
        <div className="flex items-center gap-2">
          {tickets.length > 0 && (
            <div className="text-right mr-2">
              <p className="text-xs text-[#64748B]">ยอดรวม</p>
              <p className="font-mono font-bold text-amber-400">{totalAmount.toLocaleString()} บาท</p>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`size-4 text-amber-400 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-amber-400" />
            <p className="text-sm text-[#64748B]">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && tickets.length === 0 && (
        <Card className="bg-[#0D1321] border-amber-500/10">
          <CardContent className="py-12 text-center">
            <Receipt className="size-16 text-amber-500/30 mx-auto mb-4" />
            <p className="text-white font-medium mb-1">ยังไม่มีโพย</p>
            <p className="text-sm text-[#64748B] mb-4">เริ่มแทงหวยเพื่อดูประวัติโพยของคุณ</p>
            <Link 
              href="/c/lotteries" 
              className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm"
            >
              ไปแทงหวย <ChevronRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Tickets list */}
      {!isLoading && tickets.length > 0 && (
        <div className="space-y-3">
          {Object.entries(groupedTickets).map(([date, dateTickets]) => (
            <Card key={date} className="bg-[#0D1321] border-amber-500/10 overflow-hidden">
              <CardHeader className="py-2 px-4 bg-amber-500/5 border-b border-amber-500/10">
                <CardTitle className="text-xs flex items-center gap-2 text-amber-400/80">
                  <Calendar className="size-3" />
                  {date}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {dateTickets.map((ticket) => (
                    <div 
                      key={ticket.id} 
                      className="px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#64748B]">{ticket.slip_number}</span>
                          <Badge className={ticket.status === 'pending' ? 'bg-amber-500' : ticket.status === 'won' ? 'bg-green-500' : 'bg-gray-500'}>
                            {ticket.status === 'pending' ? 'รอผล' : ticket.status === 'won' ? 'ถูกรางวัล' : 'ไม่ถูก'}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-amber-400">{ticket.total_amount.toLocaleString()} บาท</p>
                          <p className="text-xs text-[#64748B]">{ticket.lottery_name}</p>
                        </div>
                      </div>
                      {/* Show entries */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {ticket.entries.slice(0, 5).map((entry) => {
                          const bt = BET_TYPE_LABELS[entry.bet_type];
                          return (
                            <div key={entry.id} className="flex items-center gap-1 bg-white/5 rounded px-2 py-1">
                              <span className="font-mono text-white">{entry.numbers}</span>
                              <Badge className={`${bt?.color || 'bg-gray-500'} text-white text-[10px] px-1`}>
                                {bt?.label || entry.bet_type}
                              </Badge>
                            </div>
                          );
                        })}
                        {ticket.entries.length > 5 && (
                          <span className="text-xs text-[#64748B] self-center">+{ticket.entries.length - 5} รายการ</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
