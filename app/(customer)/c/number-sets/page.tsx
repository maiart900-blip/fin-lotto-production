'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Shuffle, Copy, Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function NumberSetsPage() {
  const router = useRouter();
  const [baseNumber, setBaseNumber] = useState('');
  const [generatedSets, setGeneratedSets] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // สร้างเลขกลับ (Permutations)
  const generatePermutations = (str: string): string[] => {
    if (str.length <= 1) return [str];
    const perms: string[] = [];
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const remaining = str.slice(0, i) + str.slice(i + 1);
      for (const perm of generatePermutations(remaining)) {
        perms.push(char + perm);
      }
    }
    return [...new Set(perms)];
  };

  // สร้างเลขวิน
  const generateWinNumbers = (digit: string): string[] => {
    const results: string[] = [];
    for (let i = 0; i <= 9; i++) {
      results.push(digit + String(i));
      if (digit !== String(i)) {
        results.push(String(i) + digit);
      }
    }
    return [...new Set(results)];
  };

  // สร้างเลข 19 ประตู
  const generate19Gates = (digit: string): string[] => {
    const results: string[] = [];
    for (let i = 0; i <= 9; i++) {
      results.push(digit + String(i));
      results.push(String(i) + digit);
    }
    return [...new Set(results)].sort();
  };

  const handleGenerate = (type: 'permute' | 'win' | '19gates') => {
    if (!baseNumber) {
      toast.error('กรุณากรอกตัวเลข');
      return;
    }

    let results: string[] = [];
    
    if (type === 'permute') {
      if (baseNumber.length < 2 || baseNumber.length > 4) {
        toast.error('กรุณากรอก 2-4 หลัก');
        return;
      }
      results = generatePermutations(baseNumber);
    } else if (type === 'win') {
      if (baseNumber.length !== 1) {
        toast.error('กรุณากรอก 1 หลัก');
        return;
      }
      results = generateWinNumbers(baseNumber);
    } else if (type === '19gates') {
      if (baseNumber.length !== 1) {
        toast.error('กรุณากรอก 1 หลัก');
        return;
      }
      results = generate19Gates(baseNumber);
    }

    setGeneratedSets(results);
    setCopied(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedSets.join(' '));
    setCopied(true);
    toast.success('คัดลอกแล้ว');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRandom = () => {
    const random2d = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    setBaseNumber(random2d);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-semibold">สร้างเลขชุด</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Banner */}
        <div className="bg-gradient-to-r from-violet-500 to-purple-500 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3">
            <Sparkles className="size-10" />
            <div>
              <h2 className="text-xl font-bold">สร้างเลขชุดอัตโนมัติ</h2>
              <p className="text-white/80 text-sm">เลขกลับ, เลขวิน, 19 ประตู</p>
            </div>
          </div>
        </div>

        {/* Input */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label>กรอกตัวเลข</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={baseNumber}
                  onChange={(e) => setBaseNumber(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="กรอกเลข 1-4 หลัก"
                  className="text-center text-2xl font-bold tracking-widest"
                  maxLength={4}
                />
                <Button variant="outline" size="icon" onClick={handleRandom}>
                  <Shuffle className="size-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button 
                onClick={() => handleGenerate('permute')}
                className="bg-gradient-to-r from-orange-500 to-red-500"
              >
                เลขกลับ
              </Button>
              <Button 
                onClick={() => handleGenerate('win')}
                className="bg-gradient-to-r from-blue-500 to-cyan-500"
              >
                เลขวิน
              </Button>
              <Button 
                onClick={() => handleGenerate('19gates')}
                className="bg-gradient-to-r from-green-500 to-emerald-500"
              >
                19 ประตู
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {generatedSets.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  ผลลัพธ์ ({generatedSets.length} เลข)
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <Check className="size-4 mr-1" />
                      คัดลอกแล้ว
                    </>
                  ) : (
                    <>
                      <Copy className="size-4 mr-1" />
                      คัดลอก
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {generatedSets.map((num, i) => (
                  <Badge 
                    key={i}
                    variant="outline"
                    className="text-lg font-mono px-3 py-1"
                  >
                    {num}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tips */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">คำอธิบาย</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>เลขกลับ:</strong> สลับตำแหน่งเลข เช่น 123 → 123, 132, 213, 231, 312, 321</p>
            <p><strong>เลขวิน:</strong> จับคู่กับ 0-9 เช่น 5 → 50, 51, 52... 05, 15, 25...</p>
            <p><strong>19 ประตู:</strong> จับคู่หน้า-หลังกับ 0-9 รวม 19 เลข</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
