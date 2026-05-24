'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ClipboardPaste, Sparkles, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ParsedEntry {
  number: string;
  betType: '2top' | '2bot' | '3top' | '3tod' | '1top' | '1bot';
  amount: number;
  original?: string;
}

interface SmartPasteProps {
  onEntriesGenerated: (entries: ParsedEntry[]) => void;
  blockedNumbers?: string[];
  className?: string;
}

// Advanced parsing patterns
const PATTERNS = {
  // Pattern 1: "123*100" or "123=100" or "123x100"
  simple: /(\d{1,3})\s*[*=x×]\s*(\d+)/gi,
  // Pattern 2: "123 บน 100" or "123บน100"
  thai: /(\d{1,3})\s*(บน|ล่าง|โต๊ด|วิ่งบน|วิ่งล่าง)\s*(\d+)/gi,
  // Pattern 3: "12 x 100 x 50" (บน/ล่าง)
  double: /(\d{2})\s*[*=x×]\s*(\d+)\s*[*=x×]\s*(\d+)/gi,
  // Pattern 4: "123 x 100 x 50" (บน/โต๊ด)
  triple: /(\d{3})\s*[*=x×]\s*(\d+)\s*[*=x×]\s*(\d+)/gi,
  // Pattern 5: "12,13,14 x 100"
  multi: /([\d,\s]+)\s*[*=x×]\s*(\d+)/gi,
  // Pattern 6: Simple "123 100" (space separated)
  space: /(\d{1,3})\s+(\d+)(?!\d)/g,
};

// Generate all permutations of 2 digits
function generateFlip2(num: string): string[] {
  if (num.length !== 2) return [num];
  const results = new Set<string>();
  results.add(num);
  results.add(num[1] + num[0]);
  return Array.from(results);
}

// Generate all permutations of 3 digits
function generateFlip3(num: string): string[] {
  if (num.length !== 3) return [num];
  const results = new Set<string>();
  const [a, b, c] = num.split('');
  results.add(a + b + c);
  results.add(a + c + b);
  results.add(b + a + c);
  results.add(b + c + a);
  results.add(c + a + b);
  results.add(c + b + a);
  return Array.from(results);
}

// Generate 19 ประตู
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

// Generate 6 กลับ (3 digits to all 6 permutations)
function generate6Flip(num: string): string[] {
  if (num.length !== 3) return [num];
  return generateFlip3(num);
}

