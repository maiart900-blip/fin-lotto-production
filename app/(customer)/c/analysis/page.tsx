'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, TrendingUp, Flame, BarChart3 } from 'lucide-react';

interface NumberStat {
  number: string;
  count: number;
  percentage: number;
}

export default function AnalysisPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'2d' | '3d'>('2d');
  const [hotNumbers, setHotNumbers] = useState<NumberStat[]>([]);
  const [coldNumbers, setColdNumbers] = useState<NumberStat[]>([]);

  useEffect(() => {
    fetchAnalysis();
  }, [tab]);

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analysis/hot-cold?digit_type=${tab === '2d' ? '2' : '3'}&limit=10`);
      const data = await res.json();
      
      setHotNumbers(data.hot || []);
      setColdNumbers(data.cold || []);
    } catch (error) {
      console.error('Error:', error);
      // Fallback to empty arrays
      setHotNumbers([]);
      setColdNumbers([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-semibold">วิเคราะห์เลข</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Banner */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3">
            <BarChart3 className="size-10" />
            <div>
              <h2 className="text-xl font-bold">สถิติเลขเด็ด</h2>
              <p className="text-white/80 text-sm">วิเคราะห์จากผลย้อนหลัง 30 งวด</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <Button
            variant={tab === '2d' ? 'default' : 'outline'}
            onClick={() => setTab('2d')}
            className={tab === '2d' ? 'bg-blue-500 flex-1' : 'flex-1'}
          >
            2 ตัว
          </Button>
          <Button
            variant={tab === '3d' ? 'default' : 'outline'}
            onClick={() => setTab('3d')}
            className={tab === '3d' ? 'bg-blue-500 flex-1' : 'flex-1'}
          >
            3 ตัว
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl h-48 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Hot Numbers */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Flame className="size-5 text-red-500" />
                  เลขร้อน (ออกบ่อย)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2">
                  {hotNumbers.map((num, i) => (
                    <div 
                      key={i}
                      className="relative bg-gradient-to-br from-red-500 to-orange-500 text-white rounded-lg p-3 text-center"
                    >
                      <span className="text-lg font-bold">{num.number}</span>
                      <Badge className="absolute -top-2 -right-2 bg-yellow-400 text-black text-xs px-1">
                        {num.count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Cold Numbers */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="size-5 text-blue-500" />
                  เลขเย็น (ไม่ค่อยออก)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2">
                  {coldNumbers.map((num, i) => (
                    <div 
                      key={i}
                      className="relative bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-lg p-3 text-center"
                    >
                      <span className="text-lg font-bold">{num.number}</span>
                      <Badge className="absolute -top-2 -right-2 bg-white text-blue-500 text-xs px-1">
                        {num.count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Disclaimer */}
            <p className="text-xs text-gray-500 text-center px-4">
              * ข้อมูลเป็นการวิเคราะห์ทางสถิติเท่านั้น ไม่รับประกันผลลัพธ์
            </p>
          </>
        )}
      </div>
    </div>
  );
}
