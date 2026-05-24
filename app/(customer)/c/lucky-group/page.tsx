'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  Star, 
  TrendingUp, 
  Clock, 
  ChevronRight, 
  Search,
  Crown,
  Flame,
  Heart,
  Copy,
  Check
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

// Sample lucky number groups
const luckyGroups = [
  {
    id: '1',
    name: 'เซียนหวยออนไลน์',
    description: 'กลุ่มเซียนหวยคัดสรรเลขเด็ดทุกงวด',
    members: 15840,
    winRate: 68,
    isHot: true,
    isVip: true,
    numbers: [
      { type: '3 ตัวบน', numbers: ['142', '241', '412'] },
      { type: '2 ตัวบน', numbers: ['42', '24', '14'] },
    ],
    lastUpdated: '2 ชม. ที่แล้ว'
  },
  {
    id: '2',
    name: 'หวยเด็ดแม่นๆ',
    description: 'รวมเลขเด็ดจากสูตรคำนวณ',
    members: 8920,
    winRate: 55,
    isHot: true,
    isVip: false,
    numbers: [
      { type: '3 ตัวบน', numbers: ['789', '987', '879'] },
      { type: '2 ตัวล่าง', numbers: ['89', '78', '97'] },
    ],
    lastUpdated: '5 ชม. ที่แล้ว'
  },
  {
    id: '3',
    name: 'เลขดังประจำวัน',
    description: 'อัพเดทเลขเด็ดทุกวัน ตามกระแส',
    members: 12350,
    winRate: 52,
    isHot: false,
    isVip: false,
    numbers: [
      { type: '2 ตัวบน', numbers: ['56', '65', '55'] },
      { type: 'วิ่งบน', numbers: ['5', '6'] },
    ],
    lastUpdated: '30 นาที ที่แล้ว'
  },
  {
    id: '4',
    name: 'สูตรหวยยี่กี',
    description: 'เลขเด็ดสำหรับหวยยี่กี ออกบ่อย',
    members: 6780,
    winRate: 48,
    isHot: false,
    isVip: true,
    numbers: [
      { type: '2 ตัวบน', numbers: ['23', '32', '22'] },
      { type: '2 ตัวล่าง', numbers: ['45', '54', '44'] },
    ],
    lastUpdated: '1 ชม. ที่แล้ว'
  },
  {
    id: '5',
    name: 'หวยฮานอยพิเศษ',
    description: 'เลขเด็ดหวยฮานอย แม่นๆ',
    members: 9210,
    winRate: 62,
    isHot: true,
    isVip: false,
    numbers: [
      { type: '3 ตัวบน', numbers: ['567', '765', '675'] },
      { type: '2 ตัวบน', numbers: ['67', '76', '56'] },
    ],
    lastUpdated: '4 ชม. ที่แล้ว'
  }
];

export default function LuckyGroupPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  const filteredGroups = luckyGroups.filter(group => 
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopyNumber = (number: string) => {
    navigator.clipboard.writeText(number);
    setCopiedNumber(number);
    toast.success(`คัดลอกเลข ${number} แล้ว`);
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2 text-white">
          <Users className="size-5 text-amber-400" />
          กลุ่มเลขเด็ด
        </h1>
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
          {luckyGroups.length} กลุ่ม
        </Badge>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#64748B]" />
        <Input
          placeholder="ค้นหากลุ่มเลขเด็ด..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-[#0D1321] border-amber-500/20 text-white placeholder:text-[#64748B] focus:border-amber-500/50"
        />
      </div>

      {/* Groups List */}
      <div className="space-y-3">
        {filteredGroups.map((group) => (
          <Card key={group.id} className="bg-[#0D1321] border-amber-500/10 overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`size-10 rounded-xl flex items-center justify-center ${
                    group.isVip 
                      ? 'bg-gradient-to-br from-amber-500 to-orange-600' 
                      : 'bg-gradient-to-br from-cyan-500 to-blue-600'
                  }`}>
                    {group.isVip ? (
                      <Crown className="size-5 text-white" />
                    ) : (
                      <Users className="size-5 text-white" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base text-white flex items-center gap-2">
                      {group.name}
                      {group.isHot && (
                        <Flame className="size-4 text-orange-500" />
                      )}
                    </CardTitle>
                    <p className="text-xs text-[#64748B]">{group.description}</p>
                  </div>
                </div>
                {group.isVip && (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                    VIP
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Stats */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1 text-[#94A3B8]">
                  <Users className="size-3" />
                  <span>{group.members.toLocaleString()} สมาชิก</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-400">
                  <TrendingUp className="size-3" />
                  <span>ถูก {group.winRate}%</span>
                </div>
                <div className="flex items-center gap-1 text-[#64748B]">
                  <Clock className="size-3" />
                  <span>{group.lastUpdated}</span>
                </div>
              </div>

              {/* Numbers */}
              <div className="space-y-2">
                {group.numbers.map((numGroup, idx) => (
                  <div key={idx} className="bg-[#0A0F1C] rounded-lg p-2">
                    <p className="text-[10px] text-amber-400/70 mb-1.5">{numGroup.type}</p>
                    <div className="flex flex-wrap gap-2">
                      {numGroup.numbers.map((num, numIdx) => (
                        <button
                          key={numIdx}
                          onClick={() => handleCopyNumber(num)}
                          className="group relative px-3 py-1.5 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg hover:border-amber-500/50 transition-all"
                        >
                          <span className="font-mono font-bold text-lg text-amber-400">{num}</span>
                          <span className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {copiedNumber === num ? (
                              <Check className="size-3 text-emerald-400" />
                            ) : (
                              <Copy className="size-3 text-amber-400" />
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <Link href={`/c/buy`} className="flex-1">
                  <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-black font-bold text-sm">
                    <Star className="size-4 mr-1.5" />
                    แทงเลยนี้
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                >
                  <Heart className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredGroups.length === 0 && (
        <Card className="bg-[#0D1321] border-amber-500/10">
          <CardContent className="py-12 text-center">
            <Users className="size-16 text-amber-500/30 mx-auto mb-4" />
            <p className="text-white font-medium mb-1">ไม่พบกลุ่มที่ค้นหา</p>
            <p className="text-sm text-[#64748B]">ลองค้นหาด้วยคำอื่น</p>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Star className="size-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white mb-1">เลขเด็ดจากกลุ่มชั้นนำ</p>
              <p className="text-xs text-[#94A3B8]">
                รวบรวมเลขเด็ดจากหลายกลุ่ม คัดสรรโดยทีมงาน อัพเดททุกวัน
                กดที่ตัวเลขเพื่อคัดลอกไปแทง
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
