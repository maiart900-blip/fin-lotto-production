'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { 
  Crown, Gift, Wallet, History, User, 
  TrendingUp, Clock, Star, ChevronRight,
  Banknote, ArrowDownToLine, ArrowUpFromLine
} from 'lucide-react';

interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  primary_color?: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function TenantHomePage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const { data: tenant } = useSWR<TenantSettings>(`/api/tenant/${slug}`, fetcher);
  
  const primaryColor = tenant?.primary_color || '#f59e0b';

  const menuItems = [
    { icon: Crown, label: 'แทงหวย', href: `/t/${slug}/lottery`, color: 'from-amber-500 to-orange-500' },
    { icon: ArrowDownToLine, label: 'ฝากเงิน', href: `/t/${slug}/deposit`, color: 'from-green-500 to-emerald-500' },
    { icon: ArrowUpFromLine, label: 'ถอนเงิน', href: `/t/${slug}/withdraw`, color: 'from-blue-500 to-cyan-500' },
    { icon: History, label: 'ประวัติ', href: `/t/${slug}/history`, color: 'from-purple-500 to-pink-500' },
  ];

  const features = [
    { icon: TrendingUp, title: 'อัตราจ่ายสูงสุด', desc: 'บาทละ 900' },
    { icon: Clock, title: 'ถอนไว', desc: 'ภายใน 1 นาที' },
    { icon: Star, title: 'โบนัส', desc: 'สมาชิกใหม่ 100%' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {tenant?.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="h-10" />
            ) : (
              <h1 className="text-xl font-bold" style={{ color: primaryColor }}>
                {tenant?.name || 'Loading...'}
              </h1>
            )}
          </div>
          <Link 
            href={`/t/${slug}/login`}
            className="px-4 py-2 rounded-lg font-bold text-black text-sm"
            style={{ backgroundColor: primaryColor }}
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="relative overflow-hidden">
        <div 
          className="absolute inset-0 opacity-20"
          style={{ 
            background: `radial-gradient(circle at 50% 0%, ${primaryColor}40, transparent 70%)` 
          }}
        />
        <div className="relative px-4 py-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800/50 border border-gray-700 mb-4">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-400 text-sm">เปิดให้บริการ 24 ชั่วโมง</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            ยินดีต้อนรับสู่ {tenant?.name}
          </h2>
          <p className="text-gray-400">
            เว็บหวยออนไลน์ จ่ายจริง โอนไว มั่นคง 100%
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-3 gap-2 px-4 mb-6">
        {features.map((feature, i) => (
          <div key={i} className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700">
            <feature.icon className="w-6 h-6 mx-auto mb-1" style={{ color: primaryColor }} />
            <p className="text-white text-sm font-bold">{feature.title}</p>
            <p className="text-xs" style={{ color: primaryColor }}>{feature.desc}</p>
          </div>
        ))}
      </div>

      {/* Quick Menu */}
      <div className="px-4 mb-6">
        <div className="grid grid-cols-4 gap-3">
          {menuItems.map((item, i) => (
            <Link
              key={i}
              href={item.href}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br ${item.color} transition-transform hover:scale-105`}
            >
              <item.icon className="w-6 h-6 text-white" />
              <span className="text-white text-xs font-bold">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Promotions */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold">โปรโมชั่น</h3>
          <Link href={`/t/${slug}/promotions`} className="text-sm flex items-center gap-1" style={{ color: primaryColor }}>
            ดูทั้งหมด <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="space-y-3">
          <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                <Gift className="w-6 h-6 text-black" />
              </div>
              <div>
                <p className="text-white font-bold">โบนัสสมัครใหม่ 100%</p>
                <p className="text-gray-400 text-sm">ฝากครั้งแรก รับโบนัสทันที</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center">
                <Banknote className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white font-bold">คืนยอดเสีย 5%</p>
                <p className="text-gray-400 text-sm">รับคืนทุกวันจันทร์</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lottery Results */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold">ผลหวยล่าสุด</h3>
          <Link href={`/t/${slug}/results`} className="text-sm flex items-center gap-1" style={{ color: primaryColor }}>
            ดูทั้งหมด <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400">หวยรัฐบาลไทย</span>
            <span className="text-gray-500 text-sm">16/05/2567</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-sm">รางวัลที่ 1</p>
              <p className="text-2xl font-bold" style={{ color: primaryColor }}>123456</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">2 ตัวล่าง</p>
              <p className="text-2xl font-bold text-white">56</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 pb-8">
        <Link
          href={`/t/${slug}/register`}
          className="block w-full py-4 rounded-xl font-bold text-black text-center text-lg"
          style={{ backgroundColor: primaryColor }}
        >
          สมัครสมาชิก รับโบนัสทันที
        </Link>
      </div>

      {/* Footer */}
      <div className="px-4 pb-8 text-center">
        <p className="text-gray-500 text-sm">
          Powered by FIN LOTTO Platform
        </p>
      </div>
    </div>
  );
}
