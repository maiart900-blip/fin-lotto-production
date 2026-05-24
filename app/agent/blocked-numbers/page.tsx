'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Ban, Plus, Trash2, AlertTriangle } from 'lucide-react';

const DEMO_AGENT_ID = '7cf23d72-858d-4395-9b94-67e7a7ca821f';

interface BlockedNumber {
  id: string;
  number: string;
  bet_type: string;
  block_type: string;
  max_amount: number | null;
  reason: string | null;
  created_at: string;
}

interface LotteryGroup {
  lottery_id: string;
  lottery_name: string;
  numbers: BlockedNumber[];
}

export default function BlockedNumbersPage() {
  const [blockedNumbers, setBlockedNumbers] = useState<BlockedNumber[]>([]);
  const [byLottery, setByLottery] = useState<LotteryGroup[]>([]);
  const [lotteries, setLotteries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [selectedLotteryId, setSelectedLotteryId] = useState('');
  const [numbersInput, setNumbersInput] = useState('');
  const [betType, setBetType] = useState('all');
  const [blockType, setBlockType] = useState('full');
  const [maxAmount, setMaxAmount] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch blocked numbers
      const res = await fetch(`/api/agent/blocked-numbers?agent_id=${DEMO_AGENT_ID}`);
      const data = await res.json();
      setBlockedNumbers(data.blocked_numbers || []);
      setByLottery(data.by_lottery || []);

      // Fetch lotteries for dropdown
      const lotteriesRes = await fetch('/api/lotteries');
      const lotteriesData = await lotteriesRes.json();
      setLotteries(lotteriesData.lotteries || lotteriesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedLotteryId || !numbersInput.trim()) {
      alert('กรุณาเลือกหวยและกรอกเลข');
      return;
    }

    // Parse numbers - รองรับหลายรูปแบบ: 12,34,56 หรือ 12 34 56 หรือแต่ละบรรทัด
    const numbers = numbersInput
      .split(/[,\s\n]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0)
      .map(n => ({ number: n, bet_type: betType }));

    if (numbers.length === 0) {
      alert('กรุณากรอกเลขอย่างน้อย 1 เลข');
      return;
    }

    try {
      const res = await fetch('/api/agent/blocked-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: DEMO_AGENT_ID,
          lottery_id: selectedLotteryId,
          numbers,
          block_type: blockType,
          max_amount: blockType === 'partial' ? Number(maxAmount) : null,
          reason: reason || null,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        alert(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error adding:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันการลบเลขอั้นนี้?')) return;

    try {
      const res = await fetch(`/api/agent/blocked-numbers?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const resetForm = () => {
    setSelectedLotteryId('');
    setNumbersInput('');
    setBetType('all');
    setBlockType('full');
    setMaxAmount('');
    setReason('');
  };

  const getBetTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      all: 'ทุกประเภท',
      '2top': '2 ตัวบน',
      '2bot': '2 ตัวล่าง',
      '3top': '3 ตัวบน',
      '3tod': '3 ตัวโต๊ด',
      run_top: 'วิ่งบน',
      run_bot: 'วิ่งล่าง',
    };
    return labels[type] || type;
  };

  if (loading) {
    return <div className="p-6">กำลังโหลด...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">อั้นเลข</h1>
          <p className="text-muted-foreground">จัดการเลขที่ไม่รับหรือจำกัดยอด</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          เพิ่มเลขอั้น
        </Button>
      </div>

      {/* สรุป */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">เลขอั้นทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{blockedNumbers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">อั้นเต็ม</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {blockedNumbers.filter(n => n.block_type === 'full').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">จำกัดยอด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {blockedNumbers.filter(n => n.block_type === 'partial').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* แยกตามหวย */}
      {byLottery.length > 0 ? (
        byLottery.map((group) => (
          <Card key={group.lottery_id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="h-5 w-5 text-red-500" />
                {group.lottery_name}
                <Badge variant="secondary">{group.numbers.length} เลข</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เลข</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>การอั้น</TableHead>
                    <TableHead>ยอดสูงสุด</TableHead>
                    <TableHead>หมายเหตุ</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.numbers.map((num) => (
                    <TableRow key={num.id}>
                      <TableCell className="font-mono font-bold text-lg">{num.number}</TableCell>
                      <TableCell>{getBetTypeLabel(num.bet_type)}</TableCell>
                      <TableCell>
                        {num.block_type === 'full' ? (
                          <Badge variant="destructive">อั้นเต็ม</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-500 text-black">จำกัดยอด</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {num.max_amount ? `${num.max_amount.toLocaleString()} บาท` : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {num.reason || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(num.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>ยังไม่มีเลขอั้น</p>
            <p className="text-sm">คลิก "เพิ่มเลขอั้น" เพื่อเริ่มต้น</p>
          </CardContent>
        </Card>
      )}

      {/* Dialog เพิ่มเลขอั้น */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่มเลขอั้น</DialogTitle>
            <DialogDescription>
              เลือกหวยและกรอกเลขที่ต้องการอั้น
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>เลือกหวย</Label>
              <Select value={selectedLotteryId} onValueChange={setSelectedLotteryId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกหวย..." />
                </SelectTrigger>
                <SelectContent>
                  {lotteries.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>เลข (คั่นด้วย , หรือ เว้นวรรค หรือ ขึ้นบรรทัดใหม่)</Label>
              <Textarea
                value={numbersInput}
                onChange={(e) => setNumbersInput(e.target.value)}
                placeholder="12, 34, 56&#10;หรือ&#10;12&#10;34&#10;56"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>ประเภทเลข</Label>
              <Select value={betType} onValueChange={setBetType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกประเภท</SelectItem>
                  <SelectItem value="2top">2 ตัวบน</SelectItem>
                  <SelectItem value="2bot">2 ตัวล่าง</SelectItem>
                  <SelectItem value="3top">3 ตัวบน</SelectItem>
                  <SelectItem value="3tod">3 ตัวโต๊ด</SelectItem>
                  <SelectItem value="run_top">วิ่งบน</SelectItem>
                  <SelectItem value="run_bot">วิ่งล่าง</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>ประเภทการอั้น</Label>
              <Select value={blockType} onValueChange={setBlockType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">อั้นเต็ม (ไม่รับเลย)</SelectItem>
                  <SelectItem value="partial">จำกัดยอด</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {blockType === 'partial' && (
              <div className="space-y-2">
                <Label>ยอดสูงสุดที่รับ (บาท)</Label>
                <Input
                  type="number"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  placeholder="เช่น 1000"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>หมายเหตุ (ไม่บังคับ)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="เช่น เลขดัง"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleAdd}>
              บันทึก
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
