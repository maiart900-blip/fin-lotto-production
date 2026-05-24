'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Repeat, Grid3X3, Shuffle, Zap, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface GeneratedEntry {
  number: string;
  betType: '2top' | '2bot' | '3top' | '3tod' | '1top' | '1bot';
  amount: number;
}

interface QuickModifiersProps {
  onEntriesGenerated: (entries: GeneratedEntry[]) => void;
  className?: string;
}

// Generate reversed/flipped numbers
function generateReverse2(num: string): string[] {
  if (num.length !== 2) return [num];
  return [num, num[1] + num[0]].filter((v, i, a) => a.indexOf(v) === i);
}

function generateReverse3(num: string): string[] {
  if (num.length !== 3) return [num];
  const [a, b, c] = num.split('');
  const perms = [
    a + b + c, a + c + b, b + a + c,
    b + c + a, c + a + b, c + b + a
  ];
  return [...new Set(perms)];
}

// Generate 19 ประตู (running numbers)
function generate19Door(digit: string): string[] {
  const results: string[] = [];
  for (let i = 0; i <= 9; i++) {
    results.push(digit + i.toString());
    if (i.toString() !== digit) {
      results.push(i.toString() + digit);
    }
  }
  return [...new Set(results)].sort();
}

// Generate double numbers (เลขเบิ้ล)
function generateDoubles(): string[] {
  const results: string[] = [];
  for (let i = 0; i <= 9; i++) {
    results.push(i.toString() + i.toString());
  }
  return results;
}

// Generate triple numbers (เลขตอง)
function generateTriples(): string[] {
  const results: string[] = [];
  for (let i = 0; i <= 9; i++) {
    results.push(i.toString() + i.toString() + i.toString());
  }
  return results;
}

