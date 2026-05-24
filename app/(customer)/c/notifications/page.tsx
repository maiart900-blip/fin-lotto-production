'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Bell, 
  CheckCheck, 
  Loader2,
  Gift,
  CreditCard,
  Wallet,
  Trophy,
  AlertCircle,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  deposit: <CreditCard className="size-5 text-green-400" />,
  withdraw: <Wallet className="size-5 text-blue-400" />,
  win: <Trophy className="size-5 text-yellow-400" />,
  promo: <Gift className="size-5 text-pink-400" />,
  alert: <AlertCircle className="size-5 text-red-400" />,
  info: <Info className="size-5 text-cyan-400" />,
};

export default function NotificationsPage() {
  const { data: notifications, mutate, isLoading } = useSWR<Notification[]>('/api/customer/notifications', fetcher);
  const [marking, setMarking] = useState(false);

  const markAllRead = async () => {
    setMarking(true);
    try {
      await fetch('/api/customer/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      mutate();
      toast.success('อ่านทั้งหมดแล้ว');
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setMarking(false);
    }
  };

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  return (
    <div className="min-h-screen bg-[#060B14]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a1628]/95 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/c">
              <Button variant="ghost" size="icon" className="text-white">
                <ArrowLeft className="size-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-semibold text-white">การแจ้งเตือน</h1>
            {unreadCount > 0 && (
              <Badge className="bg-red-500">{unreadCount}</Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllRead}
              disabled={marking}
              className="text-cyan-400"
            >
              {marking ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4 mr-1" />}
              อ่านทั้งหมด
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-cyan-400" />
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <Card className="bg-[#0a1628] border-white/10">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bell className="size-12 text-white/20 mb-4" />
              <p className="text-white/50">ยังไม่มีการแจ้งเตือน</p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notif) => (
            <Card 
              key={notif.id} 
              className={`bg-[#0a1628] border-white/10 ${!notif.is_read ? 'border-l-4 border-l-cyan-500' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {typeIcons[notif.type] || typeIcons.info}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`font-medium ${notif.is_read ? 'text-white/70' : 'text-white'}`}>
                        {notif.title}
                      </h3>
                      {!notif.is_read && (
                        <div className="size-2 bg-cyan-500 rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>
                    <p className="text-sm text-white/50 mt-1">{notif.message}</p>
                    <p className="text-xs text-white/30 mt-2">
                      {new Date(notif.created_at).toLocaleString('th-TH')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
