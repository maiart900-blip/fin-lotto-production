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
import { Switch } from '@/components/ui/switch';
import { 
  Save, 
  RefreshCw, 
  DollarSign,
  Ticket,
  Settings,
  Copy,
  AlertTriangle,
  Keyboard,
  Users,
  Percent,
  Calculator,
} from 'lucide-react';
import { toast } from 'sonner';
import { BetType, BET_TYPE_LABELS } from '@/types/lottery';

interface Lottery {
  id: string;
  name: string;
  icon?: string;
}

interface KeyinPayoutRate {
  id: string;
  lottery_id: string;
  bet_type: BetType;
  rate: number;
  is_custom: boolean;
  lottery?: Lottery;
}

// Default rates for keyin (slightly lower than auto)
const DEFAULT_KEYIN_RATES: Record<BetType, number> = {
  '3top': 850,
  '3tod': 140,
  '3flip': 140,
  '2top': 85,
  '2bot': 85,
  '2flip': 85,
  '1top': 3.0,
  '1bot': 4.0,
  'win2': 85,
  'win3': 140,
};

// Bet types grouped
const BET_TYPE_GROUPS = [
  { label: '3 ตัว', types: ['3top', '3tod', '3flip'] as BetType[] },
  { label: '2 ตัว', types: ['2top', '2bot', '2flip'] as BetType[] },
  { label: 'วิ่ง', types: ['1top', '1bot'] as BetType[] },
];