export function QuickModifiers({ onEntriesGenerated, className }: QuickModifiersProps) {
  // Reverse state
  const [reverseNumber, setReverseNumber] = useState('');
  const [reverseAmount, setReverseAmount] = useState('');
  const [reversePreview, setReversePreview] = useState<string[]>([]);

  // 19 Door state
  const [doorDigit, setDoorDigit] = useState('');
  const [doorAmount, setDoorAmount] = useState('');
  const [doorPreview, setDoorPreview] = useState<string[]>([]);

  // Double state
  const [doubleAmount, setDoubleAmount] = useState('');

  // Handle reverse number change
  const handleReverseChange = useCallback((num: string) => {
    const clean = num.replace(/\D/g, '').slice(0, 3);
    setReverseNumber(clean);
    if (clean.length >= 2) {
      const reversed = clean.length === 2 ? generateReverse2(clean) : generateReverse3(clean);
      setReversePreview(reversed);
    } else {
      setReversePreview([]);
    }
  }, []);

  // Handle 19 door digit change
  const handleDoorChange = useCallback((digit: string) => {
    const clean = digit.replace(/\D/g, '').slice(0, 1);
    setDoorDigit(clean);
    if (clean) {
      setDoorPreview(generate19Door(clean));
    } else {
      setDoorPreview([]);
    }
  }, []);

  // Add reverse entries
  const handleAddReverse = useCallback(() => {
    const amount = parseInt(reverseAmount);
    if (reversePreview.length === 0) {
      toast.error('กรุณากรอกเลข 2-3 หลัก');
      return;
    }
    if (!amount || amount <= 0) {
      toast.error('กรุณากรอกราคา');
      return;
    }

    const betType = reverseNumber.length === 2 ? '2top' : '3top';
    const entries: GeneratedEntry[] = reversePreview.map(num => ({
      number: num,
      betType: betType as '2top' | '3top',
      amount,
    }));

    onEntriesGenerated(entries);
    setReverseNumber('');
    setReverseAmount('');
    setReversePreview([]);
    toast.success(`เพิ่ม ${entries.length} รายการ (กลับเลข)`);
  }, [reversePreview, reverseAmount, reverseNumber, onEntriesGenerated]);

  // Add 19 door entries
  const handleAdd19Door = useCallback(() => {
    const amount = parseInt(doorAmount);
    if (doorPreview.length === 0) {
      toast.error('กรุณากรอกตัวเลข 1 หลัก');
      return;
    }
    if (!amount || amount <= 0) {
      toast.error('กรุณากรอกราคา');
      return;
    }

    const entries: GeneratedEntry[] = doorPreview.map(num => ({
      number: num,
      betType: '2top',
      amount,
    }));

    onEntriesGenerated(entries);
    setDoorDigit('');
    setDoorAmount('');
    setDoorPreview([]);
    toast.success(`เพิ่ม 19 ประตู (${entries.length} รายการ)`);
  }, [doorPreview, doorAmount, onEntriesGenerated]);

  // Add double entries (เลขเบิ้ล)
  const handleAddDoubles = useCallback(() => {
    const amount = parseInt(doubleAmount);
    if (!amount || amount <= 0) {
      toast.error('กรุณากรอกราคา');
      return;
    }

    const doubles = generateDoubles();
    const entries: GeneratedEntry[] = doubles.map(num => ({
      number: num,
      betType: '2top',
      amount,
    }));

    onEntriesGenerated(entries);
    setDoubleAmount('');
    toast.success(`เพิ่มเลขเบิ้ล 10 ตัว (${entries.length} รายการ)`);
  }, [doubleAmount, onEntriesGenerated]);

  // Add triple entries (เลขตอง)
  const handleAddTriples = useCallback(() => {
    const amount = parseInt(doubleAmount);
    if (!amount || amount <= 0) {
      toast.error('กรุณากรอกราคา');
      return;
    }

    const triples = generateTriples();
    const entries: GeneratedEntry[] = triples.map(num => ({
      number: num,
      betType: '3top',
      amount,
    }));

    onEntriesGenerated(entries);
    setDoubleAmount('');
    toast.success(`เพิ่มเลขตอง 10 ตัว (${entries.length} รายการ)`);
  }, [doubleAmount, onEntriesGenerated]);

  return (
    <Card className={cn('border-[#D4AF37]/30 bg-gradient-to-br from-black/80 to-black/60', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-[#D4AF37]">
          <Zap className="size-5" />
          ทางลัดเพิ่มเลข
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="reverse" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-black/50">
            <TabsTrigger value="reverse" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
              <Repeat className="size-4 mr-1" />
              กลับเลข
            </TabsTrigger>
            <TabsTrigger value="door19" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
              <Grid3X3 className="size-4 mr-1" />
              19 ประตู
            </TabsTrigger>
            <TabsTrigger value="special" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
              <Shuffle className="size-4 mr-1" />
              เลขพิเศษ
            </TabsTrigger>
          </TabsList>

          {/* Reverse Tab */}
          <TabsContent value="reverse" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">เลข (2-3 หลัก)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="เช่น 12 หรือ 123"
                  value={reverseNumber}
                  onChange={(e) => handleReverseChange(e.target.value)}
                  className="bg-white text-black border-[#D4AF37]/50 focus:border-[#D4AF37] font-mono text-center text-lg"
                  maxLength={3}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">ราคาต่อตัว</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="บาท"
                  value={reverseAmount}
                  onChange={(e) => setReverseAmount(e.target.value.replace(/\D/g, ''))}
                  className="bg-white text-black border-[#D4AF37]/50 focus:border-[#D4AF37] font-mono text-center text-lg"
                />
              </div>
            </div>

            {reversePreview.length > 0 && (
              <div className="p-3 rounded-lg bg-black/30 border border-gray-700">
                <p className="text-sm text-gray-400 mb-2">
                  {reverseNumber.length === 2 ? '2 กลับ' : '6 กลับ'}: {reversePreview.length} ตัว
                </p>
                <div className="flex flex-wrap gap-2">
                  {reversePreview.map((num, i) => (
                    <Badge key={i} className="bg-[#D4AF37]/20 text-[#D4AF37] font-mono text-lg px-3">
                      {num}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleAddReverse}
              disabled={reversePreview.length === 0 || !reverseAmount}
              className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="size-4 mr-2" />
              เพิ่มกลับเลข ({reversePreview.length} ตัว)
            </Button>
          </TabsContent>

          {/* 19 Door Tab */}
          <TabsContent value="door19" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">ตัวเลข</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="0-9"
                  value={doorDigit}
                  onChange={(e) => handleDoorChange(e.target.value)}
                  className="bg-white text-black border-[#D4AF37]/50 focus:border-[#D4AF37] font-mono text-center text-2xl"
                  maxLength={1}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">ราคาต่อตัว</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="บาท"
                  value={doorAmount}
                  onChange={(e) => setDoorAmount(e.target.value.replace(/\D/g, ''))}
                  className="bg-white text-black border-[#D4AF37]/50 focus:border-[#D4AF37] font-mono text-center text-lg"
                />
              </div>
            </div>

            {doorPreview.length > 0 && (
              <div className="p-3 rounded-lg bg-black/30 border border-gray-700">
                <p className="text-sm text-gray-400 mb-2">19 ประตู: {doorPreview.length} ตัว</p>
                <div className="flex flex-wrap gap-1.5">
                  {doorPreview.map((num, i) => (
                    <Badge key={i} className="bg-[#D4AF37]/20 text-[#D4AF37] font-mono px-2">
                      {num}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleAdd19Door}
              disabled={doorPreview.length === 0 || !doorAmount}
              className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="size-4 mr-2" />
              เพิ่ม 19 ประตู ({doorPreview.length} ตัว)
            </Button>
          </TabsContent>

          {/* Special Numbers Tab */}
          <TabsContent value="special" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-400 text-sm">ราคาต่อตัว</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="บาท"
                value={doubleAmount}
                onChange={(e) => setDoubleAmount(e.target.value.replace(/\D/g, ''))}
                className="bg-white text-black border-[#D4AF37]/50 focus:border-[#D4AF37] font-mono text-center text-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-black/30 border border-gray-700 space-y-2">
                <p className="text-sm text-[#D4AF37] font-semibold">เลขเบิ้ล (2 ตัว)</p>
                <p className="text-xs text-gray-500">00, 11, 22, ..., 99</p>
                <Button
                  onClick={handleAddDoubles}
                  disabled={!doubleAmount}
                  size="sm"
                  className="w-full bg-[#D4AF37] text-black hover:bg-[#B8860B]"
                >
                  เพิ่ม 10 ตัว
                </Button>
              </div>

              <div className="p-3 rounded-lg bg-black/30 border border-gray-700 space-y-2">
                <p className="text-sm text-[#D4AF37] font-semibold">เลขตอง (3 ตัว)</p>
                <p className="text-xs text-gray-500">000, 111, 222, ..., 999</p>
                <Button
                  onClick={handleAddTriples}
                  disabled={!doubleAmount}
                  size="sm"
                  className="w-full bg-[#D4AF37] text-black hover:bg-[#B8860B]"
                >
                  เพิ่ม 10 ตัว
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
