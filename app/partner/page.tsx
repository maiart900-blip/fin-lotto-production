'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Crown, TrendingUp, Users, Wallet, Shield, Zap, 
  ChevronRight, CheckCircle, Star, ArrowRight, Gift,
  Building2, Globe, Clock, BarChart3, HeadphonesIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const PARTNER_BENEFITS = [
  {
    icon: TrendingUp,
    title: 'คอมมิชชันสูงถึง 5%',
    description: 'รับค่าคอมมิชชันจากทุกการแทงของสมาชิกในสายงานของคุณ',
  },
  {
    icon: Users,
    title: 'สร้างทีมไม่จำกัด',
    description: 'ไม่มีข้อจำกัดจำนวนสมาชิก ยิ่งมากยิ่งได้',
  },
  {
    icon: Wallet,
    title: 'ถอนเงินทันที',
    description: 'ยอดคอมมิชชันสามารถถอนได้ทันทีไม่มีขั้นต่ำ',
  },
  {
    icon: Shield,
    title: 'ระบบปลอดภัย 100%',
    description: 'ระบบรักษาความปลอดภัยระดับธนาคาร',
  },
  {
    icon: Zap,
    title: 'Dashboard แบบ Real-time',
    description: 'ติดตามรายได้และสถิติแบบเรียลไทม์',
  },
  {
    icon: HeadphonesIcon,
    title: 'Support 24/7',
    description: 'ทีมซัพพอร์ตพร้อมช่วยเหลือตลอด 24 ชั่วโมง',
  },
];

const COMMISSION_TIERS = [
  { tier: 'Bronze Partner', minVolume: 0, maxVolume: 100000, rate: 2, color: '#CD7F32' },
  { tier: 'Silver Partner', minVolume: 100001, maxVolume: 500000, rate: 3, color: '#C0C0C0' },
  { tier: 'Gold Partner', minVolume: 500001, maxVolume: 2000000, rate: 4, color: '#FFD700' },
  { tier: 'Platinum Partner', minVolume: 2000001, maxVolume: null, rate: 5, color: '#E5E4E2' },
];

const TESTIMONIALS = [
  {
    name: 'คุณสมชาย',
    role: 'Gold Partner',
    avatar: 'SC',
    content: 'รายได้เดือนละ 6 หลักจากการแนะนำเพื่อน ระบบดี จ่ายจริง',
    income: '150,000+',
  },
  {
    name: 'คุณวิภา',
    role: 'Platinum Partner',
    avatar: 'WP',
    content: 'ทำเป็นอาชีพเสริมได้เลย รายได้ passive income ทุกวัน',
    income: '280,000+',
  },
  {
    name: 'คุณธนา',
    role: 'Silver Partner',
    avatar: 'TN',
    content: 'เริ่มต้นง่าย ไม่ต้องลงทุน แค่แชร์ลิงก์ก็ได้เงินแล้ว',
    income: '45,000+',
  },
];

