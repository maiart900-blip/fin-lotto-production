'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Loader2, 
  Trophy, 
  Calendar,
  RefreshCw, 
  Search,
  ChevronLeft,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface LotteryResult {
  id: string;
  lottery_id: string;
  lottery?: {
    id: string;
    name: string;
    type: string;
    category?: string;
  };
  lottery_name?: string;
  lottery_category?: string;
  draw_date: string;
  result_day_label?: string;
  status?: string;
  flag_icon_url?: string;
  first_prize?: string;
  three_front_1?: string;
  three_front_2?: string;
  three_bottom_1?: string;
  three_bottom_2?: string;
  two_bottom?: string;
  three_digit_top?: string;
  three_top?: string;
  two_digit_bot?: string;
  three_tod?: string;
  run_top?: string;
  run_bottom?: string;
}

const flagMap: Record<string, string> = {
  'thai': '🇹🇭', 'thailand': '🇹🇭', 'รัฐบาล': '🇹🇭', 'ออมสิน': '🇹🇭', 'ธกส': '🇹🇭',
  'laos': '🇱🇦', 'lao': '🇱🇦', 'ลาว': '🇱🇦',
  'hanoi': '🇻🇳', 'vietnam': '🇻🇳', 'ฮานอย': '🇻🇳', 'เวียดนาม': '🇻🇳', 'นอย': '🇻🇳',
  'malaysia': '🇲🇾', 'มาเลย์': '🇲🇾',
  'singapore': '🇸🇬', 'สิงคโปร์': '🇸🇬',
  'hongkong': '🇭🇰', 'ฮ่องกง': '🇭🇰', 'ฮั่งเส็ง': '🇭🇰',
  'korea': '🇰🇷', 'เกาหลี': '🇰🇷',
  'japan': '🇯🇵', 'ญี่ปุ่น': '🇯🇵', 'นิเคอิ': '🇯🇵', 'nikkei': '🇯🇵',
  'china': '🇨🇳', 'จีน': '🇨🇳',
  'taiwan': '🇹🇼', 'ไต้หวัน': '🇹🇼',
  'india': '🇮🇳', 'อินเดีย': '🇮🇳',
  'russia': '🇷🇺', 'รัสเซีย': '🇷🇺',
  'germany': '🇩🇪', 'เยอรมัน': '🇩🇪',
  'england': '🇬🇧', 'uk': '🇬🇧', 'อังกฤษ': '🇬🇧',
  'usa': '🇺🇸', 'dow': '🇺🇸', 'nasdaq': '🇺🇸', 'อเมริกา': '🇺🇸', 'ดาวโจนส์': '🇺🇸',
  'หุ้น': '📈', 'stock': '📈',
  'yeekee': '🎲', 'ยี่กี': '🎲',
  'pingpong': '🏓', 'ปิงปอง': '🏓',
};

const getFlag = (name: string): string => {
  const lowerName = name.toLowerCase();
  for (const [key, flag] of Object.entries(flagMap)) {
    if (lowerName.includes(key)) return flag;
  }
  return '🎰';
};

const formatThaiDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const day = days[date.getDay()];
  const d = date.getDate();
  const m = months[date.getMonth()];
  const y = date.getFullYear() + 543 - 2500;
  return `วัน${day} ${d.toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${y}`;
};

