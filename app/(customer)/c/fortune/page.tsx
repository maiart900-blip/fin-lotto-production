'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Gem, Star, Sparkles, Shuffle, Heart, Briefcase, DollarSign, Activity, Compass, Shirt, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Tarot Cards Data
const tarotCards = [
  { name: 'The Fool', thai: 'คนโง่', meaning: 'การเริ่มต้นใหม่ โอกาสที่ไม่คาดฝัน', fortune: 'ดี' },
  { name: 'The Magician', thai: 'นักมายากล', meaning: 'พลังสร้างสรรค์ ความสำเร็จอยู่ในมือ', fortune: 'ดีมาก' },
  { name: 'The High Priestess', thai: 'นักบวชหญิง', meaning: 'สัญชาตญาณนำทาง ความลับจะถูกเปิดเผย', fortune: 'ดี' },
  { name: 'The Empress', thai: 'จักรพรรดินี', meaning: 'ความอุดมสมบูรณ์ โชคลาภทางการเงิน', fortune: 'ดีมาก' },
  { name: 'The Emperor', thai: 'จักรพรรดิ', meaning: 'อำนาจและความมั่นคง ผู้ใหญ่ช่วยเหลือ', fortune: 'ดีมาก' },
  { name: 'The Lovers', thai: 'คู่รัก', meaning: 'ความรักสมหวัง การตัดสินใจครั้งสำคัญ', fortune: 'ดี' },
  { name: 'The Chariot', thai: 'รถศึก', meaning: 'ชัยชนะ การเดินทางนำโชค', fortune: 'ดีมาก' },
  { name: 'Strength', thai: 'พลัง', meaning: 'ความอดทนนำความสำเร็จ', fortune: 'ดี' },
  { name: 'The Wheel of Fortune', thai: 'วงล้อโชคชะตา', meaning: 'โชคหมุนเวียน โอกาสทองมาถึง', fortune: 'ดีมาก' },
  { name: 'The Star', thai: 'ดวงดาว', meaning: 'ความหวังและแรงบันดาลใจ โชคลาภรออยู่', fortune: 'ดีมาก' },
  { name: 'The Sun', thai: 'พระอาทิตย์', meaning: 'ความสุข ความสำเร็จ โชคดีรอบด้าน', fortune: 'ดีที่สุด' },
  { name: 'The World', thai: 'โลก', meaning: 'ความสำเร็จสมบูรณ์ ทุกอย่างลงตัว', fortune: 'ดีที่สุด' },
];

const luckyColors = [
  { color: 'แดง', hex: '#EF4444', meaning: 'พลังและความกล้าหาญ' },
  { color: 'ทอง', hex: '#F59E0B', meaning: 'ความร่ำรวยและโชคลาภ' },
  { color: 'เขียว', hex: '#22C55E', meaning: 'การเติบโตและความสดใส' },
  { color: 'น้ำเงิน', hex: '#3B82F6', meaning: 'ความสงบและปัญญา' },
  { color: 'ม่วง', hex: '#A855F7', meaning: 'ความลึกลับและจิตวิญญาณ' },
  { color: 'ชมพู', hex: '#EC4899', meaning: 'ความรักและความอ่อนโยน' },
  { color: 'ส้ม', hex: '#F97316', meaning: 'ความคิดสร้างสรรค์และพลังงาน' },
  { color: 'ขาว', hex: '#F8FAFC', meaning: 'ความบริสุทธิ์และการเริ่มต้นใหม่' },
];

const luckyDirections = [
  { direction: 'เหนือ', icon: '⬆️', meaning: 'ความก้าวหน้าและการเติบโต' },
  { direction: 'ตะวันออก', icon: '➡️', meaning: 'การเริ่มต้นใหม่และโอกาส' },
  { direction: 'ใต้', icon: '⬇️', meaning: 'ความมั่นคงและรากฐาน' },
  { direction: 'ตะวันตก', icon: '⬅️', meaning: 'การสะสมและความสำเร็จ' },
  { direction: 'ตะวันออกเฉียงเหนือ', icon: '↗️', meaning: 'การศึกษาและปัญญา' },
  { direction: 'ตะวันออกเฉียงใต้', icon: '↘️', meaning: 'ความมั่งคั่งและโชคลาภ' },
  { direction: 'ตะวันตกเฉียงเหนือ', icon: '↖️', meaning: 'ผู้ใหญ่อุปถัมภ์' },
  { direction: 'ตะวันตกเฉียงใต้', icon: '↙️', meaning: 'ความรักและครอบครัว' },
];

