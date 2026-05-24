'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Gift, Sparkles, Clock, CheckCircle, Calendar, Percent, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Promotion {
  id: string;
  name: string;
  type: string;
  description: string;
  bonus_type: string;
  bonus_value: number;
  min_deposit: number;
  max_bonus: number;
  turnover_multiplier: number;
  start_date: string;
  end_date: string;
  image_url: string;
  is_active: boolean;
  once_per_user: boolean;
}

export default function PromotionsPage() {
  const router = useRouter();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/promotions?active=true');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setPromotions(Array.isArray(data) ? data : data.promotions || []);
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      signup_bonus: 'สมัครใหม่',
      deposit_bonus: 'โบนัสฝาก',
      cashback: 'คืนยอดเสีย',
      referral_bonus: 'แนะนำเพื่อน',
      special: 'โปรพิเศษ',
    };
    return types[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      signup_bonus: 'from-emerald-500 to-green-600',
      deposit_bonus: 'from-blue-500 to-cyan-500',
      cashback: 'from-orange-500 to-amber-500',
      referral_bonus: 'from-purple-500 to-pink-500',
      special: 'from-rose-500 to-pink-500',
    };
    return colors[type] || 'from-gray-500 to-gray-600';
  };

  const handleClaim = (promo: Promotion) => {
    toast.success(`รับโปรโมชั่น "${promo.name}" สำเร็จ!`);
    setSelectedPromo(null);
  };

  const isExpired = (endDate: string) => {
    if (!endDate) return false;
    return new Date(endDate) < new Date();
  };

  const isNotStarted = (startDate: string) => {
    if (!startDate) return false;
    return new Date(startDate) > new Date();
  };

  return (
    <div className="min-h-screen bg-[#060B14]">
      {/* Header */}
      <div className="bg-[#0A1628]/90 backdrop-blur-xl border-b border-white/10 sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.back()}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-semibold text-white">โปรโมชั่น</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-24">
        {/* Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1D9BF0] to-[#00D4FF] p-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <Sparkles className="size-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">โปรโมชั่นพิเศษ</h2>
              <p className="text-white/80 text-sm">รับโบนัสและสิทธิพิเศษมากมาย</p>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#0A1628] rounded-2xl h-64 animate-pulse border border-white/5" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <Card className="bg-[#0A1628] border-red-500/30">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="size-16 text-red-400 mb-4" />
              <p className="text-red-400 mb-4">{error}</p>
              <Button onClick={fetchPromotions} variant="outline" className="border-white/20 text-white">
                <RefreshCw className="size-4 mr-2" />
                ลองใหม่อีกครั้ง
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loading && !error && promotions.length === 0 && (
          <Card className="bg-[#0A1628] border-white/10">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 rounded-full bg-[#1D9BF0]/10 flex items-center justify-center mb-4">
                <Gift className="size-10 text-[#1D9BF0]" />
              </div>
              <p className="text-white/60 text-lg">ยังไม่มีโปรโมชั่นตอนนี้</p>
              <p className="text-white/40 text-sm mt-1">กรุณากลับมาใหม่ภายหลัง</p>
            </CardContent>
          </Card>
        )}

        {/* Promotions List */}
        {!loading && !error && promotions.length > 0 && (
          <div className="space-y-4">
            {promotions.map((promo) => {
              const expired = isExpired(promo.end_date);
              const notStarted = isNotStarted(promo.start_date);
              
              return (
                <Card 
                  key={promo.id} 
                  className={`overflow-hidden bg-[#0A1628] border-white/10 ${expired ? 'opacity-50' : ''}`}
                >
                  {/* Promo Image/Gradient Header */}
                  <div className={`h-32 bg-gradient-to-r ${getTypeColor(promo.type)} relative`}>
                    {promo.image_url ? (
                      <img 
                        src={promo.image_url} 
                        alt={promo.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="size-16 text-white/30" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      <Badge className={`bg-gradient-to-r ${getTypeColor(promo.type)} text-white border-0`}>
                        {getTypeLabel(promo.type)}
                      </Badge>
                    </div>
                    {expired && (
                      <div className="absolute top-3 right-3">
                        <Badge variant="destructive">หมดอายุแล้ว</Badge>
                      </div>
                    )}
                    {notStarted && (
                      <div className="absolute top-3 right-3">
                        <Badge className="bg-orange-500">เร็วๆ นี้</Badge>
                      </div>
                    )}
                  </div>

                  <CardContent className="p-4 space-y-4">
                    {/* Title & Description */}
                    <div>
                      <h3 className="font-bold text-lg text-white">{promo.name}</h3>
                      <p className="text-white/60 text-sm mt-1 line-clamp-2">{promo.description}</p>
                    </div>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-[#0D1829] rounded-xl p-3 text-center border border-white/5">
                        <Percent className="size-4 mx-auto text-[#1D9BF0] mb-1" />
                        <p className="text-xs text-white/50">โบนัส</p>
                        <p className="font-bold text-[#00D4FF]">
                          {promo.bonus_type === 'percent' 
                            ? `${promo.bonus_value}%` 
                            : `฿${promo.bonus_value?.toLocaleString()}`}
                        </p>
                      </div>
                      {promo.min_deposit > 0 && (
                        <div className="bg-[#0D1829] rounded-xl p-3 text-center border border-white/5">
                          <Gift className="size-4 mx-auto text-emerald-400 mb-1" />
                          <p className="text-xs text-white/50">ฝากขั้นต่ำ</p>
                          <p className="font-bold text-white">฿{promo.min_deposit?.toLocaleString()}</p>
                        </div>
                      )}
                      {promo.max_bonus > 0 && (
                        <div className="bg-[#0D1829] rounded-xl p-3 text-center border border-white/5">
                          <Sparkles className="size-4 mx-auto text-amber-400 mb-1" />
                          <p className="text-xs text-white/50">รับสูงสุด</p>
                          <p className="font-bold text-amber-400">฿{promo.max_bonus?.toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    {/* Conditions */}
                    {promo.turnover_multiplier > 1 && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                        <p className="text-amber-400 text-xs">
                          เงื่อนไข: ต้องทำยอด {promo.turnover_multiplier} เท่าก่อนถอน
                        </p>
                      </div>
                    )}

                    {/* Date Range */}
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <Calendar className="size-3" />
                      {promo.start_date && (
                        <span>เริ่ม {new Date(promo.start_date).toLocaleDateString('th-TH')}</span>
                      )}
                      {promo.start_date && promo.end_date && <span>-</span>}
                      {promo.end_date && (
                        <span>หมดเขต {new Date(promo.end_date).toLocaleDateString('th-TH')}</span>
                      )}
                    </div>

                    {/* Claim Button */}
                    <Button 
                      className="w-full bg-gradient-to-r from-[#1D9BF0] to-[#00D4FF] text-white font-semibold shadow-lg shadow-[#1D9BF0]/25 hover:shadow-[#1D9BF0]/40 transition-all"
                      disabled={expired || notStarted}
                      onClick={() => handleClaim(promo)}
                    >
                      <CheckCircle className="size-4 mr-2" />
                      {expired ? 'หมดอายุแล้ว' : notStarted ? 'ยังไม่เริ่ม' : 'รับโปรโมชั่น'}
                    </Button>

                    {promo.once_per_user && (
                      <p className="text-center text-xs text-white/30">* รับได้ 1 ครั้งต่อคน</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
