'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, TrendingUp, Shield, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BetEntry {
  number: string;
  betType: string;
  amount: number;
}

interface RiskAnalysisProps {
  entries: BetEntry[];
  payoutRates?: Record<string, number>;
  className?: string;
}

const DEFAULT_PAYOUT_RATES: Record<string, number> = {
  '2top': 90,
  '2bot': 90,
  '3top': 900,
  '3tod': 150,
  '1top': 3.2,
  '1bot': 4.2,
};

export function RiskAnalysis({ entries, payoutRates = DEFAULT_PAYOUT_RATES, className }: RiskAnalysisProps) {
  // Calculate statistics
  const stats = useMemo(() => {
    const totalBet = entries.reduce((sum, e) => sum + e.amount, 0);
    const totalEntries = entries.length;
    
    // Group by number to find hot numbers
    const numberGroups: Record<string, { amount: number; maxPayout: number; types: string[] }> = {};
    entries.forEach(e => {
      if (!numberGroups[e.number]) {
        numberGroups[e.number] = { amount: 0, maxPayout: 0, types: [] };
      }
      numberGroups[e.number].amount += e.amount;
      const payout = (payoutRates[e.betType] || 0) * e.amount;
      if (payout > numberGroups[e.number].maxPayout) {
        numberGroups[e.number].maxPayout = payout;
      }
      if (!numberGroups[e.number].types.includes(e.betType)) {
        numberGroups[e.number].types.push(e.betType);
      }
    });

    // Find high risk numbers (top 5 by potential payout)
    const sortedByRisk = Object.entries(numberGroups)
      .map(([number, data]) => ({ number, ...data }))
      .sort((a, b) => b.maxPayout - a.maxPayout)
      .slice(0, 5);

    // Calculate max exposure (worst case if all win)
    const maxExposure = entries.reduce((sum, e) => {
      const rate = payoutRates[e.betType] || 0;
      return sum + (e.amount * rate);
    }, 0);

    // Group by bet type
    const typeGroups: Record<string, { count: number; amount: number }> = {};
    entries.forEach(e => {
      if (!typeGroups[e.betType]) {
        typeGroups[e.betType] = { count: 0, amount: 0 };
      }
      typeGroups[e.betType].count++;
      typeGroups[e.betType].amount += e.amount;
    });

    // Risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (maxExposure > 100000) riskLevel = 'critical';
    else if (maxExposure > 50000) riskLevel = 'high';
    else if (maxExposure > 20000) riskLevel = 'medium';

    return {
      totalBet,
      totalEntries,
      maxExposure,
      riskLevel,
      highRiskNumbers: sortedByRisk,
      typeGroups,
      uniqueNumbers: Object.keys(numberGroups).length,
    };
  }, [entries, payoutRates]);

  const riskColors = {
    low: 'text-green-400 bg-green-900/30 border-green-500/30',
    medium: 'text-yellow-400 bg-yellow-900/30 border-yellow-500/30',
    high: 'text-orange-400 bg-orange-900/30 border-orange-500/30',
    critical: 'text-red-400 bg-red-900/30 border-red-500/30',
  };

  const riskLabels = {
    low: 'ความเสี่ยงต่ำ',
    medium: 'ความเสี่ยงปานกลาง',
    high: 'ความเสี่ยงสูง',
    critical: 'ความเสี่ยงวิกฤต',
  };

  const betTypeLabels: Record<string, string> = {
    '2top': '2 ตัวบน',
    '2bot': '2 ตัวล่าง',
    '3top': '3 ตัวบน',
    '3tod': '3 ตัวโต๊ด',
    '1top': 'วิ่งบน',
    '1bot': 'วิ่งล่าง',
  };

  if (entries.length === 0) {
    return null;
  }

  return (
    <Card className={cn('border-[#D4AF37]/30 bg-gradient-to-br from-black/80 to-black/60', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#D4AF37]">
            <Shield className="size-5" />
            วิเคราะห์ความเสี่ยง
          </div>
          <Badge className={cn('px-3 py-1', riskColors[stats.riskLevel])}>
            {riskLabels[stats.riskLevel]}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-black/30 border border-gray-700 text-center">
            <p className="text-xs text-gray-500">ยอดรวม</p>
            <p className="text-lg font-bold text-[#D4AF37]">฿{stats.totalBet.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-lg bg-black/30 border border-gray-700 text-center">
            <p className="text-xs text-gray-500">รายการ</p>
            <p className="text-lg font-bold text-white">{stats.totalEntries}</p>
          </div>
          <div className="p-3 rounded-lg bg-black/30 border border-gray-700 text-center">
            <p className="text-xs text-gray-500">เลข</p>
            <p className="text-lg font-bold text-white">{stats.uniqueNumbers}</p>
          </div>
        </div>

        {/* Max Exposure */}
        <div className="p-3 rounded-lg bg-black/30 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className={cn('size-4', stats.riskLevel === 'critical' ? 'text-red-400' : 'text-yellow-400')} />
              <span className="text-sm text-gray-400">Exposure สูงสุด (ถ้าถูกทั้งหมด)</span>
            </div>
            <span className={cn('font-bold', stats.riskLevel === 'critical' ? 'text-red-400' : 'text-[#D4AF37]')}>
              ฿{stats.maxExposure.toLocaleString()}
            </span>
          </div>
          <Progress 
            value={Math.min((stats.maxExposure / 100000) * 100, 100)} 
            className="h-2"
          />
        </div>

        {/* High Risk Numbers */}
        {stats.highRiskNumbers.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target className="size-4 text-[#D4AF37]" />
              <span className="text-sm text-gray-400">เลขความเสี่ยงสูง</span>
            </div>
            <div className="space-y-1.5">
              {stats.highRiskNumbers.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-black/20">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] font-mono text-lg px-3">
                      {item.number}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {item.types.map(t => betTypeLabels[t] || t).join(', ')}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white">฿{item.amount.toLocaleString()}</p>
                    <p className="text-xs text-red-400">ถ้าถูก: ฿{item.maxPayout.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bet Type Distribution */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-[#D4AF37]" />
            <span className="text-sm text-gray-400">สัดส่วนการแทง</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.typeGroups).map(([type, data]) => (
              <Badge key={type} variant="outline" className="border-gray-600 text-gray-300">
                {betTypeLabels[type] || type}: {data.count} ({((data.amount / stats.totalBet) * 100).toFixed(0)}%)
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
