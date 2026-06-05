'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Star, Sparkles, RefreshCw, Crown, Flame, Zap, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface LuckyNumber {
  number: string;
  type: '2 ตัว' | '3 ตัว' | '4 ตัว';
  reason: string;
  hot: boolean;
}

const generateLuckyNumbers = (): LuckyNumber[] => {
  const reasons = [
    'เลขเด่นประจำวัน',
    'เลขมงคลจากดวงดาว',
    'เลขจากตำราโบราณ',
    'เลขนำโชคประจำสัปดาห์',
    'เลขฮิตติดเทรนด์',
    'เลขเจ้าแม่ให้โชค',
    'เลขมาแรงจากเซียน',
    'เลขจากการคำนวณ',
  ];

  const numbers: LuckyNumber[] = [];
  
  // Generate 2-digit numbers
  for (let i = 0; i < 5; i++) {
    numbers.push({
      number: String(Math.floor(Math.random() * 100)).padStart(2, '0'),
      type: '2 ตัว',
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      hot: Math.random() > 0.7,
    });
  }
  
  // Generate 3-digit numbers
  for (let i = 0; i < 5; i++) {
    numbers.push({
      number: String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
      type: '3 ตัว',
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      hot: Math.random() > 0.7,
    });
  }
  
  // Generate 4-digit numbers
  for (let i = 0; i < 3; i++) {
    numbers.push({
      number: String(Math.floor(Math.random() * 10000)).padStart(4, '0'),
      type: '4 ตัว',
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      hot: Math.random() > 0.8,
    });
  }
  
  return numbers;
};

export default function LuckyNumbersPage() {
  const [numbers, setNumbers] = useState<LuckyNumber[]>([]);
  const [activeTab, setActiveTab] = useState<'2 ตัว' | '3 ตัว' | '4 ตัว'>('2 ตัว');
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  useEffect(() => {
    setNumbers(generateLuckyNumbers());
  }, []);

  const refreshNumbers = () => {
    setNumbers(generateLuckyNumbers());
    toast.success('อัพเดทเลขเด่นใหม่แล้ว!');
  };

  const copyNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(num);
    toast.success(`คัดลอกเลข ${num} แล้ว`);
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  const filteredNumbers = numbers.filter(n => n.type === activeTab);

  const today = new Date();
  const thaiDate = today.toLocaleDateString('th-TH', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="min-h-screen bg-black pb-24" style={{ fontFamily: "'Kanit', sans-serif" }}>
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[400px] bg-amber-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-40 right-0 w-[400px] h-[400px] bg-yellow-600/10 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-amber-500/20">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Link href="/c">
              <Button variant="ghost" size="icon" className="text-amber-400 hover:text-amber-300">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400" />
              <h1 className="text-lg font-bold text-white">เลขเด่น</h1>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={refreshNumbers}
            className="text-amber-400 hover:text-amber-300"
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="relative z-10 p-4 space-y-4">
        {/* Date Card */}
        <div className="glass-card p-4 border-amber-500/30 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-white font-semibold">เลขเด่นประจำวัน</h2>
          </div>
          <p className="text-amber-400 text-sm">{thaiDate}</p>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-3 gap-2">
          {(['2 ตัว', '3 ตัว', '4 ตัว'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 rounded-xl font-semibold text-sm transition-all ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black'
                  : 'bg-neutral-900 border border-amber-500/30 text-amber-400'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Number Cards */}
        <div className="space-y-3">
          {filteredNumbers.map((item, index) => (
            <div
              key={index}
              className={`glass-card p-4 border-amber-500/20 hover:border-amber-500/40 transition-all ${
                item.hot ? 'border-red-500/40' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                    item.hot 
                      ? 'bg-gradient-to-br from-red-500/30 to-orange-600/30 border border-red-500/40' 
                      : 'bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/40'
                  }`}>
                    <span className={`text-2xl font-bold ${item.hot ? 'text-red-400' : 'text-amber-400'}`}>
                      {item.number}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{item.type}</span>
                      {item.hot && (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          มาแรง
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">{item.reason}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyNumber(item.number)}
                  className="text-amber-400 hover:text-amber-300"
                >
                  {copiedNumber === item.number ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* VIP Section */}
        <div className="glass-card p-5 border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Crown className="w-5 h-5 text-black" />
            </div>
            <div>
              <h3 className="text-white font-bold">เลข VIP พิเศษ</h3>
              <p className="text-xs text-neutral-400">สำหรับสมาชิก VIP เท่านั้น</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['??', '???', '????'].map((placeholder, i) => (
              <div key={i} className="h-14 rounded-xl bg-neutral-800/50 border border-amber-500/20 flex items-center justify-center">
                <span className="text-neutral-600 font-mono text-lg">{placeholder}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-amber-400/60 mt-3">🔒 อัพเกรดเป็น VIP เพื่อดูเลขพิเศษ</p>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-[10px] text-neutral-600 px-4">
          * เลขเด่นเป็นเพียงการคาดการณ์เท่านั้น ไม่รับประกันผลลัพธ์ โปรดใช้วิจารณญาณในการเสี่ยงโชค
        </p>
      </main>
    </div>
  );
}
