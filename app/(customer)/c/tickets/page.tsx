'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, Home, Ticket, FileText, History, User, Clock, CheckCircle, XCircle, Hourglass } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface TicketEntry {
  id: string;
  lottery_name: string;
  numbers: string;
  bet_type: string;
  amount: number;
  status: 'pending' | 'won' | 'lost';
  created_at: string;
  prize_amount?: number;
}

interface TicketSlip {
  id: string;
  slip_number: string;
  total_amount: number;
  status: 'pending' | 'won' | 'lost' | 'partial_won';
  created_at: string;
  entries: TicketEntry[];
  lottery_name: string;
  total_win_amount?: number;
}

export default function TicketsPage() {
  const { data: tickets, error, isLoading, mutate } = useSWR<TicketSlip[]>('/api/customer/tickets', fetcher, {
    refreshInterval: 10000, // Refresh every 10 seconds
    revalidateOnFocus: true,
  });
  const [filter, setFilter] = useState<'all' | 'pending' | 'won' | 'lost'>('all');

  const filteredTickets = tickets?.filter(ticket => {
    if (filter === 'all') return true;
    return ticket.status === filter;
  }) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-400">
            <Hourglass className="w-3 h-3" />
            รอผล
          </span>
        );
      case 'won':
      case 'partial_won':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
            <CheckCircle className="w-3 h-3" />
            ถูกรางวัล
          </span>
        );
      case 'lost':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400">
            <XCircle className="w-3 h-3" />
            ไม่ถูกรางวัล
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: 'Kanit, sans-serif' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur border-b border-amber-500/20">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/c" className="p-2 hover:bg-neutral-800 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-amber-400" />
          </Link>
          <h1 className="text-lg font-bold text-amber-400">โพยของฉัน</h1>
          <div className="relative">
            <Bell className="w-5 h-5 text-neutral-400" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center">3</span>
          </div>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="flex gap-2 p-4 overflow-x-auto">
        {[
          { key: 'all', label: 'ทั้งหมด' },
          { key: 'pending', label: 'รอผล' },
          { key: 'won', label: 'ถูกรางวัล' },
          { key: 'lost', label: 'ไม่ถูก' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as typeof filter)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
              filter === tab.key
                ? 'bg-amber-500 text-black font-medium'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="p-4 pb-24">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-red-400">
            เกิดข้อผิดพลาดในการโหลดข้อมูล
          </div>
        )}

        {!isLoading && !error && filteredTickets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4">
              <FileText className="w-10 h-10 text-amber-500/50" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">ยังไม่มีโพย</h3>
            <p className="text-neutral-500 text-sm mb-6">เริ่มแทงหวยเพื่อดูประวัติโพยของคุณ</p>
            <Link
              href="/c/lotteries"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-black font-medium"
              style={{
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
              }}
            >
              <Ticket className="w-5 h-5" />
              ไปแทงหวย
            </Link>
          </div>
        )}

        {filteredTickets.length > 0 && (
          <div className="space-y-3">
            {filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="bg-neutral-900 rounded-xl border border-neutral-800 p-4"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-neutral-500">#{ticket.slip_number}</p>
                    <p className="text-white font-medium">{ticket.lottery_name}</p>
                  </div>
                  {getStatusBadge(ticket.status)}
                </div>

                {/* Entries */}
                <div className="space-y-2 mb-3">
                  {ticket.entries.slice(0, 3).map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-neutral-400">{entry.bet_type}</span>
                      <span className="text-white font-mono">{entry.numbers}</span>
                      <span className="text-amber-400">฿{entry.amount}</span>
                    </div>
                  ))}
                  {ticket.entries.length > 3 && (
                    <p className="text-xs text-neutral-500">+{ticket.entries.length - 3} รายการเพิ่มเติม</p>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
                  <div className="flex items-center gap-1 text-xs text-neutral-500">
                    <Clock className="w-3 h-3" />
                    {formatDate(ticket.created_at)}
                  </div>
                  <div className="text-right">
                    {ticket.status === 'won' || ticket.status === 'partial_won' ? (
                      <>
                        <p className="text-xs text-green-400">ยอดถูกรางวัล</p>
                        <p className="text-green-400 font-bold">฿{(ticket.total_win_amount || 0).toLocaleString()}</p>
                      </>
                    ) : ticket.status === 'lost' ? (
                      <>
                        <p className="text-xs text-red-400">ไม่ถูกรางวัล</p>
                        <p className="text-neutral-500 font-bold">฿0</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-neutral-500">ยอดรวม</p>
                        <p className="text-amber-400 font-bold">฿{ticket.total_amount.toLocaleString()}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-neutral-800 px-4 py-2 z-50">
        <div className="flex items-center justify-around">
          <Link href="/c" className="flex flex-col items-center gap-1">
            <Home className="w-5 h-5 text-neutral-400" />
            <span className="text-neutral-400 text-xs">หน้าหลัก</span>
          </Link>
          
          <Link href="/c/lotteries" className="flex flex-col items-center gap-1">
            <Ticket className="w-5 h-5 text-neutral-400" />
            <span className="text-neutral-400 text-xs">แทงหวย</span>
          </Link>
          
          {/* Center Diamond Button - Active */}
          <Link href="/c/tickets" className="relative -mt-6">
            <div 
              className="w-14 h-14 rounded-xl rotate-45 flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                boxShadow: '0 4px 15px rgba(255, 215, 0, 0.4)',
              }}
            >
              <FileText className="w-6 h-6 text-black -rotate-45" />
            </div>
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-amber-400 text-xs whitespace-nowrap">โพยของฉัน</span>
          </Link>
          
          <Link href="/c/history" className="flex flex-col items-center gap-1">
            <History className="w-5 h-5 text-neutral-400" />
            <span className="text-neutral-400 text-xs">ประวัติ</span>
          </Link>
          
          <Link href="/c/profile" className="flex flex-col items-center gap-1">
            <User className="w-5 h-5 text-neutral-400" />
            <span className="text-neutral-400 text-xs">โปรไฟล์</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