// Scoreboard-Style Thai Government Result Card
const ThaiGovernmentCard = ({ result }: { result: LotteryResult }) => {
  const name = result.lottery?.name || result.lottery_name || 'หวยรัฐบาลไทย';
  const isAnnounced = result.status === 'announced' || result.first_prize;

  return (
    <div className="overflow-hidden rounded-xl bg-[#1a3d4d]/80 border border-white/10">
      {/* Dark Green Header */}
      <div className="bg-gradient-to-r from-[#004d40] to-[#00695c] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getFlag(name)}</span>
          <div className="flex-1">
            <h3 className="font-bold text-white">{name}</h3>
            <p className="text-xs text-white/70">
              {result.result_day_label || formatThaiDate(result.draw_date)}
            </p>
          </div>
          {isAnnounced ? (
            <Badge className="bg-emerald-500 text-white text-xs">
              <CheckCircle2 className="size-3 mr-1" />
              ออกผลแล้ว
            </Badge>
          ) : (
            <Badge className="bg-orange-500/80 text-white text-xs">
              <Clock className="size-3 mr-1" />
              รอผล
            </Badge>
          )}
        </div>
      </div>

      {/* Results Grid - Scoreboard Style */}
      <div className="p-4 space-y-3">
        {/* รางวัลที่ 1 - Golden Scoreboard */}
        <div className="text-center p-4 rounded-lg bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30">
          <p className="text-xs text-amber-400 mb-2 font-medium">รางวัลที่ 1</p>
          <p className="text-4xl font-bold text-amber-400 tracking-[0.2em] font-mono">
            {result.first_prize || '------'}
          </p>
        </div>

        {/* 3 ตัว และ 2 ตัว - Dark Green Scoreboards */}
        <div className="grid grid-cols-3 gap-2">
          {/* 3 ตัวหน้า */}
          <div className="text-center p-3 rounded-lg bg-[#004d40] border border-emerald-600/50">
            <p className="text-[10px] text-emerald-300 mb-2 font-medium">3 ตัวหน้า</p>
            <div className="space-y-1">
              <p className="text-lg font-bold text-white tracking-wider font-mono">
                {result.three_front_1 || '---'}
              </p>
              <p className="text-lg font-bold text-white tracking-wider font-mono">
                {result.three_front_2 || '---'}
              </p>
            </div>
          </div>

          {/* 3 ตัวล่าง */}
          <div className="text-center p-3 rounded-lg bg-[#004d40] border border-emerald-600/50">
            <p className="text-[10px] text-emerald-300 mb-2 font-medium">3 ตัวล่าง</p>
            <div className="space-y-1">
              <p className="text-lg font-bold text-white tracking-wider font-mono">
                {result.three_bottom_1 || '---'}
              </p>
              <p className="text-lg font-bold text-white tracking-wider font-mono">
                {result.three_bottom_2 || '---'}
              </p>
            </div>
          </div>

          {/* 2 ตัวล่าง */}
          <div className="text-center p-3 rounded-lg bg-[#004d40] border border-emerald-600/50">
            <p className="text-[10px] text-emerald-300 mb-2 font-medium">2 ตัวล่าง</p>
            <p className="text-2xl font-bold text-white tracking-wider font-mono mt-2">
              {result.two_bottom || '--'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Scoreboard-Style General Lottery Card
const GeneralLotteryCard = ({ result }: { result: LotteryResult }) => {
  const name = result.lottery?.name || result.lottery_name || 'หวย';
  const threeTop = result.three_top || result.three_digit_top;
  const twoBottom = result.two_bottom || result.two_digit_bot;
  const isAnnounced = result.status === 'announced' || threeTop;

  return (
    <div className="overflow-hidden rounded-xl bg-[#1a3d4d]/80 border border-white/10">
      {/* Dark Green Header */}
      <div className="bg-gradient-to-r from-[#004d40] to-[#00695c] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getFlag(name)}</span>
          <div className="flex-1">
            <h3 className="font-bold text-white">{name}</h3>
            <p className="text-xs text-white/70">
              {result.result_day_label || formatThaiDate(result.draw_date)}
            </p>
          </div>
          {isAnnounced ? (
            <Badge className="bg-emerald-500 text-white text-xs">
              <CheckCircle2 className="size-3 mr-1" />
              ออกผลแล้ว
            </Badge>
          ) : (
            <Badge className="bg-orange-500/80 text-white text-xs">
              <Clock className="size-3 mr-1" />
              รอผล
            </Badge>
          )}
        </div>
      </div>

      {/* Results Grid - Scoreboard Style */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          {/* 3 ตัวบน */}
          <div className="text-center p-4 rounded-lg bg-[#004d40] border border-emerald-600/50">
            <p className="text-xs text-emerald-300 mb-2 font-medium">3 ตัวบน</p>
            <p className="text-3xl font-bold text-white tracking-[0.15em] font-mono">
              {threeTop || '---'}
            </p>
          </div>

          {/* 2 ตัวล่าง */}
          <div className="text-center p-4 rounded-lg bg-[#004d40] border border-emerald-600/50">
            <p className="text-xs text-emerald-300 mb-2 font-medium">2 ตัวล่าง</p>
            <p className="text-3xl font-bold text-white tracking-[0.15em] font-mono">
              {twoBottom || '--'}
            </p>
          </div>
        </div>

        {/* Additional results */}
        {(result.three_tod || result.run_top || result.run_bottom) && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {result.three_tod && (
              <div className="text-center p-2 rounded-lg bg-white/5 border border-white/10">
                <p className="text-[10px] text-gray-400">3 ตัวโต๊ด</p>
                <p className="text-sm font-bold text-white font-mono">{result.three_tod}</p>
              </div>
            )}
            {result.run_top && (
              <div className="text-center p-2 rounded-lg bg-white/5 border border-white/10">
                <p className="text-[10px] text-gray-400">วิ่งบน</p>
                <p className="text-sm font-bold text-white font-mono">{result.run_top}</p>
              </div>
            )}
            {result.run_bottom && (
              <div className="text-center p-2 rounded-lg bg-white/5 border border-white/10">
                <p className="text-[10px] text-gray-400">วิ่งล่าง</p>
                <p className="text-sm font-bold text-white font-mono">{result.run_bottom}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default function CustomerResultsPage() {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: results, isLoading, error, mutate } = useSWR<LotteryResult[]>(
    `/api/results?date=${selectedDate}`,
    fetcher
  );

  // Filter by search
  const filteredResults = searchQuery 
    ? results?.filter(r => 
        (r.lottery?.name || r.lottery_name || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : results;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a2e3d] to-[#051d2a] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0a2e3d]/95 backdrop-blur-sm border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/c">
            <Button variant="ghost" size="icon" className="shrink-0 text-white hover:bg-white/10">
              <ChevronLeft className="size-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Trophy className="size-5 text-amber-400" />
              ผลรางวัล
            </h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => mutate()}
            disabled={isLoading}
            className="text-white hover:bg-white/10"
          >
            <RefreshCw className={`size-5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Date Picker */}
      <div className="bg-[#1a3d4d]/60 px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 max-w-md mx-auto">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg border border-white/10">
            <Calendar className="size-4 text-emerald-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1 bg-transparent border-none focus:outline-none text-white text-sm"
            />
          </div>
          <Button 
            size="sm"
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            ผลล่าสุด
          </Button>
        </div>
        <p className="text-center text-sm text-gray-400 mt-2">
          {formatThaiDate(selectedDate)}
        </p>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="size-10 animate-spin text-emerald-500 mb-3" />
            <p className="text-gray-400">กำลังโหลดผลหวย...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-500/20 border border-red-500/30 p-6 text-center">
            <p className="text-red-400 mb-3">ไม่สามารถโหลดผลหวยได้</p>
            <Button variant="outline" size="sm" onClick={() => mutate()} className="border-red-500/50 text-red-400 hover:bg-red-500/20">
              ลองอีกครั้ง
            </Button>
          </div>
        )}

        {/* Results */}
        {!isLoading && !error && (
          <>
            {filteredResults && filteredResults.length > 0 ? (
              <div className="space-y-4">
                {filteredResults.map((result) => {
                  const name = (result.lottery?.name || result.lottery_name || '').toLowerCase();
                  const isThaiGov = name.includes('รัฐบาล') || name.includes('government');
                  
                  return isThaiGov ? (
                    <ThaiGovernmentCard key={result.id} result={result} />
                  ) : (
                    <GeneralLotteryCard key={result.id} result={result} />
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl bg-[#1a3d4d]/60 border border-white/10 p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
                  <Trophy className="size-8 text-gray-500" />
                </div>
                <p className="text-white font-medium">ยังไม่มีผลหวยในวันที่เลือก</p>
                <p className="text-sm text-gray-400 mt-1">กรุณาเลือกวันอื่น หรือรอผลประกาศ</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Search Button */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogTrigger asChild>
          <Button
            className="fixed bottom-24 right-4 size-14 rounded-full shadow-lg bg-emerald-500 hover:bg-emerald-600 text-white"
            size="icon"
          >
            <Search className="size-6" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm mx-4 bg-[#1a3d4d] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">ค้นหาผลหวย</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="ชื่อหวย เช่น ลาว, ฮานอย..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-base bg-white/10 border-white/20 text-white placeholder:text-gray-400"
            />
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1 border-white/20 text-white hover:bg-white/10"
                onClick={() => {
                  setSearchQuery('');
                  setSearchOpen(false);
                }}
              >
                ล้าง
              </Button>
              <Button 
                className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                onClick={() => setSearchOpen(false)}
              >
                ค้นหา
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
