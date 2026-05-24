'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Calculator, 
  Shuffle, 
  Copy, 
  Check,
  Trash2,
  Star,
  Dices,
  Hash,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

type NumberType = '2top' | '2bot' | '3top' | '3tod' | '1run';

const NUMBER_TYPES = [
  { id: '2top', label: '2 ตัวบน', digits: 2 },
  { id: '2bot', label: '2 ตัวล่าง', digits: 2 },
  { id: '3top', label: '3 ตัวตรง', digits: 3 },
  { id: '3tod', label: '3 ตัวโต๊ด', digits: 3 },
  { id: '1run', label: 'วิ่งบน/ล่าง', digits: 1 },
] as const;

export default function NumberGenPage() {
  const [selectedType, setSelectedType] = useState<NumberType>('2top');
  const [generatedNumbers, setGeneratedNumbers] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(5);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [baseNumber, setBaseNumber] = useState('');

  const getDigits = () => {
    const type = NUMBER_TYPES.find(t => t.id === selectedType);
    return type?.digits || 2;
  };

  // Generate random numbers
  const generateRandom = () => {
    const digits = getDigits();
    const numbers: string[] = [];
    const max = Math.pow(10, digits);
    
    while (numbers.length < quantity) {
      const num = Math.floor(Math.random() * max).toString().padStart(digits, '0');
      if (!numbers.includes(num)) {
        numbers.push(num);
      }
    }
    
    setGeneratedNumbers(numbers);
    toast.success(`สร้าง ${quantity} เลขสำเร็จ`);
  };

  // Generate permutations from base number
  const generatePermutations = () => {
    if (!baseNumber) {
      toast.error('กรุณาใส่เลขต้นแบบ');
      return;
    }

    const digits = baseNumber.split('');
    const perms: string[] = [];
    
    const permute = (arr: string[], l: number = 0) => {
      if (l === arr.length - 1) {
        perms.push(arr.join(''));
        return;
      }
      for (let i = l; i < arr.length; i++) {
        [arr[l], arr[i]] = [arr[i], arr[l]];
        permute([...arr], l + 1);
        [arr[l], arr[i]] = [arr[i], arr[l]];
      }
    };

    permute(digits);
    const uniquePerms = [...new Set(perms)];
    setGeneratedNumbers(uniquePerms);
    toast.success(`สร้าง ${uniquePerms.length} เลขกลับ`);
  };

  // Generate nearby numbers (+-1 for each digit)
  const generateNearby = () => {
    if (!baseNumber) {
      toast.error('กรุณาใส่เลขต้นแบบ');
      return;
    }

    const digits = baseNumber.split('').map(Number);
    const nearby: string[] = [baseNumber];
    
    digits.forEach((d, i) => {
      const arr = [...digits];
      if (d > 0) {
        arr[i] = d - 1;
        nearby.push(arr.join(''));
      }
      if (d < 9) {
        arr[i] = d + 1;
        nearby.push(arr.join(''));
      }
    });

    const unique = [...new Set(nearby)];
    setGeneratedNumbers(unique);
    toast.success(`สร้าง ${unique.length} เลขใกล้เคียง`);
  };

  const handleCopyNumber = (number: string) => {
    navigator.clipboard.writeText(number);
    setCopiedNumber(number);
    toast.success(`คัดลอกเลข ${number} แล้ว`);
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(generatedNumbers.join('\n'));
    toast.success(`คัดลอก ${generatedNumbers.length} เลขแล้ว`);
  };

  const clearNumbers = () => {
    setGeneratedNumbers([]);
    setBaseNumber('');
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2 text-white">
          <Calculator className="size-5 text-amber-400" />
          สร้างเลขชุด
        </h1>
      </div>

      {/* Number Type Selection */}
      <Card className="bg-[#0D1321] border-amber-500/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-amber-400/80">เลือกประเภทเลข</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {NUMBER_TYPES.map((type) => (
              <Button
                key={type.id}
                variant={selectedType === type.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType(type.id as NumberType)}
                className={selectedType === type.id 
                  ? 'bg-amber-500 hover:bg-amber-600 text-black'
                  : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
                }
              >
                {type.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Generation Options */}
      <Card className="bg-[#0D1321] border-amber-500/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-amber-400/80">วิธีสร้างเลข</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Random Generation */}
          <div className="p-3 bg-[#0A0F1C] rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <Dices className="size-4 text-cyan-400" />
              <span className="text-sm font-medium text-white">สุ่มเลข</span>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-[#64748B] w-16">จำนวน</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={quantity}
                onChange={(e) => setQuantity(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-20 h-8 bg-[#0D1321] border-amber-500/20 text-white text-center"
              />
              <span className="text-xs text-[#64748B]">เลข</span>
              <Button
                onClick={generateRandom}
                size="sm"
                className="ml-auto bg-cyan-500 hover:bg-cyan-600 text-white"
              >
                <Shuffle className="size-4 mr-1" />
                สุ่ม
              </Button>
            </div>
          </div>

          {/* Permutation Generation */}
          <div className="p-3 bg-[#0A0F1C] rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <Hash className="size-4 text-emerald-400" />
              <span className="text-sm font-medium text-white">เลขกลับ / เลขใกล้เคียง</span>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-[#64748B] w-16">เลข</Label>
              <Input
                type="text"
                value={baseNumber}
                onChange={(e) => setBaseNumber(e.target.value.replace(/\D/g, '').slice(0, getDigits()))}
                placeholder={`ใส่ ${getDigits()} หลัก`}
                maxLength={getDigits()}
                className="w-24 h-8 bg-[#0D1321] border-amber-500/20 text-white text-center font-mono"
              />
              <Button
                onClick={generatePermutations}
                size="sm"
                variant="outline"
                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              >
                กลับ
              </Button>
              <Button
                onClick={generateNearby}
                size="sm"
                variant="outline"
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              >
                ใกล้
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generated Numbers */}
      {generatedNumbers.length > 0 && (
        <Card className="bg-[#0D1321] border-amber-500/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-amber-400/80 flex items-center gap-2">
                <Sparkles className="size-4" />
                เลขที่สร้าง ({generatedNumbers.length} เลข)
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyAll}
                  className="h-7 text-xs text-amber-400 hover:bg-amber-500/10"
                >
                  <Copy className="size-3 mr-1" />
                  คัดลอกทั้งหมด
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearNumbers}
                  className="h-7 text-xs text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="size-3 mr-1" />
                  ล้าง
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {generatedNumbers.map((num, idx) => (
                <button
                  key={idx}
                  onClick={() => handleCopyNumber(num)}
                  className="group relative px-4 py-2 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg hover:border-amber-500/50 transition-all"
                >
                  <span className="font-mono font-bold text-xl text-amber-400">{num}</span>
                  <span className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {copiedNumber === num ? (
                      <Check className="size-3 text-emerald-400" />
                    ) : (
                      <Copy className="size-3 text-amber-400" />
                    )}
                  </span>
                </button>
              ))}
            </div>

            {/* Action Button */}
            <div className="mt-4 pt-4 border-t border-white/5">
              <Link href="/c/buy">
                <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-black font-bold">
                  <Star className="size-4 mr-2" />
                  นำไปแทงหวย
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips Card */}
      <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border-cyan-500/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
              <Calculator className="size-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white mb-1">วิธีใช้งาน</p>
              <ul className="text-xs text-[#94A3B8] space-y-1">
                <li>• <strong>สุ่มเลข:</strong> สร้างเลขแบบสุ่มตามจำนวนที่ต้องการ</li>
                <li>• <strong>เลขกลับ:</strong> สร้างทุกรูปแบบการสลับหลักจากเลขต้นแบบ</li>
                <li>• <strong>เลขใกล้เคียง:</strong> สร้างเลข +/-1 ของแต่ละหลัก</li>
                <li>• กดที่ตัวเลขเพื่อคัดลอก</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
