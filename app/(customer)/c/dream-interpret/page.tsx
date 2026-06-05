'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Moon, Search, Sparkles, Star, ChevronRight, Cloud, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DreamResult {
  dream: string;
  meaning: string;
  numbers: string[];
  category: string;
  luck: 'สูง' | 'ปานกลาง' | 'ต่ำ';
}

const popularDreams: DreamResult[] = [
  { dream: 'ฝันเห็นงู', meaning: 'จะมีโชคลาภเรื่องเงินทอง ระวังคนใกล้ชิดหักหลัง', numbers: ['23', '234', '32'], category: 'สัตว์', luck: 'สูง' },
  { dream: 'ฝันเห็นพระ', meaning: 'จะได้รับความช่วยเหลือจากผู้ใหญ่ มีโชคด้านการงาน', numbers: ['09', '909', '19'], category: 'ศาสนา', luck: 'สูง' },
  { dream: 'ฝันเห็นน้ำท่วม', meaning: 'การเงินจะมีการเปลี่ยนแปลง ระวังเรื่องการลงทุน', numbers: ['45', '456', '54'], category: 'ธรรมชาติ', luck: 'ปานกลาง' },
  { dream: 'ฝันเห็นทอง', meaning: 'จะได้โชคลาภก้อนใหญ่ มีข่าวดีเรื่องการเงิน', numbers: ['88', '888', '99'], category: 'ทรัพย์สิน', luck: 'สูง' },
  { dream: 'ฝันเห็นคนตาย', meaning: 'จะมีการเปลี่ยนแปลงครั้งใหญ่ในชีวิต อาจได้โชค', numbers: ['14', '141', '41'], category: 'คน', luck: 'ปานกลาง' },
  { dream: 'ฝันเห็นแมว', meaning: 'ระวังเรื่องการเงิน อาจมีคนอิจฉา', numbers: ['36', '369', '63'], category: 'สัตว์', luck: 'ต่ำ' },
  { dream: 'ฝันเห็นเลข', meaning: 'เลขที่เห็นในฝันอาจเป็นเลขนำโชค', numbers: ['00', '000', '11'], category: 'ตัวเลข', luck: 'สูง' },
  { dream: 'ฝันเห็นเด็ก', meaning: 'จะมีข่าวดี มีความสุขเข้ามา โชคด้านครอบครัว', numbers: ['12', '123', '21'], category: 'คน', luck: 'ปานกลาง' },
  { dream: 'ฝันเห็นไฟ', meaning: 'มีพลังสูง แต่ระวังอารมณ์ร้อน โชคด้านการงาน', numbers: ['59', '595', '95'], category: 'ธรรมชาติ', luck: 'ปานกลาง' },
  { dream: 'ฝันเห็นรถ', meaning: 'การเดินทางนำโชค อาจได้ย้ายที่อยู่หรืองานใหม่', numbers: ['72', '727', '27'], category: 'ยานพาหนะ', luck: 'ปานกลาง' },
  { dream: 'ฝันเห็นช้าง', meaning: 'มีผู้ใหญ่คอยช่วยเหลือ โชคด้านการงานการเงิน', numbers: ['16', '161', '61'], category: 'สัตว์', luck: 'สูง' },
  { dream: 'ฝันเห็นเสือ', meaning: 'จะมีอำนาจบารมี ระวังศัตรู แต่โชคดีด้านการเงิน', numbers: ['05', '050', '50'], category: 'สัตว์', luck: 'สูง' },
];

const categories = ['ทั้งหมด', 'สัตว์', 'คน', 'ธรรมชาติ', 'ทรัพย์สิน', 'ศาสนา', 'ยานพาหนะ', 'ตัวเลข'];

