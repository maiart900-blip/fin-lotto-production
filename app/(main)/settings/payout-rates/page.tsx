'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Save, 
  RefreshCw, 
  DollarSign,
  Ticket,
  Settings,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { BetType, BET_TYPE_LABELS } from '@/types/lottery';

interface Lottery {
  id: string;
  name: string;
  icon?: string;
}

interface PayoutRate {
  id: string;
  lottery_id: string;
  bet_type: BetType;
  rate: number;
  lottery?: Lottery;
}

// Default rates for reference
const DEFAULT_RATES: Record<BetType, number> = {
  '3top': 900,
  '3tod': 150,
  '3flip': 150,
  '2top': 90,
  '2bot': 90,
  '2flip': 90,
  '1top': 3.2,
  '1bot': 4.2,
  'win2': 90,
  'win3': 150,
};

// Bet types grouped
const BET_TYPE_GROUPS = [
  { label: '3 ตัว', types: ['3top', '3tod', '3flip'] as BetType[] },
  { label: '2 ตัว', types: ['2top', '2bot', '2flip'] as BetType[] },
  { label: 'วิ่ง', types: ['1top', '1bot'] as BetType[] },
];

export default function PayoutRatesPage() {
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [payoutRates, setPayoutRates] = useState<PayoutRate[]>([]);
  const [selectedLotteryId, setSelectedLotteryId] = useState<string>('');
  const [editedRates, setEditedRates] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch lotteries
  useEffect(() => {
    const fetchLotteries = async () => {
      try {
        const res = await fetch('/api/lotteries');
        const data = await res.json();
        // Handle empty data gracefully
        const lotteriesData = Array.isArray(data) ? data : [];
        setLotteries(lotteriesData);
        if (lotteriesData.length > 0 && !selectedLotteryId) {
          setSelectedLotteryId(lotteriesData[0].id);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('[v0] Error fetching lotteries:', error);
        setLotteries([]);
        setIsLoading(false);
      }
    };
    fetchLotteries();
  }, [selectedLotteryId]);

  // Fetch payout rates
  const fetchPayoutRates = useCallback(async () => {
    if (!selectedLotteryId) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`/api/payout-rates?lottery_id=${selectedLotteryId}`);
      const data = await res.json();
      setPayoutRates(data);
      
      // Initialize edited rates
      const rates: Record<string, number> = {};
      data.forEach((r: PayoutRate) => {
        rates[r.bet_type] = r.rate;
      });
      
      // Add default rates for any missing bet types
      Object.keys(DEFAULT_RATES).forEach((bt) => {
        if (rates[bt] === undefined) {
          rates[bt] = DEFAULT_RATES[bt as BetType];
        }
      });
      
      setEditedRates(rates);
      setHasChanges(false);
    } catch (error) {
      console.error('Error fetching payout rates:', error);
      toast.error('ไม่สามารถโหลดเรทจ่ายได้');
    } finally {
      setIsLoading(false);
    }
  }, [selectedLotteryId]);

  useEffect(() => {
    fetchPayoutRates();
  }, [fetchPayoutRates]);

  // Handle rate change
  const handleRateChange = (betType: BetType, value: string) => {
    const numValue = parseFloat(value) || 0;
    setEditedRates(prev => ({ ...prev, [betType]: numValue }));
    setHasChanges(true);
  };

  // Save rates
  const handleSave = async () => {
    if (!selectedLotteryId) return;
    
    setIsSaving(true);
    try {
      const rates = Object.entries(editedRates).map(([bet_type, rate]) => ({
        bet_type,
        rate,
      }));

      const res = await fetch('/api/payout-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lottery_id: selectedLotteryId, rates }),
      });

      if (!res.ok) throw new Error('Failed to save');

      toast.success('บันทึกเรทจ่ายเรียบร้อย');
      setHasChanges(false);
      fetchPayoutRates();
    } catch (error) {
      console.error('Error saving payout rates:', error);
      toast.error('ไม่สามารถบันทึกเรทจ่ายได้');
    } finally {
      setIsSaving(false);
    }
  };

  // Copy rates to all lotteries
  const handleCopyToAll = async () => {
    if (!confirm('คัดลอกเรทจ่ายนี้ไปยังหวยทั้งหมด?')) return;
    
    setIsSaving(true);
    try {
      const rates = Object.entries(editedRates).map(([bet_type, rate]) => ({
        bet_type,
        rate,
      }));

      // Save to all lotteries
      for (const lottery of lotteries) {
        await fetch('/api/payout-rates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lottery_id: lottery.id, rates }),
        });
      }

      toast.success('คัดลอกเรทจ่ายไปยังหวยทั้งหมดเรียบร้อย');
    } catch (error) {
      console.error('Error copying rates:', error);
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to defaults
  const handleResetDefaults = () => {
    setEditedRates({ ...DEFAULT_RATES });
    setHasChanges(true);
  };

  const selectedLottery = lotteries.find(l => l.id === selectedLotteryId);

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="size-6 text-accent" />
            ตั้งค่าเรทจ่าย
          </h1>
          <p className="text-muted-foreground">กำหนดอัตราจ่ายสำหรับแต่ละหวยและประเภทการเดิมพัน</p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleResetDefaults}
            disabled={isSaving}
          >
            <RefreshCw className="size-4 mr-2" />
            รีเซ็ตค่าเริ่มต้น
          </Button>
          <Button 
            variant="outline" 
            onClick={handleCopyToAll}
            disabled={isSaving || !hasChanges}
          >
            <Copy className="size-4 mr-2" />
            คัดลอกไปทุกหวย
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
          >
            {isSaving ? (
              <RefreshCw className="size-4 mr-2 animate-spin" />
            ) : (
              <Save className="size-4 mr-2" />
            )}
            บันทึก
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-2">
          <AlertTriangle className="size-5 text-yellow-500" />
          <span className="text-yellow-500">มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Lottery List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Ticket className="size-5" />
              เลือกหวย
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="p-2 space-y-1">
                {lotteries.map(lottery => (
                  <button
                    key={lottery.id}
                    onClick={() => {
                      if (hasChanges) {
                        if (confirm('มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการเปลี่ยนหวยหรือไม่?')) {
                          setSelectedLotteryId(lottery.id);
                        }
                      } else {
                        setSelectedLotteryId(lottery.id);
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedLotteryId === lottery.id
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-secondary'
                    }`}
                  >
                    {lottery.name}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Rate Editor */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="size-5" />
              เรทจ่าย - {selectedLottery?.name || 'เลือกหวย'}
            </CardTitle>
            <CardDescription>
              กำหนดอัตราจ่ายเป็นจำนวนเท่าของเงินเดิมพัน (เช่น 90 = จ่าย 90 บาทต่อ 1 บาท)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                {BET_TYPE_GROUPS.map(group => (
                  <div key={group.label}>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Badge variant="outline">{group.label}</Badge>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {group.types.map(betType => (
                        <div key={betType} className="space-y-2">
                          <Label className="text-sm text-muted-foreground">
                            {BET_TYPE_LABELS[betType]}
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={editedRates[betType] || ''}
                              onChange={(e) => handleRateChange(betType, e.target.value)}
                              className="font-mono text-lg"
                            />
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              เท่า
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            ค่าเริ่มต้น: {DEFAULT_RATES[betType]}
                          </p>
                        </div>
                      ))}
                    </div>
                    <Separator className="mt-4" />
                  </div>
                ))}

                {/* Preview */}
                <div className="p-4 rounded-lg bg-secondary/50 border">
                  <h3 className="font-semibold mb-3">ตัวอย่างการจ่าย (เดิมพัน 100 บาท)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {Object.entries(editedRates).map(([betType, rate]) => (
                      <div key={betType} className="flex justify-between p-2 rounded bg-background">
                        <span className="text-muted-foreground">{BET_TYPE_LABELS[betType as BetType]}</span>
                        <span className="font-mono font-bold text-accent">
                          {(rate * 100).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