interface FortuneResult {
  cards: typeof tarotCards;
  overall: number;
  love: number;
  work: number;
  money: number;
  health: number;
  luckyNumbers: string[];
  luckyColor: typeof luckyColors[0];
  luckyDirection: typeof luckyDirections[0];
  advice: string;
}

export default function FortunePage() {
  const [phase, setPhase] = useState<'intro' | 'selecting' | 'revealing' | 'result'>('intro');
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [fortune, setFortune] = useState<FortuneResult | null>(null);
  const [shuffledDeck, setShuffledDeck] = useState<number[]>([]);
  const [flippedCards, setFlippedCards] = useState<boolean[]>([false, false, false]);

  useEffect(() => {
    // Shuffle deck on mount
    const deck = Array.from({ length: 12 }, (_, i) => i);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    setShuffledDeck(deck);
  }, []);

  const startReading = () => {
    setPhase('selecting');
    setSelectedCards([]);
    setFlippedCards([false, false, false]);
    setFortune(null);
    // Reshuffle
    const deck = Array.from({ length: 12 }, (_, i) => i);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    setShuffledDeck(deck);
  };

  const selectCard = (cardIndex: number) => {
    if (selectedCards.length >= 3 || selectedCards.includes(cardIndex)) return;
    
    const newSelected = [...selectedCards, cardIndex];
    setSelectedCards(newSelected);

    if (newSelected.length === 3) {
      setPhase('revealing');
      // Reveal cards one by one
      setTimeout(() => setFlippedCards([true, false, false]), 500);
      setTimeout(() => setFlippedCards([true, true, false]), 1200);
      setTimeout(() => setFlippedCards([true, true, true]), 1900);
      setTimeout(() => generateFortune(newSelected), 2600);
    }
  };

  const generateFortune = (cards: number[]) => {
    const selectedTarotCards = cards.map(i => tarotCards[shuffledDeck[i]]);
    const advices = [
      'วันนี้เหมาะกับการเริ่มต้นสิ่งใหม่ จงกล้าที่จะก้าวออกจากกรอบเดิม',
      'โชคลาภกำลังมาถึง เตรียมพร้อมรับโอกาสที่จะเข้ามา',
      'ความอดทนจะนำมาซึ่งความสำเร็จ อย่าท้อแท้กับอุปสรรค',
      'ผู้ใหญ่จะเข้ามาช่วยเหลือ จงเปิดใจรับฟังคำแนะนำ',
      'การเงินกำลังจะดีขึ้น หมั่นทำบุญจะช่วยเสริมดวง',
      'ความรักกำลังจะเข้ามา หรือความสัมพันธ์จะแน่นแฟ้นขึ้น',
    ];

    setFortune({
      cards: selectedTarotCards,
      overall: Math.floor(Math.random() * 25) + 75,
      love: Math.floor(Math.random() * 30) + 70,
      work: Math.floor(Math.random() * 30) + 70,
      money: Math.floor(Math.random() * 30) + 70,
      health: Math.floor(Math.random() * 30) + 70,
      luckyNumbers: [
        String(Math.floor(Math.random() * 100)).padStart(2, '0'),
        String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
        String(Math.floor(Math.random() * 100)).padStart(2, '0'),
      ],
      luckyColor: luckyColors[Math.floor(Math.random() * luckyColors.length)],
      luckyDirection: luckyDirections[Math.floor(Math.random() * luckyDirections.length)],
      advice: advices[Math.floor(Math.random() * advices.length)],
    });
    setPhase('result');
  };

  const getFortuneLabel = (fortune: string) => {
    switch (fortune) {
      case 'ดีที่สุด': return 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black';
      case 'ดีมาก': return 'bg-gradient-to-r from-green-400 to-emerald-500 text-black';
      case 'ดี': return 'bg-gradient-to-r from-blue-400 to-cyan-500 text-black';
      default: return 'bg-neutral-500 text-white';
    }
  };

  return (
    <div className="min-h-screen bg-black pb-24" style={{ fontFamily: "'Kanit', sans-serif" }}>
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[400px] bg-purple-500/15 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-40 right-0 w-[400px] h-[400px] bg-violet-600/15 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[150px]" />
      </div>

      {/* Floating Stars */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              opacity: Math.random() * 0.5 + 0.3,
            }}
          />
        ))}
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
            <h1 className="text-lg font-bold text-white">ดูดวงไพ่ทาโรต์</h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 p-4 space-y-6">
        {/* Intro Phase */}
        {phase === 'intro' && (
          <div className="space-y-6 text-center py-8">
            {/* 3D Crystal Ball Effect */}
            <div className="relative w-40 h-40 mx-auto">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/30 via-violet-600/20 to-indigo-700/30 animate-pulse" />
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-purple-400/20 via-transparent to-violet-500/20 backdrop-blur-sm border border-purple-500/30" />
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-white/10 via-transparent to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-16 h-16 text-purple-400 animate-pulse" />
              </div>
              {/* Glowing Ring */}
              <div className="absolute -inset-4 rounded-full border-2 border-purple-500/30 animate-spin" style={{ animationDuration: '10s' }} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">เปิดไพ่ทำนายดวงชะตา</h2>
              <p className="text-neutral-400 text-sm px-4">
                เลือกไพ่ 3 ใบเพื่อเปิดเผยอนาคตของคุณ
                <br />
                พร้อมรับสีมงคล ทิศนำโชค และเลขเด็ด
              </p>
            </div>

            <Button
              onClick={startReading}
              className="px-8 py-6 text-lg bg-gradient-to-r from-purple-500 via-violet-500 to-purple-600 hover:from-purple-600 hover:via-violet-600 hover:to-purple-700 shadow-lg shadow-purple-500/30"
            >
              <Gem className="w-5 h-5 mr-2" />
              เริ่มเปิดไพ่
            </Button>
          </div>
        )}

        {/* Card Selection Phase */}
        {phase === 'selecting' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-2">เลือกไพ่ 3 ใบ</h2>
              <p className="text-neutral-400 text-sm">เลือกแล้ว {selectedCards.length}/3 ใบ</p>
            </div>

            {/* Card Grid */}
            <div className="grid grid-cols-4 gap-2">
              {shuffledDeck.map((_, index) => (
                <button
                  key={index}
                  onClick={() => selectCard(index)}
                  disabled={selectedCards.includes(index) || selectedCards.length >= 3}
                  className={`aspect-[2/3] rounded-xl transition-all duration-300 ${
                    selectedCards.includes(index)
                      ? 'bg-gradient-to-br from-purple-500 to-violet-600 scale-95 opacity-50'
                      : 'bg-gradient-to-br from-purple-900 to-indigo-900 border border-purple-500/40 hover:border-purple-400 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/30'
                  }`}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    {selectedCards.includes(index) ? (
                      <span className="text-white text-lg font-bold">
                        {selectedCards.indexOf(index) + 1}
                      </span>
                    ) : (
                      <Star className="w-6 h-6 text-purple-400/50" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Revealing Phase */}
        {phase === 'revealing' && (
          <div className="space-y-6 text-center py-8">
            <h2 className="text-xl font-bold text-white mb-4">กำลังเปิดไพ่...</h2>
            <div className="flex justify-center gap-4">
              {selectedCards.map((cardIndex, i) => (
                <div
                  key={i}
                  className={`w-24 h-36 rounded-xl transition-all duration-500 ${
                    flippedCards[i]
                      ? 'bg-gradient-to-br from-amber-400 to-amber-600 rotate-y-0'
                      : 'bg-gradient-to-br from-purple-900 to-indigo-900 border border-purple-500/40'
                  }`}
                  style={{
                    transform: flippedCards[i] ? 'rotateY(0deg)' : 'rotateY(180deg)',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    {flippedCards[i] ? (
                      <span className="text-black text-3xl">{tarotCards[shuffledDeck[cardIndex]]?.thai?.charAt(0) || '?'}</span>
                    ) : (
                      <Star className="w-8 h-8 text-purple-400/50" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Result Phase */}
        {phase === 'result' && fortune && (
          <div className="space-y-4">
            {/* Selected Cards */}
            <div className="glass-card p-4 border-purple-500/30">
              <h3 className="text-white font-semibold mb-3 text-center">ไพ่ที่คุณเลือก</h3>
              <div className="flex justify-center gap-3">
                {fortune.cards.map((card, i) => (
                  <div key={i} className="text-center">
                    <div className="w-20 h-28 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mb-2 shadow-lg shadow-amber-500/30">
                      <span className="text-black text-2xl font-bold">{card.thai.charAt(0)}</span>
                    </div>
                    <p className="text-white text-xs font-medium">{card.thai}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${getFortuneLabel(card.fortune)}`}>
                      {card.fortune}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Overall Score */}
            <div className="glass-card p-5 border-purple-500/30 text-center">
              <p className="text-neutral-400 text-sm mb-2">ดวงรวมวันนี้</p>
              <p className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-violet-400">
                {fortune.overall}%
              </p>
            </div>

            {/* Fortune Bars */}
            <div className="glass-card p-4 border-purple-500/30 space-y-3">
              {[
                { label: 'ความรัก', value: fortune.love, icon: Heart, color: 'bg-pink-500' },
                { label: 'การงาน', value: fortune.work, icon: Briefcase, color: 'bg-blue-500' },
                { label: 'การเงิน', value: fortune.money, icon: DollarSign, color: 'bg-amber-500' },
                { label: 'สุขภาพ', value: fortune.health, icon: Activity, color: 'bg-green-500' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-neutral-400 flex items-center gap-2">
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </span>
                    <span className="text-white font-medium">{item.value}%</span>
                  </div>
                  <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${item.color} rounded-full transition-all duration-1000`} 
                      style={{ width: `${item.value}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Lucky Color & Direction */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card p-4 border-purple-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Shirt className="w-4 h-4 text-purple-400" />
                  <span className="text-neutral-400 text-sm">สีมงคล</span>
                </div>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-full border-2 border-white/30"
                    style={{ backgroundColor: fortune.luckyColor.hex }}
                  />
                  <div>
                    <p className="text-white font-bold">{fortune.luckyColor.color}</p>
                    <p className="text-neutral-500 text-[10px]">{fortune.luckyColor.meaning}</p>
                  </div>
                </div>
              </div>
              <div className="glass-card p-4 border-purple-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Compass className="w-4 h-4 text-purple-400" />
                  <span className="text-neutral-400 text-sm">ทิศนำโชค</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{fortune.luckyDirection.icon}</span>
                  <div>
                    <p className="text-white font-bold">{fortune.luckyDirection.direction}</p>
                    <p className="text-neutral-500 text-[10px]">{fortune.luckyDirection.meaning}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Lucky Numbers */}
            <div className="glass-card p-4 border-amber-500/30">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-5 h-5 text-amber-400" />
                <h3 className="text-white font-semibold">เลขมงคลประจำวัน</h3>
              </div>
              <div className="flex gap-3 justify-center">
                {fortune.luckyNumbers.map((num, i) => (
                  <div 
                    key={i} 
                    className="w-20 h-20 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/40 flex flex-col items-center justify-center"
                  >
                    <span className="text-2xl font-bold text-amber-400">{num}</span>
                    <span className="text-[10px] text-amber-400/60">{num.length} ตัว</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card Meanings */}
            <div className="glass-card p-4 border-purple-500/30 space-y-3">
              <h3 className="text-white font-semibold">ความหมายไพ่</h3>
              {fortune.cards.map((card, i) => (
                <div key={i} className="flex items-start gap-3 pb-3 border-b border-purple-500/10 last:border-0 last:pb-0">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                    <span className="text-purple-400 text-sm font-bold">{i + 1}</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{card.thai}</p>
                    <p className="text-neutral-400 text-sm">{card.meaning}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Advice */}
            <div className="glass-card p-4 border-purple-500/30">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <p className="text-white text-sm leading-relaxed">{fortune.advice}</p>
              </div>
            </div>

            {/* Re-read Button */}
            <Button 
              onClick={startReading}
              className="w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 py-6"
            >
              <Shuffle className="w-5 h-5 mr-2" />
              เปิดไพ่อีกครั้ง
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
