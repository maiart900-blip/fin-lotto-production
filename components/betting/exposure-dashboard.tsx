'use client';

import { useEffect } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Flame,
  AlertTriangle,
  Ban,
  TrendingUp,
  Wallet,
  BarChart3,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface ExposureData {
  totalVolume: number;
  totalBets: number;
  hotNumbers: Array<{
    number: string;
    total: number;
    '2top': number;
    '2bot': number;
    '3top': number;
    '3tod': number;
  }>;
  riskNumbers: Array<{ number: string; total: number }>;
  blockedNumbers: string[];
  maxPotentialPayout: number;
}

interface ExposureDashboardProps {
  lotteryId: string;
  refreshInterval?: number;
}

export function ExposureDashboard({ lotteryId, refreshInterval = 5000 }: ExposureDashboardProps) {
  const { data, isLoading, mutate } = useSWR<ExposureData>(
    lotteryId ? `/api/exposure?lottery_id=${lotteryId}` : null,
    fetcher,
    { refreshInterval }
  );

  // Auto-refresh on focus
  useEffect(() => {
    const handleFocus = () => mutate();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [mutate]);

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          กำลังโหลด...
        </CardContent>
      </Card>
    );
  }

  const maxExposure = data.hotNumbers[0]?.total || 0;

  return (
    <div className="space-y-3">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-blue-400" />
              <span className="text-xs text-muted-foreground">ยอดรวม</span>
            </div>
            <p className="text-lg font-bold text-blue-400">{formatCurrency(data.totalVolume)}</p>
            <p className="text-xs text-muted-foreground">{data.totalBets} รายการ</p>
          </CardContent>
        </Card>
        
        <Card className="bg-orange-500/10 border-orange-500/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-orange-400" />
              <span className="text-xs text-muted-foreground">จ่ายสูงสุด</span>
            </div>
            <p className="text-lg font-bold text-orange-400">{formatCurrency(data.maxPotentialPayout)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Hot Numbers */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Flame className="size-4 text-red-400" />
            เลขยอดนิยม
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="h-40">
            <div className="space-y-2">
              {data.hotNumbers.map((item, i) => (
                <div key={item.number} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={i < 3 ? 'default' : 'secondary'}
                        className={cn(
                          "font-mono",
                          i === 0 && "bg-red-500",
                          i === 1 && "bg-orange-500",
                          i === 2 && "bg-yellow-500"
                        )}
                      >
                        {item.number}
                      </Badge>
                      {data.blockedNumbers.includes(item.number) && (
                        <Ban className="size-3 text-red-500" />
                      )}
                    </div>
                    <span className="font-medium">{formatCurrency(item.total)}</span>
                  </div>
                  <Progress 
                    value={(item.total / maxExposure) * 100} 
                    className="h-1"
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Risk Numbers */}
      {data.riskNumbers.length > 0 && (
        <Card className="border-red-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-red-400">
              <AlertTriangle className="size-4" />
              เลขเสี่ยง ({data.riskNumbers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-1">
              {data.riskNumbers.map((item) => (
                <Badge key={item.number} variant="destructive" className="font-mono">
                  {item.number}: {formatCurrency(item.total)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Blocked Numbers */}
      {data.blockedNumbers.length > 0 && (
        <Card className="border-gray-500/50 bg-gray-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-gray-400">
              <Ban className="size-4" />
              เลขอั้น ({data.blockedNumbers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-1">
              {data.blockedNumbers.map((num) => (
                <Badge key={num} variant="outline" className="font-mono bg-gray-500/20">
                  {num}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
