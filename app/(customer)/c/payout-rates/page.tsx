'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Trophy } from 'lucide-react';

interface PayoutRate {
  id: string;
  lottery_id: string;
  entry_type: string;
  rate: number;
  lottery?: {
    name: string;
  };
}

interface Lottery {
  id: string;
  name: string;
  type: string;
}

const entryTypeLabels: Record<string, string> = {
  three_top: '3 ตัวบน',
  three_tod: '3 ตัวโต๊ด',
  three_front: '3 ตัวหน้า',
  three_bottom: '3 ตัวล่าง',
  two_top: '2 ตัวบน',
  two_bottom: '2 ตัวล่าง',
  run_top: 'วิ่งบน',
  run_bottom: 'วิ่งล่าง',
};

export default function PayoutRatesPage() {
  const router = useRouter();
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [rates, setRates] = useState<PayoutRate[]>([]);
  const [selectedLottery, setSelectedLottery] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [lotteriesRes, ratesRes] = await Promise.all([
        fetch('/api/lotteries?status=open'),
        fetch('/api/payout-rates'),
      ]);
      const lotteriesData = await lotteriesRes.json();
      const ratesData = await ratesRes.json();
      
      setLotteries(lotteriesData.lotteries || []);
      setRates(ratesData.rates || []);
      
      if (lotteriesData.lotteries?.length > 0) {
        setSelectedLottery(lotteriesData.lotteries[0].id);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRates = rates.filter(r => r.lottery_id === selectedLottery);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-semibold">อัตราจ่าย</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Banner */}
        <div className="bg-gradient-to-r from-amber-500 to-yellow-500 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3">
            <Trophy className="size-10" />
            <div>
              <h2 className="text-xl font-bold">อัตราจ่ายสูงสุด</h2>
              <p className="text-white/80">จ่ายจริง จ่ายเต็ม ไม่มีหัก</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl h-20 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Lottery Tabs */}
            <div className="overflow-x-auto -mx-4 px-4">
              <div className="flex gap-2 min-w-max pb-2">
                {lotteries.map((lottery) => (
                  <Button
                    key={lottery.id}
                    variant={selectedLottery === lottery.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedLottery(lottery.id)}
                    className={selectedLottery === lottery.id ? 'bg-blue-500' : ''}
                  >
                    {lottery.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Rates Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {lotteries.find(l => l.id === selectedLottery)?.name || 'อัตราจ่าย'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(entryTypeLabels).map(([type, label]) => {
                    const rate = filteredRates.find(r => r.entry_type === type);
                    return (
                      <div 
                        key={type}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                      >
                        <span className="font-medium">{label}</span>
                        <span className="text-lg font-bold text-green-600">
                          {rate ? `x ${rate.rate}` : '-'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Note */}
            <p className="text-xs text-gray-500 text-center">
              * อัตราจ่ายอาจมีการเปลี่ยนแปลงตามประกาศของบริษัท
            </p>
          </>
        )}
      </div>
    </div>
  );
}
