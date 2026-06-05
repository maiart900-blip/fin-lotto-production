'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star, Sparkles, RefreshCw, Crown, Flame, Zap, Copy, Check, Ticket, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface LuckyNumber {
  number: string;
  type: '2 ตัวบน' | '2 ตัวล่าง' | '3 ตัวตรง' | '3 ตัวโต๊ด';
  reason: string;
  hot: boolean;
}

const reasons = [
  'เลขเด่นประจำวัน',
  'เลขมงคลจากดวงดาว',
  'เลขจากตำราโบราณ',
  'เลขนำโชคประจำสัปดาห์',
  'เลขฮิตติดเทรนด์',
  'เลขเจ้าแม่ให้โชค',
  'เลขมาแรงจากเซียน',
  'เลขจากการคำนวณ',
  'เลขดังประจำงวด',
  'เลขเทพประทาน',
];

const generateLuckyNumbers = (): LuckyNumber[] => {
  const numbers: LuckyNumber[] = [];
  
  // Generate 2-digit top numbers
  for (let i = 0; i < 3; i++) {
    numbers.push({
      number: String(Math.floor(Math.random() * 100)).padStart(2, '0'),
      type: '2 ตัวบน',
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      hot: Math.random() > 0.6,
    });
  }
  
  // Generate 2-digit bottom numbers
  for (let i = 0; i < 3; i++) {
    numbers.push({
      number: String(Math.floor(Math.random() * 100)).padStart(2, '0'),
      type: '2 ตัวล่าง',
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      hot: Math.random() > 0.7,
    });
  }
  
  // Generate 3-digit straight numbers
  for (let i = 0; i < 3; i++) {
    numbers.push({
      number: String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
      type: '3 ตัวตรง',
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      hot: Math.random() > 0.7,
    });
  }
  
  // Generate 3-digit toad numbers
  for (let i = 0; i < 3; i++) {
    numbers.push({
      number: String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
      type: '3 ตัวโต๊ด',
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      hot: Math.random() > 0.8,
    });
  }
  
  return numbers;
};

// Neon Animation Component
function NeonNumber({ number, isAnimating }: { number: string; isAnimating: boolean }) {
  const [displayNumber, setDisplayNumber] = useState(number);
  
  useEffect(() => {
    if (!isAnimating) {
      setDisplayNumber(number);
      return;
    }
    
    let frame = 0;
    const totalFrames = 20;
    const interval = setInterval(() => {
      if (frame < totalFrames) {
        setDisplayNumber(
          Array.from({ length: number.length }, () => 
            Math.floor(Math.random() * 10).toString()
          ).join('')
        );
        frame++;
      } else {
        setDisplayNumber(number);
        clearInterval(interval);
      }
    }, 50);
    
    return () => clearInterval(interval);
  }, [number, isAnimating]);

  return (
    <span className={`font-mono transition-all ${isAnimating ? 'animate-pulse' : ''}`}>
      {displayNumber}
    </span>
  );
}

