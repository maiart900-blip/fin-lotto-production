'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Gem, Star, Sparkles, Shuffle, Heart, Briefcase, DollarSign, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const zodiacSigns = [
  { name: 'ราศีเมษ', icon: '♈', dates: '21 มี.ค. - 19 เม.ย.', element: 'ไฟ' },
  { name: 'ราศีพฤษภ', icon: '♉', dates: '20 เม.ย. - 20 พ.ค.', element: 'ดิน' },
  { name: 'ราศีเมถุน', icon: '♊', dates: '21 พ.ค. - 20 มิ.ย.', element: 'ลม' },
  { name: 'ราศีกรกฎ', icon: '♋', dates: '21 มิ.ย. - 22 ก.ค.', element: 'น้ำ' },
  { name: 'ราศีสิงห์', icon: '♌', dates: '23 ก.ค. - 22 ส.ค.', element: 'ไฟ' },
  { name: 'ราศีกันย์', icon: '♍', dates: '23 ส.ค. - 22 ก.ย.', element: 'ดิน' },
  { name: 'ราศีตุลย์', icon: '♎', dates: '23 ก.ย. - 22 ต.ค.', element: 'ลม' },
  { name: 'ราศีพิจิก', icon: '♏', dates: '23 ต.ค. - 21 พ.ย.', element: 'น้ำ' },
  { name: 'ราศีธนู', icon: '♐', dates: '22 พ.ย. - 21 ธ.ค.', element: 'ไฟ' },
  { name: 'ราศีมังกร', icon: '♑', dates: '22 ธ.ค. - 19 ม.ค.', element: 'ดิน' },
  { name: 'ราศีกุมภ์', icon: '♒', dates: '20 ม.ค. - 18 ก.พ.', element: 'ลม' },
  { name: 'ราศีมีน', icon: '♓', dates: '19 ก.พ. - 20 มี.ค.', element: 'น้ำ' },
];

const fortuneCategories = [
  { name: 'ความรัก', icon: Heart, color: 'from-pink-500 to-red-500' },
  { name: 'การงาน', icon: Briefcase, color: 'from-blue-500 to-cyan-500' },
  { name: 'การเงิน', icon: DollarSign, color: 'from-amber-500 to-yellow-500' },
  { name: 'สุขภาพ', icon: Users, color: 'from-green-500 to-emerald-500' },
];

interface FortuneResult {
  overall: number;
  love: number;
  work: number;
  money: number;
  health: number;
  luckyNumbers: string[];
  luckyColor: string;
  advice: string;
}

