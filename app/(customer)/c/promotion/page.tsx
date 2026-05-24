'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Gift, Sparkles, Clock, CheckCircle } from 'lucide-react';

interface Promotion {
  id: string;
  name: string;
  type: string;
  description: string;
  bonus_type: string;
  bonus_value: number;
  min_deposit: number;
  max_bonus: number;
  start_date: string;
  end_date: string;
  image_url: string;
  is_active: boolean;
}

export default function PromotionPage() {
  const router = useRouter();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      const res = await fetch('/api/promotions?active=true');
      const data = await res.json();
      setPromotions(data.promotions || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      signup_bonus: 'โบนัสสมัครใหม่',
      deposit_bonus: 'โบนัสฝากเงิน',
      cashback: 'คืนยอดเสีย',
      referral_bonus: 'แนะนำเพื่อน',
      special: 'โปรพิเศษ',
    };
    return types[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      signup_bonus: 'bg-green-500',
      deposit_bonus: 'bg-blue-500',
      cashback: 'bg-orange-500',
      referral_bonus: 'bg-purple-500',
      special: 'bg-pink-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-semibold">โปรโมชั่น</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Banner */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="size-8" />
            <div>
              <h2 className="text-xl font-bold">โปรโมชั่นพิเศษ</h2>
              <p className="text-white/80 text-sm">รับโบนัสและสิทธิพิเศษมากมาย</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl h-48 animate-pulse" />
            ))}
          </div>
        ) : promotions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Gift className="size-16 text-gray-300 mb-4" />
              <p className="text-gray-500">ยังไม่มีโปรโมชั่นในขณะนี้</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {promotions.map((promo) => (
              <Card key={promo.id} className="overflow-hidden">
                {promo.image_url && (
                  <div className="h-40 bg-gradient-to-r from-blue-500 to-cyan-500">
                    <img 
                      src={promo.image_url} 
                      alt={promo.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-lg">{promo.name}</h3>
                    <Badge className={getTypeColor(promo.type)}>
                      {getTypeLabel(promo.type)}
                    </Badge>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4">{promo.description}</p>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">โบนัส</p>
                      <p className="font-bold text-green-600">
                        {promo.bonus_type === 'percent' 
                          ? `${promo.bonus_value}%` 
                          : `฿${promo.bonus_value?.toLocaleString()}`}
                      </p>
                    </div>
                    {promo.min_deposit > 0 && (
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500">ฝากขั้นต่ำ</p>
                        <p className="font-bold">฿{promo.min_deposit?.toLocaleString()}</p>
                      </div>
                    )}
                  </div>

                  {promo.end_date && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="size-3" />
                      <span>หมดเขต {new Date(promo.end_date).toLocaleDateString('th-TH')}</span>
                    </div>
                  )}

                  <Button className="w-full mt-4 bg-gradient-to-r from-blue-500 to-cyan-500">
                    <CheckCircle className="size-4 mr-2" />
                    รับโปรโมชั่น
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
