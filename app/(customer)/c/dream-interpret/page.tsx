'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Moon, Search, Sparkles, Star, ChevronRight, Cloud, Zap, Send, Ticket, Check, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DreamResult {
  id: string;
  dream: string;
  keywords: string[];
  meaning: string;
  detailedMeaning: string;
  numbers: { number: string; type: string }[];
  category: string;
  luck: 'สูงมาก' | 'สูง' | 'ปานกลาง' | 'ต่ำ';
  tips: string;
}

// Expanded Dream Database
const dreamDatabase: DreamResult[] = [
  { 
    id: '1',
    dream: 'ฝันเห็นงู', 
    keywords: ['งู', 'งูเขียว', 'งูใหญ่', 'งูเห่า', 'งูหลาม'],
    meaning: 'จะมีโชคลาภเรื่องเงินทอง', 
    detailedMeaning: 'ฝันเห็นงูเป็นมงคลสูง หมายถึงจะได้โชคลาภก้อนใหญ่ หากงูสีเขียวหรือทอง ยิ่งเป็นมงคล แต่หากงูกัดให้ระวังคนใกล้ชิดหักหลัง',
    numbers: [{ number: '23', type: '2 ตัวบน' }, { number: '234', type: '3 ตัวตรง' }, { number: '32', type: '2 ตัวล่าง' }], 
    category: 'สัตว์', 
    luck: 'สูงมาก',
    tips: 'ควรแทงเลขภายใน 3 วัน หลังจากฝัน'
  },
  { 
    id: '2',
    dream: 'ฝันเห็นพระ', 
    keywords: ['พระ', 'พระพุทธรูป', 'พระสงฆ์', 'วัด', 'สวดมนต์'],
    meaning: 'จะได้รับความช่วยเหลือจากผู้ใหญ่', 
    detailedMeaning: 'ฝันเห็นพระเป็นสิริมงคล หมายถึงจะมีผู้ใหญ่คอยช่วยเหลือ การงานจะก้าวหน้า และอาจได้รับข่าวดีเรื่องการเงิน',
    numbers: [{ number: '09', type: '2 ตัวบน' }, { number: '909', type: '3 ตัวตรง' }, { number: '19', type: '2 ตัวล่าง' }], 
    category: 'ศาสนา', 
    luck: 'สูงมาก',
    tips: 'ทำบุญตักบาตรก่อนแทงเลขจะเสริมดวง'
  },
  { 
    id: '3',
    dream: 'ฝันเห็นน้ำท่วม', 
    keywords: ['น้ำ', 'น้ำท่วม', 'แม่น้ำ', 'ทะเล', 'ฝน'],
    meaning: 'การเงินจะมีการเปลี่ยนแปลง', 
    detailedMeaning: 'ฝันเห็นน้ำท่วมอาจหมายถึงจะมีเงินไหลเข้ามามาก แต่ก็ต้องระวังเรื่องการใช้จ่าย น้ำใสเป็นมงคล น้ำขุ่นให้ระวัง',
    numbers: [{ number: '45', type: '2 ตัวบน' }, { number: '456', type: '3 ตัวตรง' }, { number: '54', type: '2 ตัวล่าง' }], 
    category: 'ธรรมชาติ', 
    luck: 'ปานกลาง',
    tips: 'หลีกเลี่ยงการลงทุนใหญ่ในช่วงนี้'
  },
  { 
    id: '4',
    dream: 'ฝันเห็นทอง', 
    keywords: ['ทอง', 'ทองคำ', 'สร้อยทอง', 'แหวนทอง', 'ทองคำแท่ง'],
    meaning: 'จะได้โชคลาภก้อนใหญ่', 
    detailedMeaning: 'ฝันเห็นทองเป็นลางดีมาก หมายถึงจะได้โชคลาภก้อนใหญ่ในเร็วๆ นี้ อาจเป็นเงินก้อน มรดก หรือถูกหวย',
    numbers: [{ number: '88', type: '2 ตัวบน' }, { number: '888', type: '3 ตัวตรง' }, { number: '99', type: '2 ตัวล่าง' }], 
    category: 'ทรัพย์สิน', 
    luck: 'สูงมาก',
    tips: 'เลขซ้ำเป็นเลขมงคลของความฝันนี้'
  },
  { 
    id: '5',
    dream: 'ฝันเห็นคนตาย', 
    keywords: ['คนตาย', 'ศพ', 'งานศพ', 'ผี', 'คนเสียชีวิต'],
    meaning: 'จะมีการเปลี่ยนแปลงครั้งใหญ่', 
    detailedMeaning: 'แม้ฟังดูน่ากลัว แต่ฝันเห็นคนตายมักหมายถึงการสิ้นสุดของสิ่งเก่าและการเริ่มต้นใหม่ที่ดีกว่า อาจได้โชคจากเรื่องไม่คาดคิด',
    numbers: [{ number: '14', type: '2 ตัวบน' }, { number: '141', type: '3 ตัวตรง' }, { number: '41', type: '2 ตัวล่าง' }], 
    category: 'คน', 
    luck: 'ปานกลาง',
    tips: 'ทำบุญอุทิศส่วนกุศลก่อนแทงเลข'
  },
  { 
    id: '6',
    dream: 'ฝันเห็นแมว', 
    keywords: ['แมว', 'ลูกแมว', 'แมวดำ', 'แมวขาว', 'แมววิ่ง'],
    meaning: 'ระวังเรื่องการเงิน', 
    detailedMeaning: 'ฝันเห็นแมวอาจมีทั้งดีและร้าย หากแมวสีขาวเป็นมงคล แมวดำให้ระวังคนอิจฉา แต่ก็อาจได้โชคจากเรื่องไม่คาดฝัน',
    numbers: [{ number: '36', type: '2 ตัวบน' }, { number: '369', type: '3 ตัวตรง' }, { number: '63', type: '2 ตัวล่าง' }], 
    category: 'สัตว์', 
    luck: 'ต่ำ',
    tips: 'ไม่ควรแทงเลขเยอะเกินไป'
  },
  { 
    id: '7',
    dream: 'ฝันเห็นเลข', 
    keywords: ['เลข', 'ตัวเลข', 'เบอร์', 'หมายเลข', 'จำนวน'],
    meaning: 'เลขที่เห็นในฝันเป็นเลขนำโชค', 
    detailedMeaning: 'ฝันเห็นเลขเป็นสัญญาณโดยตรง! จงจำเลขที่เห็นให้ดีและนำไปเสี่ยงโชค มักจะได้ผลภายใน 1-3 งวด',
    numbers: [{ number: '00', type: '2 ตัวบน' }, { number: '000', type: '3 ตัวตรง' }, { number: '11', type: '2 ตัวล่าง' }], 
    category: 'ตัวเลข', 
    luck: 'สูงมาก',
    tips: 'ใช้เลขที่เห็นในฝันโดยตรง'
  },
  { 
    id: '8',
    dream: 'ฝันเห็นเด็ก', 
    keywords: ['เด็ก', 'ทารก', 'ลูก', 'เด็กทารก', 'เด็กน้อย'],
    meaning: 'จะมีข่าวดี มีความสุขเข้ามา', 
    detailedMeaning: 'ฝันเห็นเด็กเป็นลางดี หมายถึงจะมีความสุข ข่าวดี หรือการเริ่มต้นใหม่ หากเด็กยิ้มหรือหัวเราะยิ่งเป็นมงคล',
    numbers: [{ number: '12', type: '2 ตัวบน' }, { number: '123', type: '3 ตัวตรง' }, { number: '21', type: '2 ตัวล่าง' }], 
    category: 'คน', 
    luck: 'สูง',
    tips: 'เหมาะกับการทำเรื่องใหม่ๆ'
  },
  { 
    id: '9',
    dream: 'ฝันเห็นไฟ', 
    keywords: ['ไฟ', 'ไฟไหม้', 'เพลิง', 'แสงไฟ', 'ไฟลุก'],
    meaning: 'มีพลังสูง โชคด้านการงาน', 
    detailedMeaning: 'ฝันเห็นไฟหมายถึงพลังงานและความกระตือรือร้น การงานจะรุ่งเรือง แต่ให้ระวังอารมณ์ร้อน ไฟที่ให้แสงสว่างเป็นมงคล',
    numbers: [{ number: '59', type: '2 ตัวบน' }, { number: '595', type: '3 ตัวตรง' }, { number: '95', type: '2 ตัวล่าง' }], 
    category: 'ธรรมชาติ', 
    luck: 'ปานกลาง',
    tips: 'ควบคุมอารมณ์ให้ดีจะเสริมดวง'
  },
  { 
    id: '10',
    dream: 'ฝันเห็นรถ', 
    keywords: ['รถ', 'รถยนต์', 'รถเก๋ง', 'รถมอเตอร์ไซค์', 'ขับรถ'],
    meaning: 'การเดินทางนำโชค', 
    detailedMeaning: 'ฝันเห็นรถหมายถึงการเคลื่อนที่ก้าวหน้า อาจได้ย้ายที่อยู่ เปลี่ยนงาน หรือเดินทางไปได้โชค หากรถใหม่สวยยิ่งเป็นมงคล',
    numbers: [{ number: '72', type: '2 ตัวบน' }, { number: '727', type: '3 ตัวตรง' }, { number: '27', type: '2 ตัวล่าง' }], 
    category: 'ยานพาหนะ', 
    luck: 'ปานกลาง',
    tips: 'ลองซื้อหวยระหว่างเดินทาง'
  },
  { 
    id: '11',
    dream: 'ฝันเห็นช้าง', 
    keywords: ['ช้าง', 'ช้างขาว', 'ช้างใหญ่', 'งาช้าง'],
    meaning: 'มีผู้ใหญ่คอยช่วยเหลือ', 
    detailedMeaning: 'ฝันเห็นช้างเป็นมงคลสูงสุด! หมายถึงจะมีผู้ใหญ่คอยอุปถัมภ์ค้ำจุน การงานจะรุ่งเรือง และอาจได้โชคลาภก้อนใหญ่',
    numbers: [{ number: '16', type: '2 ตัวบน' }, { number: '161', type: '3 ตัวตรง' }, { number: '61', type: '2 ตัวล่าง' }], 
    category: 'สัตว์', 
    luck: 'สูงมาก',
    tips: 'ไหว้พระพิฆเนศก่อนแทงเลขจะดี'
  },
  { 
    id: '12',
    dream: 'ฝันเห็นเสือ', 
    keywords: ['เสือ', 'เสือโคร่ง', 'เสือดาว', 'เสือขาว'],
    meaning: 'จะมีอำนาจบารมี', 
    detailedMeaning: 'ฝันเห็นเสือหมายถึงพลังอำนาจและความกล้าหาญ จะได้รับตำแหน่งหน้าที่ดี แต่ให้ระวังศัตรูที่แอบแฝง โชคดีด้านการเงิน',
    numbers: [{ number: '05', type: '2 ตัวบน' }, { number: '050', type: '3 ตัวตรง' }, { number: '50', type: '2 ตัวล่าง' }], 
    category: 'สัตว์', 
    luck: 'สูง',
    tips: 'ไหว้เจ้าพ่อเสือก่อนแทงจะเฮง'
  },
  { 
    id: '13',
    dream: 'ฝันเห็นปลา', 
    keywords: ['ปลา', 'ปลาทอง', 'ปลาใหญ่', 'จับปลา', 'ปลาว่ายน้ำ'],
    meaning: 'โชคลาภกำลังมาถึง', 
    detailedMeaning: 'ฝันเห็นปลาเป็นลางดี โดยเฉพาะปลาทองหรือปลาใหญ่ หมายถึงโชคลาภกำลังว่ายเข้ามาหา หากจับปลาได้แสดงว่าจะได้โชค',
    numbers: [{ number: '56', type: '2 ตัวบน' }, { number: '567', type: '3 ตัวตรง' }, { number: '65', type: '2 ตัวล่าง' }], 
    category: 'สัตว์', 
    luck: 'สูง',
    tips: 'เลข 5, 6, 7 เป็นเลขมงคลของฝันนี้'
  },
  { 
    id: '14',
    dream: 'ฝันเห็นพ่อแม่ที่เสียไปแล้ว', 
    keywords: ['พ่อแม่', 'พ่อ', 'แม่', 'ญาติ', 'ปู่ย่า', 'ตายาย', 'คนที่ล่วงลับ'],
    meaning: 'ท่านมาให้โชคให้พร', 
    detailedMeaning: 'ฝันเห็นบุพการีที่ล่วงลับเป็นสิริมงคล ท่านมาอวยพรและให้โชค จงจำสิ่งที่ท่านพูดหรือแสดงให้ดี อาจเป็นเลขนำโชค',
    numbers: [{ number: '79', type: '2 ตัวบน' }, { number: '789', type: '3 ตัวตรง' }, { number: '97', type: '2 ตัวล่าง' }], 
    category: 'คน', 
    luck: 'สูงมาก',
    tips: 'ทำบุญอุทิศส่วนกุศลให้ท่านก่อนแทงเลข'
  },
  { 
    id: '15',
    dream: 'ฝันเห็นบ้านใหม่', 
    keywords: ['บ้าน', 'บ้านใหม่', 'สร้างบ้าน', 'ซื้อบ้าน', 'บ้านหลังใหญ่'],
    meaning: 'ฐานะจะมั่นคงขึ้น', 
    detailedMeaning: 'ฝันเห็นบ้านใหม่หมายถึงความมั่นคงและความเจริญก้าวหน้า ชีวิตจะดีขึ้น ฐานะการเงินจะมั่นคง อาจได้โชคจากอสังหาริมทรัพย์',
    numbers: [{ number: '33', type: '2 ตัวบน' }, { number: '333', type: '3 ตัวตรง' }, { number: '83', type: '2 ตัวล่าง' }], 
    category: 'สถานที่', 
    luck: 'สูง',
    tips: 'เลข 3 และ 8 เป็นเลขมงคลของฝันนี้'
  },
];