export function SmartPaste({ onEntriesGenerated, blockedNumbers = [], className }: SmartPasteProps) {
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<ParsedEntry[]>([]);
  const [blockedInPreview, setBlockedInPreview] = useState<string[]>([]);

  // Parse input text
  const parseInput = useCallback((text: string): ParsedEntry[] => {
    const entries: ParsedEntry[] = [];
    const lines = text.split(/[\n,;]+/).map(l => l.trim()).filter(l => l);

    for (const line of lines) {
      let matched = false;

      // Check for "กลับ" or "r" suffix (reverse/flip)
      const hasFlip = /[กลับr]$/i.test(line);
      const cleanLine = line.replace(/\s*[กลับr]\s*$/i, '').trim();

      // Check for "19ประตู" pattern
      const door19Match = cleanLine.match(/(\d)\s*19\s*ประตู\s*[*=x×]?\s*(\d+)/i) ||
                          cleanLine.match(/(\d)\s*r\s*19\s*[*=x×]?\s*(\d+)/i);
      if (door19Match) {
        const digit = door19Match[1];
        const amount = parseInt(door19Match[2]);
        generate19Door(digit).forEach(num => {
          entries.push({ number: num, betType: '2top', amount, original: line });
        });
        continue;
      }

      // Pattern: "12 x 100 x 50" (2 digits with บน/ล่าง)
      const doubleMatch = cleanLine.match(/^(\d{2})\s*[*=x×]\s*(\d+)\s*[*=x×]\s*(\d+)$/);
      if (doubleMatch) {
        const [, num, amtTop, amtBot] = doubleMatch;
        const numbers = hasFlip ? generateFlip2(num) : [num];
        numbers.forEach(n => {
          if (parseInt(amtTop) > 0) entries.push({ number: n, betType: '2top', amount: parseInt(amtTop), original: line });
          if (parseInt(amtBot) > 0) entries.push({ number: n, betType: '2bot', amount: parseInt(amtBot), original: line });
        });
        continue;
      }

      // Pattern: "123 x 100 x 50" (3 digits with บน/โต๊ด)
      const tripleMatch = cleanLine.match(/^(\d{3})\s*[*=x×]\s*(\d+)\s*[*=x×]\s*(\d+)$/);
      if (tripleMatch) {
        const [, num, amtTop, amtTod] = tripleMatch;
        if (parseInt(amtTop) > 0) entries.push({ number: num, betType: '3top', amount: parseInt(amtTop), original: line });
        if (parseInt(amtTod) > 0) {
          generateFlip3(num).forEach(n => {
            entries.push({ number: n, betType: '3tod', amount: parseInt(amtTod), original: line });
          });
        }
        continue;
      }

      // Pattern: "12,13,14 x 100" (multiple numbers)
      const multiMatch = cleanLine.match(/^([\d,\s]+)\s*[*=x×]\s*(\d+)$/);
      if (multiMatch && multiMatch[1].includes(',')) {
        const numbers = multiMatch[1].split(',').map(n => n.trim()).filter(n => /^\d{1,3}$/.test(n));
        const amount = parseInt(multiMatch[2]);
        numbers.forEach(num => {
          const betType = num.length === 3 ? '3top' : num.length === 2 ? '2top' : '1top';
          const toAdd = hasFlip ? (num.length === 2 ? generateFlip2(num) : num.length === 3 ? generateFlip3(num) : [num]) : [num];
          toAdd.forEach(n => {
            entries.push({ number: n, betType, amount, original: line });
          });
        });
        continue;
      }

      // Pattern: Thai style "123 บน 100"
      const thaiMatch = cleanLine.match(/^(\d{1,3})\s*(บน|ล่าง|โต๊ด|วิ่งบน|วิ่งล่าง)\s*(\d+)$/);
      if (thaiMatch) {
        const [, num, type, amt] = thaiMatch;
        const typeMap: Record<string, ParsedEntry['betType']> = {
          'บน': num.length === 3 ? '3top' : '2top',
          'ล่าง': '2bot',
          'โต๊ด': '3tod',
          'วิ่งบน': '1top',
          'วิ่งล่าง': '1bot',
        };
        const betType = typeMap[type] || '2top';
        entries.push({ number: num, betType, amount: parseInt(amt), original: line });
        continue;
      }

      // Pattern: Simple "123*100" or "123=100"
      const simpleMatch = cleanLine.match(/^(\d{1,3})\s*[*=x×]\s*(\d+)$/);
      if (simpleMatch) {
        const [, num, amt] = simpleMatch;
        const betType = num.length === 3 ? '3top' : num.length === 2 ? '2top' : '1top';
        const toAdd = hasFlip ? (num.length === 2 ? generateFlip2(num) : num.length === 3 ? generateFlip3(num) : [num]) : [num];
        toAdd.forEach(n => {
          entries.push({ number: n, betType, amount: parseInt(amt), original: line });
        });
        continue;
      }

      // Pattern: Space separated "123 100"
      const spaceMatch = cleanLine.match(/^(\d{1,3})\s+(\d+)$/);
      if (spaceMatch) {
        const [, num, amt] = spaceMatch;
        const betType = num.length === 3 ? '3top' : num.length === 2 ? '2top' : '1top';
        entries.push({ number: num, betType, amount: parseInt(amt), original: line });
        continue;
      }
    }

    return entries;
  }, []);

  // Handle input change with live preview
  const handleInputChange = useCallback((text: string) => {
    setInput(text);
    const parsed = parseInput(text);
    setPreview(parsed);
    
    // Check for blocked numbers
    const blocked = parsed.filter(e => blockedNumbers.includes(e.number)).map(e => e.number);
    setBlockedInPreview([...new Set(blocked)]);
  }, [parseInput, blockedNumbers]);

  // Handle paste from clipboard
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      handleInputChange(text);
      toast.success('วางข้อความจากคลิปบอร์ดแล้ว');
    } catch {
      toast.error('ไม่สามารถอ่านคลิปบอร์ดได้');
    }
  }, [handleInputChange]);

  // Confirm and add entries
  const handleConfirm = useCallback(() => {
    // Filter out blocked numbers
    const validEntries = preview.filter(e => !blockedNumbers.includes(e.number));
    
    if (validEntries.length === 0) {
      toast.error('ไม่มีรายการที่จะเพิ่ม');
      return;
    }

    onEntriesGenerated(validEntries);
    setInput('');
    setPreview([]);
    setBlockedInPreview([]);
    
    const blockedCount = preview.length - validEntries.length;
    if (blockedCount > 0) {
      toast.warning(`เพิ่ม ${validEntries.length} รายการ (ตัดเลขอั้น ${blockedCount} รายการ)`);
    } else {
      toast.success(`เพิ่ม ${validEntries.length} รายการสำเร็จ`);
    }
  }, [preview, blockedNumbers, onEntriesGenerated]);

  const totalAmount = preview.reduce((sum, e) => sum + e.amount, 0);
  const validCount = preview.filter(e => !blockedNumbers.includes(e.number)).length;

  return (
    <Card className={cn('border-[#D4AF37]/30 bg-gradient-to-br from-black/80 to-black/60', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-[#D4AF37]">
          <Sparkles className="size-5" />
          วางโพยอัตโนมัติ (Smart Paste)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Area */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Textarea
              placeholder={`วางข้อความโพยจากลูกค้า เช่น:
123*100
45 บน 20
12x50x30 (บน/ล่าง)
789 x 100 x 50 (บน/โต๊ด)
12,13,14 x 100
5 19ประตู x 20`}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              className="min-h-[120px] bg-white text-black border-[#D4AF37]/50 focus:border-[#D4AF37] font-mono text-sm placeholder:text-gray-500"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePaste}
            className="border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10"
          >
            <ClipboardPaste className="size-4 mr-2" />
            วางจากคลิปบอร์ด
          </Button>
        </div>

        {/* Preview */}
        {preview.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">
                พบ {preview.length} รายการ | ยอดรวม: <span className="text-[#D4AF37] font-bold">฿{totalAmount.toLocaleString()}</span>
              </p>
              {blockedInPreview.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="size-3" />
                  เลขอั้น {blockedInPreview.length} ตัว
                </Badge>
              )}
            </div>

            <div className="max-h-[200px] overflow-y-auto rounded-lg bg-black/30 p-3 border border-gray-700">
              <div className="flex flex-wrap gap-2">
                {preview.map((entry, i) => {
                  const isBlocked = blockedNumbers.includes(entry.number);
                  return (
                    <Badge
                      key={i}
                      className={cn(
                        'font-mono text-sm px-2 py-1',
                        isBlocked
                          ? 'bg-red-900/50 text-red-300 line-through'
                          : 'bg-[#D4AF37]/20 text-[#D4AF37]'
                      )}
                    >
                      {entry.number} {entry.betType === '2top' ? 'บ' : entry.betType === '2bot' ? 'ล' : entry.betType === '3top' ? '3บ' : entry.betType === '3tod' ? 'ด' : entry.betType === '1top' ? 'วบ' : 'วล'} ฿{entry.amount}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Blocked Numbers Warning */}
            {blockedInPreview.length > 0 && (
              <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/30">
                <p className="text-sm text-red-400 flex items-center gap-2">
                  <AlertTriangle className="size-4" />
                  เลขอั้นที่จะถูกตัดออก: {blockedInPreview.join(', ')}
                </p>
              </div>
            )}

            {/* Confirm Button */}
            <Button
              onClick={handleConfirm}
              className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold hover:opacity-90"
            >
              <CheckCircle2 className="size-4 mr-2" />
              เพิ่ม {validCount} รายการ (฿{preview.filter(e => !blockedNumbers.includes(e.number)).reduce((s, e) => s + e.amount, 0).toLocaleString()})
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
