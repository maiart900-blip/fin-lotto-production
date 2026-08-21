'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Ticket, CreditCard, Wallet, Gift, Bell, Trophy, Clock, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CustomerInfo {
  credit_balance: number;
  username: string;
}

interface LotteryItem {
  id: string;
  name: string;
  close_time: string;
  status: string;
}

export default function TenantCustomerHomePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const basePath = `/t/${slug}`;

  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [lotteries, setLotteries] = useState<LotteryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [slug]);

  const fetchData = async () => {
    try {
      const [customerRes, lotteriesRes] = await Promise.all([
        fetch(`/api/tenant/${slug}/customer/me`),
        fetch(`/api/tenant/${slug}/customer/lotteries`),
      ]);

      if (customerRes.ok) {
        const data = await customerRes.json();
        setCustomer(data);
      }

      if (lotteriesRes.ok) {
        const data = await lotteriesRes.json();
        setLotteries(data.lotteries || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { icon: Ticket, label: 'แทงหวย', href: `${basePath}/bet`, color: 'from-amber-500 to-orange-500' },
    { icon: CreditCard, label: 'ฝากเงิน', href: `${basePath}/deposit`, color: 'from-green-500 to-emerald-500' },
    { icon: Wallet, label: 'ถอนเงิน', href: `${basePath}/withdraw`, color: 'from-red-500 to-pink-500' },
    { icon: Gift, label: 'โปรโมชั่น', href: `${basePath}/promotions`, color: 'from-purple-500 to-violet-500' },
  ];

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Banner */}
      <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 rounded-2xl p-5 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/pattern.png')] opacity-10"></div>
        <div className="relative">
          <p className="text-amber-400 text-sm mb-1">ยอดเครดิตของคุณ</p>
          <p className="text-4xl font-bold">
            {customer?.credit_balance?.toLocaleString() || 0}
            <span className="text-xl ml-1">บาท</span>
          </p>
          <p className="text-gray-400 text-sm mt-2">สวัสดี, {customer?.username}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-2">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[#1a1a3a] hover:bg-[#1a1a3a]/80 transition-colors"
          >
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center`}>
              <action.icon className="h-5 w-5 text-white" />
            </div>
            <span className="text-xs text-gray-300">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* Lotteries */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            หวยเปิดรับ
          </h2>
          <Link href={`${basePath}/bet`} className="text-amber-400 text-sm flex items-center">
            ดูทั้งหมด <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {lotteries.length === 0 ? (
          <div className="bg-[#1a1a3a] rounded-xl p-6 text-center">
            <Clock className="h-10 w-10 mx-auto text-gray-600 mb-2" />
            <p className="text-gray-400">ไม่มีหวยเปิดขายขณะนี้</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lotteries.slice(0, 3).map((lottery) => (
              <button
                key={lottery.id}
                onClick={() => router.push(`${basePath}/bet`)}
                className="w-full bg-[#1a1a3a] rounded-xl p-4 flex items-center justify-between hover:bg-[#1a1a3a]/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <Ticket className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{lottery.name}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      ปิดรับ {lottery.close_time}
                    </p>
                  </div>
                </div>
                <Button size="sm" className="bg-amber-500 hover:bg-amber-600">
                  แทงเลย
                </Button>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Promotions Banner */}
      <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-purple-500/30 flex items-center justify-center">
            <Gift className="h-6 w-6 text-purple-400" />
          </div>
          <div className="flex-1">
            <p className="font-medium">โปรโมชั่นพิเศษ!</p>
            <p className="text-sm text-gray-400">แนะนำเพื่อนรับโบนัส 50 บาท</p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-500" />
        </div>
      </div>

      {/* Announcements */}
      <div className="bg-[#1a1a3a] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-4 w-4 text-amber-400" />
          <span className="font-medium">ประกาศ</span>
        </div>
        <p className="text-sm text-gray-400">
          ยินดีต้อนรับสู่เว็บหวยออนไลน์ที่ดีที่สุด! 
          ฝากถอนไว จ่ายจริง มั่นคง 100%
        </p>
      </div>
    </div>
  );
}
