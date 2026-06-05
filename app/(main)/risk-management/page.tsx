'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  Settings, 
  Loader2,
  Ban,
  DollarSign,
  BarChart3,
  Save,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface RiskNumber {
  number: string;
  entry_type: string;
  total_amount: number;
  bet_count: number;
  potential_payout: number;
  profit_loss: number;
  risk_level: 'normal' | 'warning' | 'danger';
}

interface Lottery {
  id: string;
  name: string;
}

interface Entry {
  id: string;
  number: string;
  bet_type?: string;
  entry_type?: string;
  amount: number;
  lottery_id?: string;
}

const ENTRY_TYPES = [
  { value: 'three_top', label: '3 ตัวบน' },
  { value: 'three_tod', label: '3 ตัวโต๊ด' },
  { value: 'two_top', label: '2 ตัวบน' },
  { value: 'two_bottom', label: '2 ตัวล่าง' },
  { value: 'run_top', label: 'วิ่งบน' },
  { value: 'run_bottom', label: 'วิ่งล่าง' },
];

export default function RiskManagementPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [selectedLottery, setSelectedLottery] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [riskNumbers, setRiskNumbers] = useState<RiskNumber[]>([]);
  const [summary, setSummary] = useState({
    totalBets: 0,
    totalAmount: 0,
    potentialPayout: 0,
    highRiskCount: 0,
    dangerCount: 0,
  });

  useEffect(() => {
    fetchLotteries();
  }, []);

  useEffect(() => {
    fetchRiskData();
  }, [selectedLottery, selectedType]);

  const fetchLotteries = async () => {
    try {
      const res = await fetch('/api/lotteries');
      if (!res.ok) {
        console.error('[v0] Failed to fetch lotteries:', res.status);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setLotteries(data);
      }
    } catch (err) {
      console.error('[v0] Error fetching lotteries:', err);
    }
  };

  const fetchRiskData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch entries
      const params = new URLSearchParams();
      if (selectedLottery !== 'all') params.append('lottery_id', selectedLottery);
      
      const res = await fetch(`/api/entries?${params.toString()}`);
      
      if (!res.ok) {
        throw new Error(`API Error: ${res.status}`);
      }
      
      const entries = await res.json();
      
      // Check if entries is an array
      if (!Array.isArray(entries)) {
        setRiskNumbers([]);
        setSummary({
          totalBets: 0,
          totalAmount: 0,
          potentialPayout: 0,
          highRiskCount: 0,
          dangerCount: 0,
        });
        setLoading(false);
        return;
      }

      // If no entries, show empty state
      if (entries.length === 0) {
        setRiskNumbers([]);
        setSummary({
          totalBets: 0,
          totalAmount: 0,
          potentialPayout: 0,
          highRiskCount: 0,
          dangerCount: 0,
        });
        setLoading(false);
        return;
      }
      
      // Group by number and calculate risk
      const numberMap = new Map<string, RiskNumber>();
      
      for (const entry of entries) {
        // Handle both bet_type and entry_type field names
        const entryType = entry.bet_type || entry.entry_type || 'unknown';
        
        if (selectedType !== 'all' && entryType !== selectedType) continue;
        
        const key = `${entry.number}-${entryType}`;
        const existing = numberMap.get(key);
        
        // Get payout rate (simplified)
        const payoutRates: Record<string, number> = {
          'three_top': 800,
          'three_tod': 120,
          'two_top': 90,
          'two_bottom': 90,
          'run_top': 3.2,
          'run_bottom': 4.2,
        };
        const rate = payoutRates[entryType] || 1;
        const amount = Number(entry.amount) || 0;
        const payout = amount * rate;
        
        if (existing) {
          existing.total_amount += amount;
          existing.bet_count += 1;
          existing.potential_payout += payout;
          existing.profit_loss = existing.total_amount - existing.potential_payout;
        } else {
          numberMap.set(key, {
            number: entry.number || '-',
            entry_type: entryType,
            total_amount: amount,
            bet_count: 1,
            potential_payout: payout,
            profit_loss: amount - payout,
            risk_level: 'normal',
          });
        }
      }
      
      // Calculate risk levels
      const numbers = Array.from(numberMap.values()).map(n => {
        if (n.profit_loss < -10000) n.risk_level = 'danger';
        else if (n.profit_loss < -5000) n.risk_level = 'warning';
        return n;
      });
      
      // Sort by profit_loss (most negative first)
      numbers.sort((a, b) => a.profit_loss - b.profit_loss);
      
      setRiskNumbers(numbers);
      setSummary({
        totalBets: entries.length,
        totalAmount: entries.reduce((sum: number, e: Entry) => sum + (Number(e.amount) || 0), 0),
        potentialPayout: numbers.reduce((sum, n) => sum + n.potential_payout, 0),
        highRiskCount: numbers.filter(n => n.risk_level === 'warning').length,
        dangerCount: numbers.filter(n => n.risk_level === 'danger').length,
      });
      
    } catch (err) {
      console.error('[v0] Error fetching risk data:', err);
      setError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  const getEntryTypeLabel = (type: string) => {
    return ENTRY_TYPES.find(t => t.value === type)?.label || type;
  };

  const formatMoney = (n: number) => new Intl.NumberFormat('th-TH').format(n);

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'danger':
        return <Badge className="bg-red-500">อันตราย</Badge>;
      case 'warning':
        return <Badge className="bg-orange-500">เสี่ยง</Badge>;
      default:
        return <Badge className="bg-green-500">ปกติ</Badge>;
    }
  };

  const handleSaveSettings = () => {
    toast.success('บันทึกการตั้งค่าสำเร็จ');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-amber-400">ควบคุมความเสี่ยง</h1>
        <p className="text-amber-300/80">ตรวจสอบเลขที่มียอดแทงสูงและความเสี่ยงในการขาดทุน</p>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500">
                <BarChart3 className="size-4 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.totalBets}</p>
                <p className="text-xs text-muted-foreground">รายการทั้งหมด</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500">
                <DollarSign className="size-4 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">฿{formatMoney(summary.totalAmount)}</p>
                <p className="text-xs text-muted-foreground">ยอดรับรวม</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500">
                <TrendingDown className="size-4 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">฿{formatMoney(summary.potentialPayout)}</p>
                <p className="text-xs text-muted-foreground">จ่ายสูงสุดถ้าถูกทุกเลข</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500">
                <AlertTriangle className="size-4 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.highRiskCount}</p>
                <p className="text-xs text-muted-foreground">เลขเสี่ยง</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-600">
                <Ban className="size-4 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.dangerCount}</p>
                <p className="text-xs text-muted-foreground">เลขอันตราย</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="numbers">
        <TabsList>
          <TabsTrigger value="numbers" className="flex items-center gap-2">
            <TrendingUp className="size-4" />
            เลขยอดสูง
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="size-4" />
            ตั้งค่า Limit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="numbers" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>เลขที่มียอดแทงสูง</CardTitle>
                  <CardDescription>เรียงตามความเสี่ยงสูงสุด</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedLottery} onValueChange={setSelectedLottery}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="เลือกหวย" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกหวย</SelectItem>
                      {lotteries.map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="ประเภท" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกประเภท</SelectItem>
                      {ENTRY_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={fetchRiskData} disabled={loading}>
                    <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-muted-foreground">กำลังโหลดข้อมูล...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <AlertCircle className="size-12 text-red-500" />
                  <p className="text-red-500">{error}</p>
                  <Button onClick={fetchRiskData} variant="outline">
                    <RefreshCw className="size-4 mr-2" />
                    ลองใหม่อีกครั้ง
                  </Button>
                </div>
              ) : riskNumbers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="size-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">ไม่พบข้อมูล</p>
                  <p className="text-sm mt-1">ยังไม่มีรายการแทงหวยในระบบ</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-black font-bold">เลข</TableHead>
                      <TableHead className="text-black font-bold">ประเภท</TableHead>
                      <TableHead className="text-right text-black font-bold">จำนวนโพย</TableHead>
                      <TableHead className="text-right text-black font-bold">ยอดรับ</TableHead>
                      <TableHead className="text-right text-black font-bold">จ่ายถ้าถูก</TableHead>
                      <TableHead className="text-right text-black font-bold">กำไร/ขาดทุน</TableHead>
                      <TableHead className="text-center text-black font-bold">ระดับความเสี่ยง</TableHead>
                      <TableHead className="text-center text-black font-bold">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {riskNumbers.slice(0, 50).map((num, idx) => (
                      <TableRow key={idx} className={num.risk_level === 'danger' ? 'bg-red-500/10' : num.risk_level === 'warning' ? 'bg-orange-500/10' : ''}>
                        <TableCell className="font-mono font-bold text-lg text-black">{num.number}</TableCell>
                        <TableCell className="text-black font-medium">{getEntryTypeLabel(num.entry_type)}</TableCell>
                        <TableCell className="text-right text-black font-medium">{num.bet_count}</TableCell>
                        <TableCell className="text-right text-green-600 font-bold">฿{formatMoney(num.total_amount)}</TableCell>
                        <TableCell className="text-right text-red-600 font-bold">฿{formatMoney(num.potential_payout)}</TableCell>
                        <TableCell className={`text-right font-bold ${num.profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {num.profit_loss >= 0 ? '+' : ''}฿{formatMoney(num.profit_loss)}
                        </TableCell>
                        <TableCell className="text-center">{getRiskBadge(num.risk_level)}</TableCell>
                        <TableCell className="text-center">
                          <Button variant="outline" size="sm">
                            <Ban className="size-3 mr-1" />
                            ปิดเลข
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>ตั้งค่า Limit ความเสี่ยง</CardTitle>
              <CardDescription>กำหนดยอดสูงสุดต่อเลข ต่อประเภท ต่อหวย</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label>ยอดสูงสุดต่อเลข (บาท)</Label>
                  <Input type="number" placeholder="10000" className="mt-1" />
                </div>
                <div>
                  <Label>ยอดสูงสุดต่อประเภท (บาท)</Label>
                  <Input type="number" placeholder="50000" className="mt-1" />
                </div>
                <div>
                  <Label>ยอดสูงสุดต่อหวย (บาท)</Label>
                  <Input type="number" placeholder="100000" className="mt-1" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>ปิดเลขอัตโนมัติเมื่อยอดถึง (%)</Label>
                  <Input type="number" placeholder="100" className="mt-1" />
                </div>
                <div>
                  <Label>ลดเรทจ่ายเมื่อยอดถึง (%)</Label>
                  <Input type="number" placeholder="80" className="mt-1" />
                </div>
              </div>
              <Button onClick={handleSaveSettings}>
                <Save className="size-4 mr-2" />
                บันทึกการตั้งค่า
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