export default function FortunePage() {
  const [selectedSign, setSelectedSign] = useState<typeof zodiacSigns[0] | null>(null);
  const [fortune, setFortune] = useState<FortuneResult | null>(null);
  const [isReading, setIsReading] = useState(false);

  const readFortune = (sign: typeof zodiacSigns[0]) => {
    setSelectedSign(sign);
    setIsReading(true);
    
    // Simulate fortune reading
    setTimeout(() => {
      const luckyColors = ['แดง', 'ทอง', 'เขียว', 'น้ำเงิน', 'ม่วง', 'ชมพู', 'ส้ม', 'ขาว'];
      const advices = [
        'วันนี้เหมาะกับการเริ่มต้นสิ่งใหม่ โชคดีด้านการเงิน',
        'ระวังเรื่องการใช้จ่าย แต่ความรักกำลังมาถึง',
        'เป็นวันที่ดีสำหรับการลงทุน พบโชคลาภจากคนใกล้ชิด',
        'สุขภาพดี การงานก้าวหน้า มีโอกาสได้โชคจากการเสี่ยงดวง',
        'วันนี้ควรพักผ่อนให้เพียงพอ โชคด้านความรักกำลังรุ่งเรือง',
      ];
      
      setFortune({
        overall: Math.floor(Math.random() * 40) + 60,
        love: Math.floor(Math.random() * 40) + 60,
        work: Math.floor(Math.random() * 40) + 60,
        money: Math.floor(Math.random() * 40) + 60,
        health: Math.floor(Math.random() * 40) + 60,
        luckyNumbers: [
          String(Math.floor(Math.random() * 100)).padStart(2, '0'),
          String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
          String(Math.floor(Math.random() * 100)).padStart(2, '0'),
        ],
        luckyColor: luckyColors[Math.floor(Math.random() * luckyColors.length)],
        advice: advices[Math.floor(Math.random() * advices.length)],
      });
      setIsReading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-black pb-24" style={{ fontFamily: "'Kanit', sans-serif" }}>
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[400px] bg-purple-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-40 right-0 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-purple-500/20">
        <div className="flex items-center gap-3 px-4 h-14">
          <Link href="/c">
            <Button variant="ghost" size="icon" className="text-purple-400 hover:text-purple-300">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Gem className="w-5 h-5 text-purple-400" />
            <h1 className="text-lg font-bold text-white">ดูดวง</h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 p-4 space-y-6">
        {/* Intro Card */}
        <div className="glass-card p-5 border-purple-500/30 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-purple-500/30 to-violet-600/30 border border-purple-500/40 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-purple-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">เลือกราศีของคุณ</h2>
          <p className="text-sm text-neutral-400">ค้นหาดวงชะตาและเลขมงคลประจำวัน</p>
        </div>

        {/* Zodiac Grid */}
        <div className="grid grid-cols-3 gap-3">
          {zodiacSigns.map((sign) => (
            <button
              key={sign.name}
              onClick={() => readFortune(sign)}
              className={`glass-card p-3 text-center hover:scale-[1.02] transition-all ${
                selectedSign?.name === sign.name ? 'border-purple-500/60 bg-purple-500/10' : 'border-purple-500/20'
              }`}
            >
              <span className="text-3xl block mb-1">{sign.icon}</span>
              <span className="text-white text-xs font-medium block">{sign.name}</span>
              <span className="text-purple-400/60 text-[10px]">{sign.element}</span>
            </button>
          ))}
        </div>

        {/* Fortune Result */}
        {isReading && (
          <div className="glass-card p-8 border-purple-500/30 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center animate-pulse">
              <Gem className="w-8 h-8 text-white animate-spin" />
            </div>
            <p className="text-white mt-4">กำลังอ่านดวงชะตา...</p>
          </div>
        )}

        {fortune && !isReading && selectedSign && (
          <div className="space-y-4">
            {/* Selected Sign */}
            <div className="glass-card p-4 border-purple-500/30">
              <div className="flex items-center gap-4">
                <span className="text-4xl">{selectedSign.icon}</span>
                <div>
                  <h3 className="text-white font-bold">{selectedSign.name}</h3>
                  <p className="text-xs text-neutral-400">{selectedSign.dates}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-3xl font-bold text-purple-400">{fortune.overall}%</p>
                  <p className="text-xs text-neutral-500">ดวงรวม</p>
                </div>
              </div>
            </div>

            {/* Fortune Bars */}
            <div className="glass-card p-4 border-purple-500/30 space-y-3">
              {[
                { label: 'ความรัก', value: fortune.love, color: 'bg-pink-500' },
                { label: 'การงาน', value: fortune.work, color: 'bg-blue-500' },
                { label: 'การเงิน', value: fortune.money, color: 'bg-amber-500' },
                { label: 'สุขภาพ', value: fortune.health, color: 'bg-green-500' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-neutral-400">{item.label}</span>
                    <span className="text-white font-medium">{item.value}%</span>
                  </div>
                  <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Lucky Numbers */}
            <div className="glass-card p-4 border-amber-500/30">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-5 h-5 text-amber-400" />
                <h3 className="text-white font-semibold">เลขมงคลประจำวัน</h3>
              </div>
              <div className="flex gap-3 justify-center">
                {fortune.luckyNumbers.map((num, i) => (
                  <div key={i} className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/40 flex items-center justify-center">
                    <span className="text-2xl font-bold text-amber-400">{num}</span>
                  </div>
                ))}
              </div>
              <p className="text-center text-xs text-neutral-500 mt-3">สี: <span className="text-amber-400">{fortune.luckyColor}</span></p>
            </div>

            {/* Advice */}
            <div className="glass-card p-4 border-purple-500/30">
              <p className="text-white text-sm leading-relaxed">💫 {fortune.advice}</p>
            </div>

            {/* Re-read Button */}
            <Button 
              onClick={() => readFortune(selectedSign)}
              className="w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700"
            >
              <Shuffle className="w-4 h-4 mr-2" />
              ดูดวงอีกครั้ง
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