export default function DreamInterpretPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
  const [selectedDream, setSelectedDream] = useState<DreamResult | null>(null);

  const filteredDreams = popularDreams.filter(dream => {
    const matchesSearch = dream.dream.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          dream.meaning.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ทั้งหมด' || dream.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getLuckColor = (luck: string) => {
    switch (luck) {
      case 'สูง': return 'text-green-400 bg-green-500/20';
      case 'ปานกลาง': return 'text-amber-400 bg-amber-500/20';
      case 'ต่ำ': return 'text-red-400 bg-red-500/20';
      default: return 'text-neutral-400 bg-neutral-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-black pb-24" style={{ fontFamily: "'Kanit', sans-serif" }}>
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[400px] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-40 right-0 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-blue-500/20">
        <div className="flex items-center gap-3 px-4 h-14">
          <Link href="/c">
            <Button variant="ghost" size="icon" className="text-blue-400 hover:text-blue-300">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Moon className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-bold text-white">ทำนายฝัน</h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 p-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-400" />
          <Input
            placeholder="ค้นหาความฝัน เช่น งู, พระ, น้ำ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-neutral-900 border-blue-500/30 text-white placeholder:text-neutral-500 focus:border-blue-500/60"
          />
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                  : 'bg-neutral-900 border border-blue-500/30 text-blue-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Dream List */}
        {!selectedDream ? (
          <div className="space-y-3">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Cloud className="w-4 h-4 text-blue-400" />
              ความฝันยอดนิยม
            </h2>
            {filteredDreams.map((dream, index) => (
              <button
                key={index}
                onClick={() => setSelectedDream(dream)}
                className="w-full glass-card p-4 border-blue-500/20 hover:border-blue-500/40 transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center">
                      <Moon className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{dream.dream}</h3>
                      <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{dream.meaning}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-[10px] ${getLuckColor(dream.luck)}`}>
                      {dream.luck}
                    </span>
                    <ChevronRight className="w-4 h-4 text-blue-500/50" />
                  </div>
                </div>
              </button>
            ))}

            {filteredDreams.length === 0 && (
              <div className="glass-card p-8 text-center border-blue-500/20">
                <Cloud className="w-12 h-12 text-blue-400/50 mx-auto mb-3" />
                <p className="text-neutral-400">ไม่พบความฝันที่ค้นหา</p>
                <p className="text-xs text-neutral-600 mt-1">ลองค้นหาด้วยคำอื่น</p>
              </div>
            )}
          </div>
        ) : (
          /* Dream Detail View */
          <div className="space-y-4">
            <Button
              variant="ghost"
              onClick={() => setSelectedDream(null)}
              className="text-blue-400 hover:text-blue-300 -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              กลับไปรายการ
            </Button>

            {/* Dream Card */}
            <div className="glass-card p-5 border-blue-500/30">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500/30 to-indigo-600/30 border border-blue-500/40 flex items-center justify-center">
                  <Moon className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedDream.dream}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs">{selectedDream.category}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${getLuckColor(selectedDream.luck)}`}>
                      โชค{selectedDream.luck}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-white leading-relaxed">{selectedDream.meaning}</p>
            </div>

            {/* Lucky Numbers */}
            <div className="glass-card p-5 border-amber-500/30">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-amber-400" />
                <h3 className="text-white font-semibold">เลขมงคลจากฝัน</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {selectedDream.numbers.map((num, i) => (
                  <div key={i} className="h-16 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/40 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-amber-400">{num}</span>
                    <span className="text-[10px] text-amber-400/60">{num.length} ตัว</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="glass-card p-4 border-blue-500/20">
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-blue-400 mt-0.5" />
                <div>
                  <p className="text-white text-sm font-medium">เคล็ดลับ</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    ควรแทงเลขจากฝันภายใน 3 วัน หลังจากฝัน เพื่อให้เลขมีพลังสูงสุด
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-center text-[10px] text-neutral-600 px-4">
          * การทำนายฝันเป็นเพียงความเชื่อโบราณ ไม่รับประกันผลลัพธ์ โปรดใช้วิจารณญาณ
        </p>
      </main>
    </div>
  );
}