export default function LuckyNumbersPage() {
  const router = useRouter();
  const [numbers, setNumbers] = useState<LuckyNumber[]>([]);
  const [activeTab, setActiveTab] = useState<'2 ตัวบน' | '2 ตัวล่าง' | '3 ตัวตรง' | '3 ตัวโต๊ด'>('2 ตัวบน');
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedForBet, setSelectedForBet] = useState<string[]>([]);

  useEffect(() => {
    setNumbers(generateLuckyNumbers());
  }, []);

  const refreshNumbers = () => {
    setIsSpinning(true);
    setTimeout(() => {
      setNumbers(generateLuckyNumbers());
      setIsSpinning(false);
      toast.success('สุ่มเลขเด่นใหม่แล้ว!');
    }, 1000);
  };

  const copyNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(num);
    toast.success(`คัดลอกเลข ${num} แล้ว`);
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  const toggleSelectForBet = (num: string) => {
    setSelectedForBet(prev => 
      prev.includes(num) 
        ? prev.filter(n => n !== num)
        : [...prev, num]
    );
  };

  const sendToBet = () => {
    if (selectedForBet.length === 0) {
      toast.error('กรุณาเลือกเลขก่อนส่งแทง');
      return;
    }
    // Store in localStorage for the betting page to read
    localStorage.setItem('luckyNumbers', JSON.stringify(selectedForBet));
    toast.success(`ส่งเลข ${selectedForBet.length} ตัวไปหน้าแทงหวยแล้ว!`);
    router.push('/c/agent/key-lottery');
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
    <div className="min-h-screen bg-black pb-32" style={{ fontFamily: "'Kanit', sans-serif" }}>
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[400px] bg-amber-500/15 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-40 right-0 w-[400px] h-[400px] bg-yellow-600/15 rounded-full blur-[100px] animate-pulse" />
        {/* Neon Grid Lines */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(251, 191, 36, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(251, 191, 36, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }} />
        </div>
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
              <h1 className="text-lg font-bold text-white">เลขเด่นประจำวัน</h1>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={refreshNumbers}
            disabled={isSpinning}
            className="text-amber-400 hover:text-amber-300"
          >
            <RefreshCw className={`w-5 h-5 ${isSpinning ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      <main className="relative z-10 p-4 space-y-4">
        {/* Date Card */}
        <div className="glass-card p-5 border-amber-500/30 text-center relative overflow-hidden">
          {/* Animated Stars */}
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(10)].map((_, i) => (
              <Sparkles
                key={i}
                className="absolute text-amber-400/30 animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  width: `${Math.random() * 12 + 8}px`,
                }}
              />
            ))}
          </div>
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-amber-500/30 to-yellow-600/30 border border-amber-500/40 flex items-center justify-center">
              <Star className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-500">
              เลขเด่นมาแรง
            </h2>
            <p className="text-amber-400/80 text-sm mt-1">{thaiDate}</p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-4 gap-2">
          {(['2 ตัวบน', '2 ตัวล่าง', '3 ตัวตรง', '3 ตัวโต๊ด'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 rounded-xl font-semibold text-xs transition-all ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg shadow-amber-500/30'
                  : 'bg-neutral-900 border border-amber-500/30 text-amber-400 hover:border-amber-500/50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Number Cards with Neon Effect */}
        <div className="space-y-3">
          {filteredNumbers.map((item, index) => (
            <div
              key={`${item.type}-${index}`}
              className={`glass-card p-4 transition-all relative overflow-hidden ${
                selectedForBet.includes(item.number)
                  ? 'border-green-500/60 bg-green-500/10'
                  : item.hot 
                    ? 'border-red-500/40 hover:border-red-500/60' 
                    : 'border-amber-500/20 hover:border-amber-500/40'
              }`}
            >
              {/* Neon Glow Effect */}
              {item.hot && (
                <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 via-orange-500/20 to-red-500/20 blur-xl opacity-50 animate-pulse" />
              )}
              
              <div className="relative flex items-center justify-between">
                <button 
                  onClick={() => toggleSelectForBet(item.number)}
                  className="flex items-center gap-4"
                >
                  <div className={`w-20 h-20 rounded-xl flex items-center justify-center relative ${
                    item.hot 
                      ? 'bg-gradient-to-br from-red-500/30 to-orange-600/30 border border-red-500/40' 
                      : 'bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/40'
                  }`}>
                    {/* Neon Border Animation */}
                    <div className={`absolute inset-0 rounded-xl ${item.hot ? 'animate-pulse' : ''}`} style={{
                      boxShadow: item.hot 
                        ? '0 0 20px rgba(239, 68, 68, 0.5), inset 0 0 20px rgba(239, 68, 68, 0.1)'
                        : '0 0 15px rgba(251, 191, 36, 0.3), inset 0 0 15px rgba(251, 191, 36, 0.1)',
                    }} />
                    <span className={`text-3xl font-bold relative ${item.hot ? 'text-red-400' : 'text-amber-400'}`}>
                      <NeonNumber number={item.number} isAnimating={isSpinning} />
                    </span>
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{item.type}</span>
                      {item.hot && (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] flex items-center gap-1 animate-pulse">
                          <Flame className="w-3 h-3" />
                          มาแรง
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">{item.reason}</p>
                    {selectedForBet.includes(item.number) && (
                      <span className="text-green-400 text-xs flex items-center gap-1 mt-1">
                        <Check className="w-3 h-3" />
                        เลือกแล้ว
                      </span>
                    )}
                  </div>
                </button>
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
        <div className="glass-card p-5 border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="relative flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Crown className="w-6 h-6 text-black" />
            </div>
            <div>
              <h3 className="text-white font-bold">เลข VIP พิเศษ</h3>
              <p className="text-xs text-neutral-400">สำหรับสมาชิก VIP เท่านั้น</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['??', '???', '????'].map((placeholder, i) => (
              <div key={i} className="h-16 rounded-xl bg-neutral-800/50 border border-amber-500/20 flex items-center justify-center">
                <span className="text-neutral-600 font-mono text-xl">{placeholder}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-amber-400/60 mt-3">
            <span className="inline-block mr-1">🔒</span>
            อัพเกรดเป็น VIP เพื่อดูเลขพิเศษ
          </p>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-[10px] text-neutral-600 px-4">
          * เลขเด่นเป็นเพียงการคาดการณ์เท่านั้น ไม่รับประกันผลลัพธ์ โปรดใช้วิจารณญาณในการเสี่ยงโชค
        </p>
      </main>

      {/* Fixed Bottom Action Bar */}
      {selectedForBet.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/95 backdrop-blur-xl border-t border-amber-500/20 z-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-amber-400" />
              <span className="text-white">เลขที่เลือก: <span className="text-amber-400 font-bold">{selectedForBet.length}</span> ตัว</span>
            </div>
            <button 
              onClick={() => setSelectedForBet([])}
              className="text-neutral-400 text-sm hover:text-white"
            >
              ล้าง
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedForBet.map(num => (
              <span key={num} className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm font-mono">
                {num}
              </span>
            ))}
          </div>
          <Button 
            onClick={sendToBet}
            className="w-full py-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-lg font-bold shadow-lg shadow-green-500/30"
          >
            <Send className="w-5 h-5 mr-2" />
            ส่งแทงเลขทันที
          </Button>
        </div>
      )}
    </div>
  );
}