export default function ManualKeyRatesPage() {
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [selectedLotteryId, setSelectedLotteryId] = useState<string>('');
  const [editedRates, setEditedRates] = useState<Record<string, number>>({});
  const [useCustomRates, setUseCustomRates] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch lotteries
  useEffect(() => {
    const fetchLotteries = async () => {
      try {
        const res = await fetch('/api/lotteries');
        const data = await res.json();
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

  // Fetch keyin payout rates
  const fetchKeyinRates = useCallback(async () => {
    if (!selectedLotteryId) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`/api/keyin-rates?lottery_id=${selectedLotteryId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.rates) {
          const rates: Record<string, number> = {};
          data.rates.forEach((r: KeyinPayoutRate) => {
            rates[r.bet_type] = r.rate;
          });
          setEditedRates(rates);
          setUseCustomRates(data.use_custom_rates ?? true);
        } else {
          // Use defaults if no custom rates
          setEditedRates({ ...DEFAULT_KEYIN_RATES });
        }
      } else {
        // Use defaults
        setEditedRates({ ...DEFAULT_KEYIN_RATES });
      }
      setHasChanges(false);
    } catch (error) {
      console.error('Error fetching keyin rates:', error);
      setEditedRates({ ...DEFAULT_KEYIN_RATES });
    } finally {
      setIsLoading(false);
    }
  }, [selectedLotteryId]);

  useEffect(() => {
    fetchKeyinRates();
  }, [fetchKeyinRates]);

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

      const res = await fetch('/api/keyin-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lottery_id: selectedLotteryId, 
          rates,
          use_custom_rates: useCustomRates,
        }),
      });

      if (!res.ok) throw new Error('Failed to save');

      toast.success('บันทึกเรทจ่ายคีย์หวยเรียบร้อย');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving keyin rates:', error);
      toast.error('ไม่สามารถบันทึกเรทจ่ายได้');
    } finally {
      setIsSaving(false);
    }
  };

  // Copy rates to all lotteries
  const handleCopyToAll = async () => {
    if (!confirm('คัดลอกเรทจ่ายคีย์หวยนี้ไปยังหวยทั้งหมด?')) return;
    
    setIsSaving(true);
    try {
      const rates = Object.entries(editedRates).map(([bet_type, rate]) => ({
        bet_type,
        rate,
      }));

      for (const lottery of lotteries) {
        await fetch('/api/keyin-rates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            lottery_id: lottery.id, 
            rates,
            use_custom_rates: useCustomRates,
          }),
        });
      }

      toast.success('คัดลอกเรทจ่ายคีย์หวยไปยังหวยทั้งหมดเรียบร้อย');
    } catch (error) {
      console.error('Error copying rates:', error);
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to defaults
  const handleResetDefaults = () => {
    setEditedRates({ ...DEFAULT_KEYIN_RATES });
    setHasChanges(true);
  };

  const selectedLottery = lotteries.find(l => l.id === selectedLotteryId);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="size-6 text-amber-400" />
            ตั้งค่าเรทคีย์หวย
          </h1>
          <p className="text-white/60 mt-1">กำหนดอัตราจ่ายสำหรับลูกค้าคีย์หวยแยกจากระบบออโต้</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={handleResetDefaults}
            disabled={isSaving}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <RefreshCw className="size-4 mr-2" />
            รีเซ็ตค่าเริ่มต้น
          </Button>
          <Button 
            variant="outline" 
            onClick={handleCopyToAll}
            disabled={isSaving || !hasChanges}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <Copy className="size-4 mr-2" />
            คัดลอกไปทุกหวย
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="bg-amber-500 text-black hover:bg-amber-400"
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

      {/* Custom Rates Toggle */}
      <Card className="bg-[#0D1321] border-amber-500/30">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-500/20">
                <Keyboard className="size-6 text-amber-400" />
              </div>
              <div>
                <p className="font-medium text-white">ใช้เรทจ่ายแยกสำหรับคีย์หวย</p>
                <p className="text-sm text-white/60">
                  เมื่อเปิดใช้งาน ลูกค้าคีย์หวยจะได้รับเรทจ่ายตามที่ตั้งค่าด้านล่าง แยกจากเรทออโต้
                </p>
              </div>
            </div>
            <Switch
              checked={useCustomRates}
              onCheckedChange={(v) => {
                setUseCustomRates(v);
                setHasChanges(true);
              }}
              className="data-[state=checked]:bg-amber-500"
            />
          </div>
        </CardContent>
      </Card>

      {hasChanges && (
        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-2">
          <AlertTriangle className="size-5 text-yellow-500" />
          <span className="text-yellow-500">มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Lottery List */}
        <Card className="lg:col-span-1 bg-[#0D1321] border-amber-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-white">
              <Ticket className="size-5 text-amber-400" />
              เลือกหวย
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="p-2 space-y-1">
                {isLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <RefreshCw className="size-6 animate-spin text-amber-400" />
                  </div>
                ) : lotteries.length === 0 ? (
                  <div className="text-center py-10 text-white/60">
                    ไม่พบหวยในระบบ
                  </div>
                ) : (
                  lotteries.map(lottery => (
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
                          ? 'bg-amber-500 text-black font-medium'
                          : 'text-white hover:bg-white/10'
                      }`}
                    >
                      {lottery.name}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Rate Editor */}
        <Card className="lg:col-span-3 bg-[#0D1321] border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Settings className="size-5 text-amber-400" />
              เรทจ่ายคีย์หวย - {selectedLottery?.name || 'เลือกหวย'}
            </CardTitle>
            <CardDescription className="text-white/60">
              กำหนดอัตราจ่ายเป็นจำนวนเท่าของเงินเดิมพัน (เช่น 85 = จ่าย 85 บาทต่อ 1 บาท)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="size-8 animate-spin text-amber-400" />
              </div>
            ) : !useCustomRates ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Calculator className="size-16 text-white/30 mb-4" />
                <p className="text-white/60 text-lg">ระบบใช้เรทจ่ายเดียวกับระบบออโต้</p>
                <p className="text-white/40 text-sm mt-2">
                  เปิดใช้งาน &quot;ใช้เรทจ่ายแยกสำหรับคีย์หวย&quot; เพื่อตั้งค่าเรทแยก
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {BET_TYPE_GROUPS.map(group => (
                  <div key={group.label}>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                        {group.label}
                      </Badge>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {group.types.map(betType => (
                        <div key={betType} className="space-y-2">
                          <Label className="text-sm text-white/60">
                            {BET_TYPE_LABELS[betType]}
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={editedRates[betType] || ''}
                              onChange={(e) => handleRateChange(betType, e.target.value)}
                              className="font-mono text-lg bg-black/30 border-white/20 text-white"
                            />
                            <span className="text-sm text-white/60 whitespace-nowrap">
                              เท่า
                            </span>
                          </div>
                          <p className="text-xs text-white/40">
                            ค่าเริ่มต้น: {DEFAULT_KEYIN_RATES[betType]}
                          </p>
                        </div>
                      ))}
                    </div>
                    <Separator className="mt-4 bg-white/10" />
                  </div>
                ))}

                {/* Preview */}
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <h3 className="font-semibold mb-3 text-amber-400 flex items-center gap-2">
                    <Percent className="size-5" />
                    ตัวอย่างการจ่าย (เดิมพัน 100 บาท)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {Object.entries(editedRates).map(([betType, rate]) => (
                      <div key={betType} className="flex justify-between p-2 rounded bg-black/30">
                        <span className="text-white/60">{BET_TYPE_LABELS[betType as BetType]}</span>
                        <span className="font-mono font-bold text-amber-400">
                          {(rate * 100).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comparison with Auto Rates */}
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <h3 className="font-semibold mb-3 text-blue-400 flex items-center gap-2">
                    <Users className="size-5" />
                    เปรียบเทียบกับเรทออโต้
                  </h3>
                  <p className="text-white/60 text-sm mb-3">
                    เรทคีย์หวยต่ำกว่าเรทออโต้ เพื่อชดเชยต้นทุนการคีย์ข้อมูลด้วยมือ
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="p-2 rounded bg-black/30">
                      <span className="text-white/60">3 ตัวบน</span>
                      <div className="flex justify-between mt-1">
                        <span className="text-blue-400">ออโต้: 900</span>
                        <span className="text-amber-400">คีย์: {editedRates['3top'] || 850}</span>
                      </div>
                    </div>
                    <div className="p-2 rounded bg-black/30">
                      <span className="text-white/60">2 ตัวบน</span>
                      <div className="flex justify-between mt-1">
                        <span className="text-blue-400">ออโต้: 90</span>
                        <span className="text-amber-400">คีย์: {editedRates['2top'] || 85}</span>
                      </div>
                    </div>
                    <div className="p-2 rounded bg-black/30">
                      <span className="text-white/60">2 ตัวล่าง</span>
                      <div className="flex justify-between mt-1">
                        <span className="text-blue-400">ออโต้: 90</span>
                        <span className="text-amber-400">คีย์: {editedRates['2bot'] || 85}</span>
                      </div>
                    </div>
                    <div className="p-2 rounded bg-black/30">
                      <span className="text-white/60">วิ่งบน</span>
                      <div className="flex justify-between mt-1">
                        <span className="text-blue-400">ออโต้: 3.2</span>
                        <span className="text-amber-400">คีย์: {editedRates['1top'] || 3.0}</span>
                      </div>
                    </div>
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
