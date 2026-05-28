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

  // 8 menu items in grid - Gold theme icons
  const menuItems = [
    { icon: Ticket, label: 'แทงหวย', href: `${basePath}/bet` },
    { icon: Gamepad2, label: 'สล็อต&คาสิโน', href: `${basePath}/slots` },
    { icon: Dice5, label: 'มินิเกม', href: `${basePath}/games` },
    { icon: Trophy, label: 'ผลรางวัล', href: `${basePath}/results` },
    { icon: History, label: 'โพยหวย', href: `${basePath}/tickets` },
    { icon: Users, label: 'แนะนำเพื่อน', href: `${basePath}/referral` },
    { icon: Gift, label: 'โปรโมชั่น', href: `${basePath}/promotions` },
    { icon: HelpCircle, label: 'วิธีใช้งาน', href: `${basePath}/help` },
  ];

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-[#D4AF37]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Wallet Card - Premium White with Gold */}
      <div className="max-w-3xl mx-auto">
        
        {/* Wallet Balance Card - White with Gold Frame */}
        <div className="relative overflow-hidden rounded-2xl bg-white border-4 border-[#D4AF37] p-6 shadow-xl">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#D4AF37]/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#D4AF37]/20 to-transparent rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative">
            {/* User Info */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center shadow-lg">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-gray-500 text-xs">ID: {customer?.id?.slice(0, 8) || 'xxxxxxxx'}</p>
                <p className="text-gray-900 font-bold text-lg">{customer?.username || 'Guest'}</p>
              </div>
            </div>
            
            {/* Balance */}
            <div className="mb-4">
              <p className="text-gray-600 text-sm">เงินคงเหลือ</p>
              <p className="text-5xl font-bold text-gray-900">
                {customer?.credit_balance?.toLocaleString() || '0'}
                <span className="text-2xl ml-2 text-[#D4AF37]">฿</span>
              </p>
            </div>
          </div>
        </div>

        {/* Twin Action Buttons - Gold Theme */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <Link
            href={`${basePath}/deposit`}
            className="flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white font-bold shadow-lg shadow-[#D4AF37]/30 transition-all hover:scale-[1.02] active:scale-[0.98] border-2 border-[#B8860B]"
          >
            <ArrowDownToLine className="h-5 w-5" />
            <span>ฝากเงิน</span>
          </Link>
          <Link
            href={`${basePath}/withdraw`}
            className="flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-white text-gray-900 font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] border-4 border-[#D4AF37]"
          >
            <ArrowUpFromLine className="h-5 w-5 text-[#D4AF37]" />
            <span>ถอนเงิน</span>
          </Link>
        </div>

      </div>

      {/* Menu Grid - White cards with Gold borders */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {menuItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex flex-col items-center gap-3 p-5 rounded-xl bg-white border-4 border-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all shadow-md hover:shadow-lg"
          >
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center shadow-md">
              <item.icon className="h-7 w-7 text-white" />
            </div>
            <span className="text-gray-900 text-sm font-bold">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Lotteries - Open Now */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-xl text-gray-900 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[#D4AF37]" />
            หวยเปิดรับ
          </h2>
          <Link href={`${basePath}/bet`} className="text-[#D4AF37] text-sm font-semibold flex items-center hover:underline">
            ดูทั้งหมด <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {lotteries.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border-4 border-[#D4AF37] shadow-md">
            <Clock className="h-12 w-12 mx-auto text-[#D4AF37] mb-3" />
            <p className="text-gray-600 font-medium">ไม่มีหวยเปิดขายขณะนี้</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lotteries.slice(0, 6).map((lottery) => {
              // Calculate close datetime
              const today = new Date().toISOString().split('T')[0];
              const closeDateTime = new Date(`${lottery.draw_date || today}T${lottery.close_time}`);
              
              return (
                <button
                  key={lottery.id}
                  onClick={() => router.push(`${basePath}/bet`)}
                  className="w-full bg-white rounded-xl p-4 flex items-center justify-between hover:bg-[#D4AF37]/5 transition-all border-4 border-[#D4AF37] shadow-md hover:shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center shadow-md">
                      <Ticket className="h-6 w-6 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-gray-900">{lottery.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Clock className="h-3 w-3" />
                        <span>ปิด {lottery.close_time}</span>
                        <CountdownTimer targetDate={closeDateTime} compact className="ml-1 text-[#B8860B]" />
                      </div>
                    </div>
                  </div>
                  <Button size="sm" className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:from-[#B8860B] hover:to-[#996515] text-white rounded-lg font-bold shadow-md">
                    แทง
                  </Button>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Promotions Banner - Gold Theme */}
      <div className="max-w-3xl mx-auto">
        <Link 
          href={`${basePath}/promotions`}
          className="block bg-white rounded-xl p-5 border-4 border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-all shadow-md hover:shadow-lg"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center shadow-md">
              <Gift className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-lg">โปรโมชั่นพิเศษ!</p>
              <p className="text-sm text-gray-600">แนะนำเพื่อนรับโบนัส 50 บาท</p>
            </div>
            <ChevronRight className="h-6 w-6 text-[#D4AF37]" />
          </div>
        </Link>
      </div>
    </div>
  );
}