export default function PartnerLandingPage() {
  const [email, setEmail] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#020617] via-[#0F172A] to-[#020617]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#020617]/80 backdrop-blur-lg border-b border-[#EAB308]/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Crown className="size-8 text-[#EAB308]" />
            <span className="text-xl font-bold text-[#EAB308]">FIN LOTTO R+</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/c/login">
              <Button variant="ghost" className="text-[#94A3B8] hover:text-[#EAB308]">
                เข้าสู่ระบบ
              </Button>
            </Link>
            <Link href="/c/register">
              <Button className="btn-gold">
                สมัคร Partner
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-[#EAB308]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[#EAB308]/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#EAB308]/10 border border-[#EAB308]/30 rounded-full text-[#EAB308] text-sm mb-6">
              <Star className="size-4" />
              <span>โปรแกรม Partner สุดพิเศษ</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-[#F1F5F9] mb-6 leading-tight">
              สร้างรายได้
              <span className="bg-gradient-to-r from-[#EAB308] via-[#FDE047] to-[#EAB308] bg-clip-text text-transparent"> Passive Income </span>
              ไม่จำกัด
            </h1>
            
            <p className="text-xl text-[#94A3B8] mb-8 max-w-2xl mx-auto">
              ร่วมเป็น Partner กับ FIN LOTTO R+ รับค่าคอมมิชชันสูงสุด 5% จากทุกการแทงของสมาชิกในสายงาน ไม่ต้องลงทุน ไม่มีความเสี่ยง
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/c/register?ref=partner">
                <Button className="btn-gold text-lg px-8 py-6 animate-gold-pulse">
                  <Crown className="size-5 mr-2" />
                  สมัครเป็น Partner ฟรี
                  <ArrowRight className="size-5 ml-2" />
                </Button>
              </Link>
              <Link href="#benefits">
                <Button variant="outline" className="btn-gold-outline text-lg px-8 py-6">
                  ดูรายละเอียด
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 mt-16 max-w-3xl mx-auto">
              <div className="text-center">
                <p className="text-4xl font-bold text-[#EAB308]">5,000+</p>
                <p className="text-[#64748B] mt-1">Partners</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-[#EAB308]">50M+</p>
                <p className="text-[#64748B] mt-1">บาท/เดือน</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-[#EAB308]">5%</p>
                <p className="text-[#64748B] mt-1">Commission สูงสุด</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#F1F5F9] mb-4">
              ทำไมต้องเป็น <span className="text-[#EAB308]">Partner</span> กับเรา?
            </h2>
            <p className="text-[#94A3B8] max-w-2xl mx-auto">
              สิทธิประโยชน์มากมายที่คุณจะได้รับเมื่อร่วมเป็น Partner กับ FIN LOTTO R+
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PARTNER_BENEFITS.map((benefit, idx) => (
              <div key={idx} className="card-midnight p-6 hover:border-[#EAB308]/50 transition-all group">
                <div className="p-3 bg-[#EAB308]/10 rounded-xl w-fit mb-4 group-hover:bg-[#EAB308]/20 transition-colors">
                  <benefit.icon className="size-6 text-[#EAB308]" />
                </div>
                <h3 className="text-xl font-bold text-[#F1F5F9] mb-2">{benefit.title}</h3>
                <p className="text-[#94A3B8]">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commission Tiers */}
      <section className="py-20 px-4 bg-[#0F172A]/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#F1F5F9] mb-4">
              ระดับ <span className="text-[#EAB308]">Commission</span>
            </h2>
            <p className="text-[#94A3B8] max-w-2xl mx-auto">
              ยิ่งสายงานแทงมาก ยิ่งได้ค่าคอมมิชชันสูง
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {COMMISSION_TIERS.map((tier, idx) => (
              <div 
                key={idx} 
                className="ultra-glass-card p-6 text-center relative overflow-hidden"
                style={{ borderColor: `${tier.color}40` }}
              >
                <div 
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ background: `linear-gradient(90deg, transparent, ${tier.color}, transparent)` }}
                />
                <div 
                  className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                  style={{ 
                    background: `linear-gradient(135deg, ${tier.color}40, ${tier.color}20)`,
                    border: `2px solid ${tier.color}`
                  }}
                >
                  <Crown className="size-8" style={{ color: tier.color }} />
                </div>
                <h3 className="text-lg font-bold text-[#F1F5F9] mb-2">{tier.tier}</h3>
                <p className="text-sm text-[#64748B] mb-4">
                  ยอดสายงาน {tier.minVolume.toLocaleString()}
                  {tier.maxVolume ? ` - ${tier.maxVolume.toLocaleString()}` : '+'} บาท
                </p>
                <p 
                  className="text-4xl font-bold mb-1"
                  style={{ color: tier.color }}
                >
                  {tier.rate}%
                </p>
                <p className="text-sm text-[#64748B]">Commission</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#F1F5F9] mb-4">
              เสียงจาก <span className="text-[#EAB308]">Partners</span> ของเรา
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((testimonial, idx) => (
              <div key={idx} className="card-midnight p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#EAB308] to-[#B8860B] flex items-center justify-center text-[#0F172A] font-bold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-[#F1F5F9]">{testimonial.name}</p>
                    <p className="text-sm text-[#EAB308]">{testimonial.role}</p>
                  </div>
                </div>
                <p className="text-[#94A3B8] mb-4">&ldquo;{testimonial.content}&rdquo;</p>
                <div className="flex items-center gap-2 text-green-400">
                  <TrendingUp className="size-4" />
                  <span className="font-semibold">รายได้ {testimonial.income} บาท/เดือน</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="video-frame-metallic p-1">
            <div className="bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] rounded-2xl p-8 md:p-12 text-center">
              <Gift className="size-16 text-[#EAB308] mx-auto mb-6" />
              <h2 className="text-3xl md:text-4xl font-bold text-[#F1F5F9] mb-4">
                พร้อมเริ่มสร้างรายได้แล้วหรือยัง?
              </h2>
              <p className="text-[#94A3B8] mb-8 max-w-xl mx-auto">
                สมัครฟรี ไม่มีค่าใช้จ่าย เริ่มต้นสร้างรายได้ได้ทันที
              </p>
              <Link href="/c/register?ref=partner">
                <Button className="btn-gold text-lg px-10 py-6 animate-gold-pulse">
                  <Crown className="size-5 mr-2" />
                  สมัครเป็น Partner เลย
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-[#EAB308]/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Crown className="size-6 text-[#EAB308]" />
            <span className="font-bold text-[#EAB308]">FIN LOTTO R+</span>
          </div>
          <p className="text-[#64748B] text-sm">
            2024 FIN LOTTO R+. Premium Lottery Platform.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="text-[#64748B] hover:text-[#EAB308] text-sm">
              ข้อกำหนด
            </Link>
            <Link href="/privacy" className="text-[#64748B] hover:text-[#EAB308] text-sm">
              นโยบาย
            </Link>
            <Link href="/contact" className="text-[#64748B] hover:text-[#EAB308] text-sm">
              ติดต่อเรา
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
