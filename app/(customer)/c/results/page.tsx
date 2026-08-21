'use client';

import { useState, useEffect } from 'react';
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
  // Thai Government Lottery
  first_prize?: string;
  three_front_1?: string;
  three_front_2?: string;
  three_bottom_1?: string;
  three_bottom_2?: string;
  two_bottom?: string;
  // General Lottery
  three_digit_top?: string;
  three_top?: string;
  two_digit_bot?: string;
  three_tod?: string;
  run_top?: string;
  run_bottom?: string;
}

// Flag mapping
const flagMap: Record<string, string> = {
  'thai': '🇹🇭',
  'thailand': '🇹🇭',
  'รัฐบาล': '🇹🇭',
  'ออมสิน': '🇹🇭',
  'ธกส': '🇹🇭',
  'laos': '🇱🇦',
  'lao': '🇱🇦',
  'ลาว': '🇱🇦',
  'hanoi': '🇻🇳',
  'vietnam': '🇻🇳',
  'ฮานอย': '🇻🇳',
  'เวียดนาม': '🇻🇳',
  'malaysia': '🇲🇾',
  'มาเลย์': '🇲🇾',
  'singapore': '🇸🇬',
  'สิงคโปร์': '🇸🇬',
  'hongkong': '🇭🇰',
  'ฮ่องกง': '🇭🇰',
  'korea': '🇰🇷',
  'เกาหลี': '🇰🇷',
  'japan': '🇯🇵',
  'ญี่ปุ่น': '🇯🇵',
  'china': '🇨🇳',
  'จีน': '🇨🇳',
  'taiwan': '🇹🇼',
  'ไต้หวัน': '🇹🇼',
  'india': '🇮🇳',
  'อินเดีย': '🇮🇳',
  'russia': '🇷🇺',
  'รัสเซีย': '🇷🇺',
  'germany': '🇩🇪',
  'เยอรมัน': '🇩🇪',
  'england': '🇬🇧',
  'uk': '🇬🇧',
  'อังกฤษ': '🇬🇧',
  'usa': '🇺🇸',
  'dow': '🇺🇸',
  'nasdaq': '🇺🇸',
  'อเมริกา': '🇺🇸',
  'nikki': '🇯🇵',
  'nikkei': '🇯🇵',
  'หุ้น': '📈',
  'stock': '📈',
  'yeekee': '🎲',
  'ยี่กี': '🎲',
  'pingpong': '🏓',
  'ปิงปอง': '🏓',
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

// Thai Government Lottery Card
const ThaiGovernmentCard = ({ result }: { result: LotteryResult }) => {
  const name = result.lottery?.name || result.lottery_name || 'หวยรัฐบาลไทย';
  const isAnnounced = result.status === 'announced' || result.first_prize;

  return (
    <Card className="overflow-hidden bg-white border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="p-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getFlag(name)}</span>
          <div className="flex-1">
            <h3 className="font-semibold text-[#8B0000]">{name}</h3>
            <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600">
              {result.result_day_label || formatThaiDate(result.draw_date)}
            </Badge>
          </div>
          {isAnnounced ? (
            <Badge className="bg-green-500 text-white text-xs">
              <CheckCircle2 className="size-3 mr-1" />
              ออกผลแล้ว
            </Badge>
          ) : (
            <Badge variant="outline" className="text-orange-500 border-orange-300 text-xs">
              <Clock className="size-3 mr-1" />
              รอผล
            </Badge>
          )}
        </div>
      </div>

      {/* Results */}
      <CardContent className="p-3 space-y-3">
        {/* รางวัลที่ 1 */}
        <div className="text-center p-3 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200">
          <p className="text-xs text-gray-500 mb-1">รางวัลที่ 1</p>
          <p className="text-4xl font-bold text-[#8B0000] tracking-widest">
            {result.first_prize || '------'}
          </p>
        </div>

        {/* 3 ตัว และ 2 ตัว */}
        <div className="grid grid-cols-3 gap-2">
          {/* 3 ตัวหน้า */}
          <div className="text-center p-2 rounded-lg bg-[#006B4F] text-white">
            <p className="text-[10px] mb-1 opacity-80">3 ตัวหน้า</p>
            <div className="space-y-1">
              <p className="text-lg font-bold tracking-wider">
                {result.three_front_1 || '---'}
              </p>
              <p className="text-lg font-bold tracking-wider">
                {result.three_front_2 || '---'}
              </p>
            </div>
          </div>

          {/* 3 ตัวล่าง */}
          <div className="text-center p-2 rounded-lg bg-[#006B4F] text-white">
            <p className="text-[10px] mb-1 opacity-80">3 ตัวล่าง</p>
            <div className="space-y-1">
              <p className="text-lg font-bold tracking-wider">
                {result.three_bottom_1 || '---'}
              </p>
              <p className="text-lg font-bold tracking-wider">
                {result.three_bottom_2 || '---'}
              </p>
            </div>
          </div>

          {/* 2 ตัวล่าง */}
          <div className="text-center p-2 rounded-lg bg-[#006B4F] text-white">
            <p className="text-[10px] mb-1 opacity-80">2 ตัวล่าง</p>
            <p className="text-2xl font-bold tracking-wider mt-2">
              {result.two_bottom || '--'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// General Lottery Card
const GeneralLotteryCard = ({ result }: { result: LotteryResult }) => {
  const name = result.lottery?.name || result.lottery_name || 'หวย';
  const threeTop = result.three_top || result.three_digit_top;
  const twoBottom = result.two_bottom || result.two_digit_bot;
  const isAnnounced = result.status === 'announced' || threeTop;

  return (
    <Card className="overflow-hidden bg-white border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="p-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getFlag(name)}</span>
          <div className="flex-1">
            <h3 className="font-semibold text-[#8B0000]">{name}</h3>
            <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600">
              {result.result_day_label || formatThaiDate(result.draw_date)}
            </Badge>
          </div>
          {isAnnounced ? (
            <Badge className="bg-green-500 text-white text-xs">
              <CheckCircle2 className="size-3 mr-1" />
              ออกผลแล้ว
            </Badge>
          ) : (
            <Badge variant="outline" className="text-orange-500 border-orange-300 text-xs">
              <Clock className="size-3 mr-1" />
              รอผล
            </Badge>
          )}
        </div>
      </div>

      {/* Results */}
      <CardContent className="p-3">
        <div className="grid grid-cols-2 gap-2">
          {/* 3 ตัวบน */}
          <div className="text-center p-3 rounded-lg bg-[#006B4F] text-white">
            <p className="text-xs mb-1 opacity-80">3 ตัวบน</p>
            <p className="text-3xl font-bold tracking-widest">
              {threeTop || '---'}
            </p>
          </div>

          {/* 2 ตัวล่าง */}
          <div className="text-center p-3 rounded-lg bg-[#006B4F] text-white">
            <p className="text-xs mb-1 opacity-80">2 ตัวล่าง</p>
            <p className="text-3xl font-bold tracking-widest">
              {twoBottom || '--'}
            </p>
          </div>
        </div>

        {/* Additional results */}
        {(result.three_tod || result.run_top || result.run_bottom) && (
          <div className="grid grid-cols-3 gap-2 mt-2">
            {result.three_tod && (
              <div className="text-center p-2 rounded bg-gray-100">
                <p className="text-[10px] text-gray-500">3 ตัวโต๊ด</p>
                <p className="text-sm font-semibold">{result.three_tod}</p>
              </div>
            )}
            {result.run_top && (
              <div className="text-center p-2 rounded bg-gray-100">
                <p className="text-[10px] text-gray-500">วิ่งบน</p>
                <p className="text-sm font-semibold">{result.run_top}</p>
              </div>
            )}
            {result.run_bottom && (
              <div className="text-center p-2 rounded bg-gray-100">
                <p className="text-[10px] text-gray-500">วิ่งล่าง</p>
                <p className="text-sm font-semibold">{result.run_bottom}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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

  // Group results by category
  const groupedResults = results?.reduce((acc, result) => {
    const category = result.lottery_category || result.lottery?.category || 'อื่นๆ';
    if (!acc[category]) acc[category] = [];
    acc[category].push(result);
    return acc;
  }, {} as Record<string, LotteryResult[]>) || {};

  // Filter by search
  const filteredResults = searchQuery 
    ? results?.filter(r => 
        (r.lottery?.name || r.lottery_name || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : results;

  // Category order
  const categoryOrder = ['หวยรัฐบาล', 'หวยออมสิน', 'หวย ธกส', 'หวยลาว', 'หวยฮานอย', 'หวยหุ้น', 'หวยต่างประเทศ', 'อื่นๆ'];

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/c">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ChevronLeft className="size-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">ผลรางวัล</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => mutate()}
            disabled={isLoading}
          >
            <RefreshCw className={`size-5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Date Picker */}
      <div className="bg-white px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
            <Calendar className="size-4 text-gray-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1 bg-transparent border-none focus:outline-none text-gray-900 text-sm"
            />
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
          >
            ผลล่าสุด
          </Button>
        </div>
        <p className="text-center text-sm text-gray-500 mt-2">
          {formatThaiDate(selectedDate)}
        </p>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="size-10 animate-spin text-cyan-500 mb-3" />
            <p className="text-gray-500">กำลังโหลดผลหวย...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6 text-center">
              <p className="text-red-600 mb-3">ไม่สามารถโหลดผลหวยได้</p>
              <Button variant="outline" size="sm" onClick={() => mutate()}>
                ลองอีกครั้ง
              </Button>
            </CardContent>
          </Card>
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
              <Card className="bg-white">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                    <Trophy className="size-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium">ยังไม่มีผลหวยในวันที่เลือก</p>
                  <p className="text-sm text-gray-400 mt-1">กรุณาเลือกวันอื่น หรือรอผลประกาศ</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Floating Search Button */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogTrigger asChild>
          <Button
            className="fixed bottom-24 right-4 size-14 rounded-full shadow-lg bg-cyan-500 hover:bg-cyan-600 text-white"
            size="icon"
          >
            <Search className="size-6" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>ค้นหาผลหวย</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="ชื่อหวย เช่น ลาว, ฮานอย..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-base"
            />
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setSearchQuery('');
                  setSearchOpen(false);
                }}
              >
                ล้าง
              </Button>
              <Button 
                className="flex-1 bg-cyan-500 hover:bg-cyan-600"
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