const categories = ['ทั้งหมด', 'สัตว์', 'คน', 'ธรรมชาติ', 'ทรัพย์สิน', 'ศาสนา', 'ยานพาหนะ', 'ตัวเลข', 'สถานที่'];

export default function DreamInterpretPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
  const [selectedDream, setSelectedDream] = useState<DreamResult | null>(null);
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const filteredDreams = dreamDatabase.filter(dream => {
    const matchesSearch = 
      dream.dream.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dream.meaning.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dream.keywords.some(k => k.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'ทั้งหมด' || dream.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getLuckColor = (luck: string) => {
    switch (luck) {
      case 'สูงมาก': return 'text-amber-400 bg-gradient-to-r from-amber-500/30 to-yellow-500/30 border-amber-500/50';
      case 'สูง': return 'text-green-400 bg-green-500/20 border-green-500/50';
      case 'ปานกลาง': return 'text-blue-400 bg-blue-500/20 border-blue-500/50';
      case 'ต่ำ': return 'text-red-400 bg-red-500/20 border-red-500/50';
      default: return 'text-neutral-400 bg-neutral-500/20 border-neutral-500/50';
    }
  };

  const getLuckStars = (luck: string) => {
    switch (luck) {
      case 'สูงมาก': return 5;
      case 'สูง': return 4;
      case 'ปานกลาง': return 3;
      case 'ต่ำ': return 2;
      default: return 1;
    }
  };

  const toggleSelectNumber = (num: string) => {
    setSelectedNumbers(prev => 
      prev.includes(num) 
        ? prev.filter(n => n !== num)
        : [...prev, num]
    );
  };

  const sendToBet = () => {
    if (selectedNumbers.length === 0) {
      toast.error('กรุณาเลือกเลขก่อนส่งแทง');
      return;
    }
    localStorage.setItem('luckyNumbers', JSON.stringify(selectedNumbers));
    toast.success(`ส่งเลขจากฝัน ${selectedNumbers.length} ตัวไปหน้าแทงหวยแล้ว!`);
    router.push('/c/agent/key-lottery');
  };

  const openDreamDetail = (dream: DreamResult) => {
    setSelectedDream(dream);
    setShowDetailModal(true);
  };

  return (
    <div className="min-h-screen bg-black pb-32" style={{ fontFamily: "'Kanit', sans-serif" }}>
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[400px] bg-blue-500/15 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-40 right-0 w-[400px] h-[400px] bg-indigo-600/15 rounded-full blur-[100px] animate-pulse" />
        {/* Stars */}
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              opacity: Math.random() * 0.5 + 0.2,
            }}
          />
        ))}
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
            <h1 className="text-lg font-bold text-white">ทำนายฝันเลขเด็ด</h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 p-4 space-y-4">
        {/* Intro Card */}
        <div className="glass-card p-5 border-blue-500/30 text-center relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <Cloud className="absolute text-blue-400/20 w-16 h-16 -top-2 -left-4 animate-pulse" />
            <Cloud className="absolute text-indigo-400/20 w-12 h-12 top-0 right-0 animate-pulse" style={{ animationDelay: '1s' }} />
          </div>
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-blue-500/30 to-indigo-600/30 border border-blue-500/40 flex items-center justify-center">
              <Moon className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              ค้นหาเลขจากความฝัน
            </h2>
            <p className="text-blue-400/80 text-sm mt-1">พิมพ์สิ่งที่คุณฝันเห็น แล้วรับเลขเด็ดทันที</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-400" />
          <Input
            placeholder="พิมพ์ความฝัน เช่น งู, พระ, ทอง, ปลา..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 py-6 text-lg bg-neutral-900 border-blue-500/30 text-white placeholder:text-neutral-500 focus:border-blue-500/60"
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
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-neutral-900 border border-blue-500/30 text-blue-400 hover:border-blue-500/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Dream List */}
        <div className="space-y-3">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            ความฝันยอดฮิต ({filteredDreams.length} รายการ)
          </h2>
          
          {filteredDreams.length === 0 ? (
            <div className="glass-card p-8 text-center border-blue-500/20">
              <Cloud className="w-16 h-16 text-blue-400/30 mx-auto mb-3" />
              <p className="text-white font-medium">ไม่พบความฝันที่ค้นหา</p>
              <p className="text-xs text-neutral-500 mt-1">ลองค้นหาด้วยคำอื่น เช่น งู, ทอง, พระ</p>
            </div>
          ) : (
            filteredDreams.map((dream) => (
              <div
                key={dream.id}
                className="glass-card p-4 border-blue-500/20 hover:border-blue-500/40 transition-all"
              >
                <div className="flex items-start justify-between">
                  <button 
                    onClick={() => openDreamDetail(dream)}
                    className="flex items-start gap-3 text-left flex-1"
                  >
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                      <Moon className="w-7 h-7 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium">{dream.dream}</h3>
                      <p className="text-xs text-neutral-400 mt-0.5 line-clamp-1">{dream.meaning}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${getLuckColor(dream.luck)}`}>
                          โชค{dream.luck}
                        </span>
                        <div className="flex gap-0.5">
                          {[...Array(getLuckStars(dream.luck))].map((_, i) => (
                            <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDreamDetail(dream)}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Quick Numbers */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-blue-500/10">
                  <span className="text-neutral-500 text-xs">เลขเด็ด:</span>
                  {dream.numbers.map((num, i) => (
                    <button
                      key={i}
                      onClick={() => toggleSelectNumber(num.number)}
                      className={`px-3 py-1 rounded-lg text-sm font-mono transition-all ${
                        selectedNumbers.includes(num.number)
                          ? 'bg-green-500/30 text-green-400 border border-green-500/50'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:border-amber-500/50'
                      }`}
                    >
                      {selectedNumbers.includes(num.number) && <Check className="w-3 h-3 inline mr-1" />}
                      {num.number}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Tips Card */}
        <div className="glass-card p-4 border-blue-500/20">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-white text-sm font-medium">เคล็ดลับการทำนายฝัน</p>
              <ul className="text-xs text-neutral-400 mt-2 space-y-1">
                <li>• ควรจดจำรายละเอียดในฝันให้มากที่สุด</li>
                <li>• ทำนายฝันตอนเช้าหลังตื่นจะแม่นที่สุด</li>
                <li>• ความฝันซ้ำๆ มักเป็นสัญญาณสำคัญ</li>
                <li>• แทงเลขจากฝันภายใน 3 วันจะได้ผลดี</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-[10px] text-neutral-600 px-4">
          * การทำนายฝันเป็นเพียงความเชื่อโบราณ ไม่รับประกันผลลัพธ์ โปรดใช้วิจารณญาณ
        </p>
      </main>

      {/* Dream Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="bg-neutral-900 border-blue-500/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-indigo-600/30 border border-blue-500/40 flex items-center justify-center">
                <Moon className="w-5 h-5 text-blue-400" />
              </div>
              {selectedDream?.dream}
            </DialogTitle>
          </DialogHeader>
          
          {selectedDream && (
            <div className="space-y-4">
              {/* Luck Level */}
              <div className="flex items-center justify-between">
                <span className="text-neutral-400 text-sm">ระดับโชค</span>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm border ${getLuckColor(selectedDream.luck)}`}>
                    {selectedDream.luck}
                  </span>
                  <div className="flex gap-0.5">
                    {[...Array(getLuckStars(selectedDream.luck))].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                </div>
              </div>

              {/* Meaning */}
              <div className="glass-card p-4 border-blue-500/20">
                <p className="text-white leading-relaxed">{selectedDream.detailedMeaning}</p>
              </div>

              {/* Lucky Numbers */}
              <div>
                <p className="text-neutral-400 text-sm mb-2 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400" />
                  เลขเด็ดจากความฝัน
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {selectedDream.numbers.map((num, i) => (
                    <button
                      key={i}
                      onClick={() => toggleSelectNumber(num.number)}
                      className={`p-3 rounded-xl text-center transition-all ${
                        selectedNumbers.includes(num.number)
                          ? 'bg-green-500/30 border-2 border-green-500'
                          : 'bg-amber-500/20 border border-amber-500/40 hover:border-amber-500'
                      }`}
                    >
                      <span className={`text-2xl font-bold font-mono ${
                        selectedNumbers.includes(num.number) ? 'text-green-400' : 'text-amber-400'
                      }`}>
                        {num.number}
                      </span>
                      <p className="text-[10px] text-neutral-400 mt-1">{num.type}</p>
                      {selectedNumbers.includes(num.number) && (
                        <Check className="w-4 h-4 text-green-400 mx-auto mt-1" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tips */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Zap className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-blue-400 text-sm">{selectedDream.tips}</p>
              </div>

              {/* Keywords */}
              <div>
                <p className="text-neutral-400 text-xs mb-2">คำที่เกี่ยวข้อง</p>
                <div className="flex flex-wrap gap-2">
                  {selectedDream.keywords.map((keyword, i) => (
                    <span key={i} className="px-2 py-1 rounded-full bg-neutral-800 text-neutral-300 text-xs">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Fixed Bottom Action Bar */}
      {selectedNumbers.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/95 backdrop-blur-xl border-t border-blue-500/20 z-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-blue-400" />
              <span className="text-white">เลขจากฝัน: <span className="text-blue-400 font-bold">{selectedNumbers.length}</span> ตัว</span>
            </div>
            <button 
              onClick={() => setSelectedNumbers([])}
              className="text-neutral-400 text-sm hover:text-white flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              ล้าง
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedNumbers.map(num => (
              <span key={num} className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm font-mono border border-blue-500/30">
                {num}
              </span>
            ))}
          </div>
          <Button 
            onClick={sendToBet}
            className="w-full py-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-lg font-bold shadow-lg shadow-green-500/30"
          >
            <Send className="w-5 h-5 mr-2" />
            กดแทงเลขจากความฝัน
          </Button>
        </div>
      )}
    </div>
  );
}
