'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Ticket, 
  CreditCard, 
  Wallet, 
  Gift, 
  Trophy, 
  Clock, 
  ChevronRight,
  Gamepad2,
  Dice5,
  History,
  Users,
  HelpCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CountdownTimer } from '@/components/customer/countdown-timer';

interface CustomerInfo {
  credit_balance: number;
  username: string;
  id?: string;
}

interface LotteryItem {
  id: string;
  name: string;
  close_time: string;
  status: string;
  draw_date?: string;
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

  // 8 menu items in 2-column grid
  const menuItems = [
    { icon: Ticket, label: 'แทงหวย', href: `${basePath}/bet`, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    { icon: Gamepad2, label: 'สล็อต&คาสิโน', href: `${basePath}/slots`, color: 'text-purple-400', bg: 'bg-purple-500/20' },
    { icon: Dice5, label: 'มินิเกม', href: `${basePath}/games`, color: 'text-pink-400', bg: 'bg-pink-500/20' },
    { icon: Trophy, label: 'ผลรางวัล', href: `${basePath}/results`, color: 'text-amber-400', bg: 'bg-amber-500/20' },
    { icon: History, label: 'โพยหวย', href: `${basePath}/tickets`, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
    { icon: Users, label: 'แนะนำเพื่อน', href: `${basePath}/referral`, color: 'text-blue-400', bg: 'bg-blue-500/20' },
    { icon: Gift, label: 'โปรโมชั่น', href: `${basePath}/promotions`, color: 'text-red-400', bg: 'bg-red-500/20' },
    { icon: HelpCircle, label: 'วิธีใช้งาน', href: `${basePath}/help`, color: 'text-gray-400', bg: 'bg-gray-500/20' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a2e3d] to-[#051d2a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a2e3d] to-[#051d2a] pb-20">
      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        
        {/* Wallet Balance Card - Pastel Yellow */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-100 to-yellow-200 p-5 shadow-lg">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-300/30 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-yellow-300/30 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative">
            {/* User Info */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-amber-500/30 flex items-center justify-center">
                <User className="h-4 w-4 text-amber-700" />
              </div>
              <div>
                <p className="text-amber-900/60 text-xs">ID: {customer?.id?.slice(0, 8) || 'xxxxxxxx'}</p>
                <p className="text-amber-900 font-medium text-sm">{customer?.username || 'Guest'}</p>
              </div>
            </div>
            
            {/* Balance */}
            <div className="mb-2">
              <p className="text-amber-900/70 text-sm">เงินคงเหลือ</p>
              <p className="text-4xl font-bold text-amber-900">
                {customer?.credit_balance?.toLocaleString() || '0'}
                <span className="text-xl ml-1">฿</span>
              </p>
            </div>
          </div>
        </div>

        {/* Twin Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`${basePath}/deposit`}
            className="flex items-center justify-center gap-2 py-4 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-semibold shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <ArrowDownToLine className="h-5 w-5" />
            <span>ฝากเงิน</span>
          </Link>
          <Link
            href={`${basePath}/withdraw`}
            className="flex items-center justify-center gap-2 py-4 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <ArrowUpFromLine className="h-5 w-5" />
            <span>ถอนเงิน</span>
          </Link>
        </div>

        {/* 2-Column Grid Menu */}
        <div className="grid grid-cols-2 gap-3">
          {menuItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 p-4 rounded-xl bg-[#1a3d4d]/60 border border-white/10 hover:bg-[#1a3d4d]/80 transition-all"
            >
              <div className={`w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <span className="text-white text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Lotteries - Open Now */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              หวยเปิดรับ
            </h2>
            <Link href={`${basePath}/bet`} className="text-emerald-400 text-sm flex items-center hover:underline">
              ดูทั้งหมด <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {lotteries.length === 0 ? (
            <div className="bg-[#1a3d4d]/60 rounded-xl p-6 text-center border border-white/10">
              <Clock className="h-10 w-10 mx-auto text-gray-500 mb-2" />
              <p className="text-gray-400">ไม่มีหวยเปิดขายขณะนี้</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lotteries.slice(0, 3).map((lottery) => {
                // Calculate close datetime
                const today = new Date().toISOString().split('T')[0];
                const closeDateTime = new Date(`${lottery.draw_date || today}T${lottery.close_time}`);
                
                return (
                  <button
                    key={lottery.id}
                    onClick={() => router.push(`${basePath}/bet`)}
                    className="w-full bg-[#1a3d4d]/60 rounded-xl p-4 flex items-center justify-between hover:bg-[#1a3d4d]/80 transition-all border border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <Ticket className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-white">{lottery.name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Clock className="h-3 w-3" />
                          <span>ปิดรับ {lottery.close_time}</span>
                          <CountdownTimer targetDate={closeDateTime} compact className="ml-1" />
                        </div>
                      </div>
                    </div>
                    <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg">
                      แทงเลย
                    </Button>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Promotions Banner */}
        <Link 
          href={`${basePath}/promotions`}
          className="block bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl p-4 border border-purple-500/30 hover:border-purple-500/50 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-purple-500/30 flex items-center justify-center">
              <Gift className="h-6 w-6 text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">โปรโมชั่นพิเศษ!</p>
              <p className="text-sm text-gray-400">แนะนำเพื่อนรับโบนัส 50 บาท</p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-500" />
          </div>
        </Link>

      </div>
    </div>
  );
}
