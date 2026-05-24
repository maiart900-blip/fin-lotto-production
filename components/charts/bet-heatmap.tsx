'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, TrendingUp, AlertTriangle } from 'lucide-react';

interface BetData {
  number: string;
  amount: number;
  count: number;
}

interface BetHeatmapProps {
  data: BetData[];
  title?: string;
  description?: string;
  maxCells?: number;
}

export function BetHeatmap({ 
  data, 
  title = 'Heatmap ยอดแทง',
  description = 'แสดงเลขที่มีคนแทงเยอะที่สุด',
  maxCells = 100 
}: BetHeatmapProps) {
  // Generate 00-99 grid
  const gridData = useMemo(() => {
    const grid: Record<string, BetData> = {};
    
    // Initialize all numbers 00-99
    for (let i = 0; i < 100; i++) {
      const num = i.toString().padStart(2, '0');
      grid[num] = { number: num, amount: 0, count: 0 };
    }
    
    // Populate with actual data
    data.forEach(item => {
      if (item.number.length === 2 && grid[item.number]) {
        grid[item.number] = item;
      }
    });
    
    return grid;
  }, [data]);

  // Calculate max amount for color scaling
  const maxAmount = useMemo(() => {
    return Math.max(...Object.values(gridData).map(d => d.amount), 1);
  }, [gridData]);

  // Get color based on intensity
  const getColor = (amount: number) => {
    const intensity = amount / maxAmount;
    
    if (intensity === 0) return 'bg-[#1E293B]';
    if (intensity < 0.1) return 'bg-[#1E3A5F]';
    if (intensity < 0.2) return 'bg-[#1E4A6F]';
    if (intensity < 0.3) return 'bg-[#2A5A7F]';
    if (intensity < 0.4) return 'bg-[#3A6A8F]';
    if (intensity < 0.5) return 'bg-[#4A7A9F]';
    if (intensity < 0.6) return 'bg-[#EAB30880]';
    if (intensity < 0.7) return 'bg-[#EAB308A0]';
    if (intensity < 0.8) return 'bg-[#EAB308C0]';
    if (intensity < 0.9) return 'bg-[#EAB308E0]';
    return 'bg-[#EAB308]';
  };

  const getTextColor = (amount: number) => {
    const intensity = amount / maxAmount;
    return intensity > 0.5 ? 'text-[#0F172A]' : 'text-white';
  };

  // Top 5 hottest numbers
  const hotNumbers = useMemo(() => {
    return Object.values(gridData)
      .filter(d => d.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [gridData]);

  return (
    <Card className="bg-[#1E293B]/80 border-[#334155]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Flame className="size-5 text-[#EAB308]" />
              {title}
            </CardTitle>
            <CardDescription className="text-[#94A3B8]">{description}</CardDescription>
          </div>
          <div className="flex gap-2">
            {hotNumbers.slice(0, 3).map((item, i) => (
              <Badge 
                key={item.number}
                className={`${i === 0 ? 'bg-red-500' : i === 1 ? 'bg-orange-500' : 'bg-yellow-500'} text-white`}
              >
                #{i + 1} เลข {item.number}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Heatmap Grid */}
        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: 100 }, (_, i) => {
            const num = i.toString().padStart(2, '0');
            const cellData = gridData[num];
            
            return (
              <div
                key={num}
                className={`
                  aspect-square rounded-md flex items-center justify-center 
                  ${getColor(cellData.amount)} ${getTextColor(cellData.amount)}
                  text-xs font-mono font-bold cursor-pointer
                  transition-all duration-200 hover:scale-110 hover:z-10
                  relative group
                `}
                title={`เลข ${num}: ${cellData.amount.toLocaleString()} บาท (${cellData.count} รายการ)`}
              >
                {num}
                
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  <div className="bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-xl">
                    <p className="text-white font-bold">เลข {num}</p>
                    <p className="text-[#EAB308]">{cellData.amount.toLocaleString()} บาท</p>
                    <p className="text-[#94A3B8]">{cellData.count} รายการ</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#94A3B8]">น้อย</span>
            <div className="flex gap-1">
              {['bg-[#1E293B]', 'bg-[#2A5A7F]', 'bg-[#4A7A9F]', 'bg-[#EAB30880]', 'bg-[#EAB308]'].map((color, i) => (
                <div key={i} className={`size-4 rounded ${color}`} />
              ))}
            </div>
            <span className="text-xs text-[#94A3B8]">มาก</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#94A3B8]">
            <span>รวม: {Object.values(gridData).reduce((sum, d) => sum + d.amount, 0).toLocaleString()} บาท</span>
            <span>|</span>
            <span>{Object.values(gridData).filter(d => d.amount > 0).length} เลขที่มียอด</span>
          </div>
        </div>

        {/* Hot Numbers List */}
        <div className="mt-4 p-4 rounded-xl bg-[#0F172A] border border-[#334155]">
          <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <TrendingUp className="size-4 text-[#EAB308]" />
            Top 5 เลขยอดนิยม
          </h4>
          <div className="grid grid-cols-5 gap-2">
            {hotNumbers.map((item, i) => (
              <div 
                key={item.number}
                className={`
                  p-3 rounded-lg text-center
                  ${i === 0 ? 'bg-gradient-to-br from-red-500/30 to-red-600/20 border border-red-500/50' : 
                    i === 1 ? 'bg-gradient-to-br from-orange-500/30 to-orange-600/20 border border-orange-500/50' :
                    i === 2 ? 'bg-gradient-to-br from-yellow-500/30 to-yellow-600/20 border border-yellow-500/50' :
                    'bg-[#1E293B] border border-[#334155]'}
                `}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  {i < 3 && <Flame className={`size-3 ${i === 0 ? 'text-red-400' : i === 1 ? 'text-orange-400' : 'text-yellow-400'}`} />}
                  <span className="text-2xl font-bold font-mono text-white">{item.number}</span>
                </div>
                <p className="text-xs text-[#EAB308] font-medium">{item.amount.toLocaleString()}</p>
                <p className="text-xs text-[#94A3B8]">{item.count} รายการ</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
