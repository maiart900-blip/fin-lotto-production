'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { parseBetInput, formatBetType, type ParsedBet, type ParseResult } from '@/lib/bet-parser';
import { formatCurrency, cn } from '@/lib/utils';
import {
  Zap,
  Trash2,
  Printer,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Flame,
  Ban,
  Crown,
  Loader2,
  RotateCcw,
  Keyboard,
  X,
  Send,
  Receipt,
  Share2,
  MessageCircle,
  Clock,
  Hash,
  FileText,
  ClipboardPaste,
  Shuffle,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface TempBet extends ParsedBet {
  id: string;
}

interface ExposureData {
  hotNumbers: { number: string; total: number; count: number }[];
  riskNumbers: { number: string; total: number; limit: number }[];
  blockedNumbers: string[];
  totalVolume: number;
  maxPayout: number;
}

export default function BettingDashboard() {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Lottery selection
  const [selectedLotteryId, setSelectedLotteryId] = useState<string>('');
  
  // Bet input state
  const [betInput, setBetInput] = useState('');
  const [parsedPreview, setParsedPreview] = useState<ParseResult | null>(null);
  const [tempBets, setTempBets] = useState<TempBet[]>([]);
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [ticketId, setTicketId] = useState<string>('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  
  // Simple Paste Modal state
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteType, setPasteType] = useState<'bon' | 'lang' | 'tod' | 'reverse'>('bon');
  const [pastePrice, setPastePrice] = useState('100');
  
  // Win Digits Modal state
  const [showWinModal, setShowWinModal] = useState(false);
  const [selectedWinDigits, setSelectedWinDigits] = useState<Set<string>>(new Set());
  const [winType, setWinType] = useState<'2' | '3'>('2');
  const [winBetType, setWinBetType] = useState<'bon' | 'lang' | 'tod' | 'reverse'>('bon');
  const [winPrice, setWinPrice] = useState('100');
  const [winResults, setWinResults] = useState<string[]>([]);
  
  // Fetch lotteries
  const { data: lotteries } = useSWR('/api/lotteries?status=open', fetcher);
  
  // Fetch exposure data (realtime)
  const { data: exposureData, mutate: mutateExposure } = useSWR<ExposureData>(
    selectedLotteryId ? `/api/exposure?lottery_id=${selectedLotteryId}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  // Selected lottery
  const selectedLottery = lotteries?.find((l: any) => l.id === selectedLotteryId);

  // Auto-select first lottery
  useEffect(() => {
    if (lotteries?.length > 0 && !selectedLotteryId) {
      setSelectedLotteryId(lotteries[0].id);
    }
  }, [lotteries, selectedLotteryId]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Generate unique ID
  const generateId = () => Math.random().toString(36).substring(2, 9);

  // เช็คเลขปิดรับ (เลขอั้น)
  const isBlockedNumber = (number: string): boolean => {
    const blocked = exposureData?.blockedNumbers || [];
    return blocked.includes(number);
  };

  // กรองเลขอั้นออกจากรายการ และแจ้งเตือน
  const filterBlockedNumbers = (bets: TempBet[]): { allowed: TempBet[]; blocked: string[] } => {
    const blocked: string[] = [];
    const allowed: TempBet[] = [];
    
    bets.forEach(bet => {
      if (isBlockedNumber(bet.number)) {
        blocked.push(bet.number);
      } else {
        allowed.push(bet);
      }
    });
    
    return { allowed, blocked };
  };

  // สร้างเลขกลับ (reverse)
  const reverseNumber = (number: string): string => {
    return number.split('').reverse().join('');
  };

  // ฟังก์ชันวินเลข 2 ตัว (ไม่รวมเลขเบิ้ล)
  const win2Digits = (numbers: string[]) => {
    const results: string[] = [];
    for (let i = 0; i < numbers.length; i++) {
      for (let j = 0; j < numbers.length; j++) {
        if (i !== j) {
          results.push(numbers[i] + numbers[j]);
        }
      }
    }
    return results;
  };

  // ฟังก์ชันวินเลข 3 ตัว
  const win3Digits = (numbers: string[]) => {
    const results: string[] = [];
    for (let i = 0; i < numbers.length; i++) {
      for (let j = 0; j < numbers.length; j++) {
        for (let k = 0; k < numbers.length; k++) {
          if (i !== j && j !== k && i !== k) {
            results.push(numbers[i] + numbers[j] + numbers[k]);
          }
        }
      }
    }
    return results;
  };

  // Toggle digit selection (0-9 buttons)
  const toggleWinDigit = (digit: string) => {
    setSelectedWinDigits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(digit)) {
        newSet.delete(digit);
      } else {
        newSet.add(digit);
      }
      // Generate results immediately
      const digits = Array.from(newSet);
      if (digits.length >= 2) {
        const results = winType === '2' ? win2Digits(digits) : win3Digits(digits);
        setWinResults(results);
      } else {
        setWinResults([]);
      }
      return newSet;
    });
  };

  // Handle win type change
  const handleWinTypeChange = (type: '2' | '3') => {
    setWinType(type);
    // Reset bet type to appropriate default when switching
    setWinBetType('bon');
    const digits = Array.from(selectedWinDigits);
    
    if (digits.length >= 2) {
      const results = type === '2' ? win2Digits(digits) : win3Digits(digits);
      setWinResults(results);
    } else {
      setWinResults([]);
    }
  };

  // Handle win submit
  const handleWinSubmit = () => {
    if (winResults.length === 0) {
      toast.error('ไม่มีเลขวิน กรุณากรอกตัวเลขอย่างน้อย 2 ตัว');
      return;
    }

    const priceNum = parseInt(winPrice) || 100;
    
    // Determine correct bet type based on winType and winBetType
    let actualBetType: string;
    if (winType === '2') {
      // 2-digit modes
      if (winBetType === 'bon') actualBetType = '2top';
      else if (winBetType === 'lang') actualBetType = '2bot';
      else actualBetType = '2top'; // default
    } else {
      // 3-digit modes
      if (winBetType === 'bon') actualBetType = '3top';
      else if (winBetType === 'tod') actualBetType = '3tod';
      else actualBetType = '3top'; // default for reverse (all permutations go to 3top)
    }
    
    // For reverse mode, generate all permutations
    let numbersToAdd = winResults;
    if (winBetType === 'reverse') {
      // Generate unique permutations for each win number
      const allPerms = new Set<string>();
      winResults.forEach(num => {
        // Get all permutations of this number
        const perms = getPermutations(num);
        perms.forEach(p => allPerms.add(p));
      });
      numbersToAdd = Array.from(allPerms);
    }
    
    const newBets: TempBet[] = numbersToAdd.map(num => ({
      id: generateId(),
      number: num,
      betType: actualBetType,
      amount: priceNum,
    }));

    // เช็คเลขอั้น
    const { allowed, blocked } = filterBlockedNumbers(newBets);
    
    if (blocked.length > 0) {
      toast.error(`เลข ${blocked.join(', ')} ปิดรับแล้ว!`, { duration: 3000 });
    }
    
    if (allowed.length === 0) {
      setShowWinModal(false);
      setSelectedWinDigits(new Set());
      setWinResults([]);
      return;
    }

    setTempBets(prev => [...prev, ...allowed]);
    setShowWinModal(false);
    setSelectedWinDigits(new Set());
    setWinResults([]);
    
    const msg = blocked.length > 0 
      ? `เพิ่ม ${allowed.length} เลขวิน (ข้าม ${blocked.length} เลขอั้น)`
      : `เพิ่ม ${allowed.length} เลขวินสำเร็จ`;
    toast.success(msg);
  };
  
  // Get permutations helper
  const getPermutations = (str: string): string[] => {
    if (str.length <= 1) return [str];
    const permutations: string[] = [];
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const remaining = str.slice(0, i) + str.slice(i + 1);
      for (const perm of getPermutations(remaining)) {
        permutations.push(char + perm);
      }
    }
    return [...new Set(permutations)];
  };

  // ฟังก์ชันวิเคราะห์โพยจากการ Paste (แบบง่าย)
  const parseLottoText = (text: string, type: 'bon' | 'lang' | 'tod' | 'reverse', pricePerUnit: number) => {
    const lines = text.split(/[\n, ]+/);
    const results: { number: string; price: number; betType: 'top' | 'bottom' | 'tood' }[] = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      // ค้นหาตัวเลข (2-3 หลัก) และราคา (ถ้ามี) เช่น 123=100 หรือ 123-100 หรือ 123*100
      const matchWithPrice = trimmed.match(/^(\d{2,3})[=\-*x](\d+)$/i);
      const matchNumberOnly = trimmed.match(/^(\d{2,3})$/);
      
      let number = '';
      let price = pricePerUnit;
      
      if (matchWithPrice) {
        number = matchWithPrice[1];
        price = parseInt(matchWithPrice[2]);
      } else if (matchNumberOnly) {
        number = matchNumberOnly[1];
      }
      
      if (number) {
        // ถ้าเป็นโหมด "กลับ" ให้เพิ่มทั้งเลขปกติและเลขกลับ (บน+ล่าง)
        if (type === 'reverse') {
          results.push({ number, price, betType: 'top' });
          results.push({ number, price, betType: 'bottom' });
          
          const reversed = reverseNumber(number);
          if (reversed !== number) {
            results.push({ number: reversed, price, betType: 'top' });
            results.push({ number: reversed, price, betType: 'bottom' });
          }
        } else {
          const betTypeMap = { bon: 'top', lang: 'bottom', tod: 'tood' } as const;
          results.push({ number, price, betType: betTypeMap[type] });
        }
      }
    });
    return results;
  };

  // Handle paste submit
  const handlePasteSubmit = () => {
    const priceNum = parseInt(pastePrice) || 100;
    const parsed = parseLottoText(pasteText, pasteType, priceNum);
    
    if (parsed.length === 0) {
      toast.error('ไม่พบเลขที่ถูกต้อง');
      return;
    }
    
    const newBets: TempBet[] = parsed.map(p => ({
      id: generateId(),
      number: p.number,
      betType: p.betType as TempBet['betType'],
      amount: p.price,
    }));

    // เช็คเลขอั้น
    const { allowed, blocked } = filterBlockedNumbers(newBets);
    
    if (blocked.length > 0) {
      toast.error(`เลข ${blocked.join(', ')} ปิดรับแล้ว!`, { duration: 3000 });
    }
    
    if (allowed.length === 0) {
      setPasteText('');
      setShowPasteModal(false);
      return;
    }

    setTempBets(prev => [...prev, ...allowed]);
    setPasteText('');
    setShowPasteModal(false);
    
    const msg = blocked.length > 0 
      ? `เพิ่ม ${allowed.length} รายการ (ข้าม ${blocked.length} เลขอั้น)`
      : `เพิ่ม ${allowed.length} รายการจากการ Paste`;
    toast.success(msg);
  };

  // Realtime parsing
  const handleInputChange = useCallback((value: string) => {
    setBetInput(value);
    if (value.trim()) {
      const result = parseBetInput(value);
      setParsedPreview(result);
    } else {
      setParsedPreview(null);
    }
  }, []);

  // Add bets to table
  const addBets = useCallback(() => {
    if (!parsedPreview?.success || parsedPreview.bets.length === 0) {
      toast.error('รูปแบบไม่ถูกต้อง');
      return;
    }

    const hasZeroAmount = parsedPreview.bets.some(b => b.amount === 0);
    if (hasZeroAmount) {
      toast.error('กรุณาระบุราคา เช่น 12x100');
      return;
    }

    const newBets: TempBet[] = parsedPreview.bets.map(bet => ({
      ...bet,
      id: generateId(),
    }));

    // เช็คเลขอั้น
    const { allowed, blocked } = filterBlockedNumbers(newBets);
    
    if (blocked.length > 0) {
      toast.error(`เลข ${blocked.join(', ')} ปิดรับแล้ว!`, { duration: 3000 });
    }
    
    if (allowed.length === 0) {
      return;
    }

    setTempBets(prev => [...prev, ...allowed]);
    setBetInput('');
    setParsedPreview(null);
    inputRef.current?.focus();
    
    const msg = blocked.length > 0 
      ? `เพิ่ม ${allowed.length} รายการ (ข้าม ${blocked.length} เลขอั้น)`
      : `เพิ่ม ${allowed.length} รายการ`;
    toast.success(msg);
  }, [parsedPreview, exposureData]);

  // Remove single bet
  const removeBet = (id: string) => {
    setTempBets(prev => prev.filter(b => b.id !== id));
  };

  // Clear all
  const clearAll = () => {
    setTempBets([]);
    setBetInput('');
    setParsedPreview(null);
    inputRef.current?.focus();
  };

  // Calculate totals
  const totalAmount = tempBets.reduce((sum, b) => sum + b.amount, 0);
  const totalItems = tempBets.length;

  // Keyboard handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addBets();
    } else if (e.key === 'Escape') {
      setBetInput('');
      setParsedPreview(null);
    } else if (e.key === 'F1') {
      e.preventDefault();
      setShowShortcuts(true);
    }
  };

  // Submit ticket
  const handleSubmit = async () => {
    if (tempBets.length === 0) {
      toast.error('ไม่มีรายการ');
      return;
    }

    if (!selectedLotteryId) {
      toast.error('กรุณาเลือกหวย');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lottery_id: selectedLotteryId,
          entries: tempBets.map(b => ({
            number: b.number,
            bet_type: b.betType,
            amount: b.amount,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'บันทึกไม่สำเร็จ');
      }

      const data = await res.json();
      setTicketId(data.ticket_id || generateId().toUpperCase());
      setShowConfirmDialog(false);
      setShowSuccessDialog(true);
      setTempBets([]);
      mutateExposure();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate ticket text for sharing
  const generateTicketText = useCallback(() => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    
    let text = `🎰 FIN LOTTO R+\n`;
    text += `━━━━━━━━━━━━━━━━\n`;
    text += `📋 โพย: ${ticketId || 'TEMP-' + generateId().toUpperCase()}\n`;
    text += `🎯 หวย: ${selectedLottery?.name || '-'}\n`;
    text += `📅 ${dateStr} เวลา ${timeStr}\n`;
    text += `━━━━━━━━━━━━━━━━\n\n`;
    
    tempBets.forEach((bet, idx) => {
      text += `${idx + 1}. ${bet.number} (${formatBetType(bet.betType)}) = ${bet.amount.toLocaleString()} บาท\n`;
    });
    
    text += `\n━━━━━━━━━━━━━━━━\n`;
    text += `💰 รวม: ${totalAmount.toLocaleString()} บาท\n`;
    text += `📝 จำนวน: ${totalItems} รายการ\n`;
    text += `━━━━━━━━━━━━━━━\n`;
    text += `✅ FIN LOTTO R+ Premium`;
    
    return text;
  }, [tempBets, totalAmount, totalItems, ticketId, selectedLottery]);

  // Share to Line
  const handleShareToLine = useCallback(() => {
    const text = generateTicketText();
    const encodedText = encodeURIComponent(text);
    window.open(`https://line.me/R/share?text=${encodedText}`, '_blank');
    toast.success('เปิด Line แชร์โพย');
  }, [generateTicketText]);

  // Copy to clipboard
  const handleCopyTicket = useCallback(async () => {
    const text = generateTicketText();
    await navigator.clipboard.writeText(text);
    toast.success('คัดลอกโพยแล้ว');
  }, [generateTicketText]);

  // Open receipt dialog
  const handleOpenReceipt = () => {
    setShowReceiptDialog(true);
  };

  // Print receipt (thermal style)
  const handlePrintReceipt = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH');
    const timeStr = now.toLocaleTimeString('th-TH');
    const currentTicketId = ticketId || 'TEMP-' + generateId().toUpperCase();
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${currentTicketId}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            width: 80mm;
            padding: 5mm;
            background: white;
            color: #000;
          }
          .header { text-align: center; margin-bottom: 10px; }
          .logo { font-size: 18px; font-weight: bold; color: #1e3a5f; }
          .sub { font-size: 10px; color: #666; }
          .divider { border-top: 1px dashed #333; margin: 8px 0; }
          .info { font-size: 11px; margin: 4px 0; }
          .info-row { display: flex; justify-content: space-between; }
          .items { margin: 10px 0; }
          .item { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
          .item-num { font-weight: bold; }
          .total-section { background: #f5f5f5; padding: 8px; margin: 10px 0; border-radius: 4px; }
          .total { font-size: 16px; font-weight: bold; text-align: right; }
          .footer { text-align: center; font-size: 10px; color: #666; margin-top: 10px; }
          @media print {
            body { width: 80mm; }
            @page { size: 80mm auto; margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">🎰 FIN LOTTO R+</div>
          <div class="sub">Premium Lottery System</div>
        </div>
        
        <div class="divider"></div>
        
        <div class="info">
          <div class="info-row"><span>เลขโพย:</span><span>${currentTicketId}</span></div>
          <div class="info-row"><span>หวย:</span><span>${selectedLottery?.name || '-'}</span></div>
          <div class="info-row"><span>วันที่:</span><span>${dateStr}</span></div>
          <div class="info-row"><span>เวลา:</span><span>${timeStr}</span></div>
        </div>
        
        <div class="divider"></div>
        
        <div class="items">
          ${tempBets.map((bet, idx) => `
            <div class="item">
              <span class="item-num">${bet.number}</span>
              <span>${formatBetType(bet.betType)}</span>
              <span>${bet.amount.toLocaleString()}</span>
            </div>
          `).join('')}
        </div>
        
        <div class="divider"></div>
        
        <div class="total-section">
          <div class="info-row"><span>จำนวน:</span><span>${totalItems} รายการ</span></div>
          <div class="total">รวม: ฿${totalAmount.toLocaleString()}</div>
        </div>
        
        <div class="divider"></div>
        
        <div class="footer">
          <p>ขอบคุณที่ใช้บริการ</p>
          <p>FIN LOTTO R+ Premium</p>
        </div>
        
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 size-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] bg-amber-500/3 rounded-full blur-3xl" />
      </div>

      <div className="relative p-4 lg:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/20">
              <Crown className="size-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                Betting Terminal
              </h1>
              <p className="text-sm text-slate-400">Premium Lotto System</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={selectedLotteryId} onValueChange={setSelectedLotteryId}>
              <SelectTrigger className="w-[200px] bg-slate-800/50 border-slate-700 text-white">
                <SelectValue placeholder="เลือกหวย" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {lotteries?.map((lottery: any) => (
                  <SelectItem key={lottery.id} value={lottery.id} className="text-white hover:bg-slate-700">
                    {lottery.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowShortcuts(true)}
              className="border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <Keyboard className="size-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-8 space-y-6">
            {/* Smart Bet Input */}
            <Card className="bg-slate-900/80 border-slate-800 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-amber-400">
                  <Zap className="size-5" />
                  Smart Bet Input
                  <Badge variant="outline" className="ml-auto border-amber-500/30 text-amber-400 text-xs">
                    Enter = Add
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Input
                      ref={inputRef}
                      type="text"
                      placeholder="Type: 123x100x50, 12x100r, 5r19..."
                      value={betInput}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="h-14 text-lg font-mono bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20"
                    />
                    {betInput && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setBetInput(''); setParsedPreview(null); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                  <Button
                    onClick={addBets}
                    disabled={!parsedPreview?.success}
                    className="h-14 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg shadow-amber-500/20"
                  >
                    <Zap className="size-5 mr-2" />
                    Add
                  </Button>
                  <Button
                    onClick={() => setShowPasteModal(true)}
                    variant="outline"
                    className="h-14 px-4 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
                  >
                    <ClipboardPaste className="size-5 mr-2" />
                    Paste โพย
                  </Button>
                  <Button
                    onClick={() => setShowWinModal(true)}
                    variant="outline"
                    className="h-14 px-4 border-purple-500/50 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300"
                  >
                    <Shuffle className="size-5 mr-2" />
                    วินเลข
                  </Button>
                </div>

                {/* Realtime Preview */}
                {parsedPreview && (
                  <div className={`p-4 rounded-lg border ${
                    parsedPreview.success 
                      ? 'bg-emerald-950/30 border-emerald-800' 
                      : 'bg-red-950/30 border-red-800'
                  }`}>
                    {parsedPreview.success ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-emerald-400">
                          <CheckCircle className="size-4" />
                          <span>Preview: {parsedPreview.bets.length} items</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {parsedPreview.bets.slice(0, 10).map((bet, idx) => (
                            <Badge key={idx} variant="secondary" className="bg-slate-800 text-white font-mono">
                              {bet.number} - {formatBetType(bet.betType)} - {bet.amount > 0 ? `${bet.amount}` : '-'}
                            </Badge>
                          ))}
                          {parsedPreview.bets.length > 10 && (
                            <Badge variant="outline" className="border-slate-600 text-slate-400">
                              +{parsedPreview.bets.length - 10} more
                            </Badge>
                          )}
                        </div>
                        <div className="text-right text-emerald-400 font-semibold">
                          Total: {formatCurrency(parsedPreview.bets.reduce((s, b) => s + b.amount, 0))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-red-400">
                        <X className="size-4" />
                        <span>{parsedPreview.error || 'Invalid format'}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Live Bet Table */}
            <Card className="bg-slate-900/80 border-slate-800 backdrop-blur">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Receipt className="size-5 text-amber-400" />
                    Current Ticket
                    {tempBets.length > 0 && (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                        {tempBets.length} items
                      </Badge>
                    )}
                  </CardTitle>
                  {tempBets.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAll}
                      className="text-slate-400 hover:text-red-400"
                    >
                      <RotateCcw className="size-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {tempBets.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Receipt className="size-12 mx-auto mb-3 opacity-50" />
                    <p>No entries yet</p>
                    <p className="text-sm mt-1">Type in the input above to add bets</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-800 hover:bg-transparent">
                          <TableHead className="text-slate-400">Number</TableHead>
                          <TableHead className="text-slate-400">Type</TableHead>
                          <TableHead className="text-right text-slate-400">Amount</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tempBets.map((bet) => (
                          <TableRow key={bet.id} className="border-slate-800 hover:bg-slate-800/50">
                            <TableCell className="font-mono font-bold text-lg text-white">
                              {bet.number}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-slate-600 text-slate-300">
                                {formatBetType(bet.betType)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-amber-400">
                              {formatCurrency(bet.amount)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeBet(bet.id)}
                                className="size-8 text-slate-500 hover:text-red-400 hover:bg-red-950/30"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}

                {/* Total Summary */}
                {tempBets.length > 0 && (
                  <>
                    <Separator className="my-4 bg-slate-800" />
                    <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-amber-950/30 to-amber-900/20 border border-amber-500/20">
                      <div>
                        <p className="text-sm text-slate-400">Total Amount</p>
                        <p className="text-3xl font-bold text-amber-400">
                          {formatCurrency(totalAmount)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-400">Items</p>
                        <p className="text-2xl font-bold text-white">{totalItems}</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {/* Issue Bill / Receipt */}
              <Button
                variant="outline"
                size="lg"
                onClick={handleOpenReceipt}
                disabled={tempBets.length === 0}
                className="flex-1 h-14 border-amber-600/50 bg-gradient-to-r from-amber-950/50 to-amber-900/30 text-amber-400 hover:from-amber-900/50 hover:to-amber-800/40 hover:text-amber-300 disabled:opacity-50"
              >
                <Receipt className="size-5 mr-2" />
                ออกบิล
              </Button>
              
              {/* Share to Line */}
              <Button
                variant="outline"
                size="lg"
                onClick={handleShareToLine}
                disabled={tempBets.length === 0}
                className="h-14 px-6 border-emerald-600/50 bg-gradient-to-r from-emerald-950/50 to-emerald-900/30 text-emerald-400 hover:from-emerald-900/50 hover:to-emerald-800/40 hover:text-emerald-300 disabled:opacity-50"
              >
                <MessageCircle className="size-5" />
              </Button>
              
              {/* Confirm Bet */}
              <Button
                size="lg"
                onClick={() => setShowConfirmDialog(true)}
                disabled={tempBets.length === 0 || !selectedLotteryId}
                className="flex-1 h-14 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                <Send className="size-5 mr-2" />
                ยืนยันโพย
              </Button>
            </div>
          </div>

          {/* Exposure Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Lottery Info */}
            {selectedLottery && (
              <Card className="bg-slate-900/80 border-slate-800 backdrop-blur">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 mb-2">
                      OPEN
                    </Badge>
                    <h3 className="text-xl font-bold text-white">{selectedLottery.name}</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      Closes: {new Date(selectedLottery.close_time).toLocaleTimeString('th-TH')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Hot Numbers */}
            <Card className="bg-slate-900/80 border-slate-800 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-orange-400">
                  <Flame className="size-5" />
                  Hot Numbers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {exposureData?.hotNumbers?.length ? (
                  <div className="space-y-2">
                    {exposureData.hotNumbers.slice(0, 8).map((item, idx) => (
                      <div key={item.number} className="flex items-center justify-between p-2 rounded bg-slate-800/50">
                        <div className="flex items-center gap-2">
                          <span className={`size-6 flex items-center justify-center rounded text-xs font-bold ${
                            idx < 3 ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="font-mono font-bold text-white">{item.number}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-amber-400 font-semibold">{formatCurrency(item.total)}</span>
                          <span className="text-xs text-slate-500 ml-2">({item.count})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-4">No data</p>
                )}
              </CardContent>
            </Card>

            {/* Risk Numbers */}
            <Card className="bg-slate-900/80 border-slate-800 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="size-5" />
                  Risk Numbers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {exposureData?.riskNumbers?.length ? (
                  <div className="space-y-2">
                    {exposureData.riskNumbers.map((item) => (
                      <div key={item.number} className="flex items-center justify-between p-2 rounded bg-red-950/30 border border-red-800/50">
                        <span className="font-mono font-bold text-white">{item.number}</span>
                        <div className="text-right">
                          <span className="text-red-400 font-semibold">{formatCurrency(item.total)}</span>
                          <span className="text-xs text-slate-500 ml-1">/ {formatCurrency(item.limit)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-emerald-500 py-4 flex items-center justify-center gap-2">
                    <CheckCircle className="size-4" />
                    All clear
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Blocked Numbers */}
            {exposureData?.blockedNumbers && exposureData.blockedNumbers.length > 0 && (
              <Card className="bg-slate-900/80 border-slate-800 backdrop-blur border-red-800/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-red-500">
                    <Ban className="size-5" />
                    Blocked
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {exposureData?.blockedNumbers?.map((num) => (
                      <Badge key={num} variant="destructive" className="font-mono">
                        {num}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stats */}
            <Card className="bg-slate-900/80 border-slate-800 backdrop-blur">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-slate-800/50">
                    <p className="text-xs text-slate-400">Volume</p>
                    <p className="text-lg font-bold text-white">
                      {formatCurrency(exposureData?.totalVolume || 0)}
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-slate-800/50">
                    <p className="text-xs text-slate-400">Max Payout</p>
                    <p className="text-lg font-bold text-amber-400">
                      {formatCurrency(exposureData?.maxPayout || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-amber-400">Confirm Ticket</DialogTitle>
            <DialogDescription className="text-slate-400">
              Please verify before submitting
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-slate-800/50">
              <div className="flex justify-between mb-2">
                <span className="text-slate-400">Lottery</span>
                <span className="text-white font-semibold">{selectedLottery?.name}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-slate-400">Items</span>
                <span className="text-white font-semibold">{totalItems}</span>
              </div>
              <Separator className="my-3 bg-slate-700" />
              <div className="flex justify-between">
                <span className="text-slate-400">Total</span>
                <span className="text-2xl font-bold text-amber-400">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} className="border-slate-700 text-slate-300">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="size-4 mr-2" />
                  Confirm
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white text-center">
          <div className="py-6">
            <div className="size-20 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="size-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Success!</h2>
            <p className="text-slate-400 mb-4">Ticket submitted successfully</p>
            <div className="p-4 rounded-lg bg-slate-800/50 mb-6">
              <p className="text-xs text-slate-400">Ticket ID</p>
              <p className="text-2xl font-mono font-bold text-amber-400">{ticketId}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={handlePrintReceipt} className="border-slate-700 text-slate-300">
                <Printer className="size-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" className="border-slate-700 text-slate-300">
                <Share2 className="size-4 mr-2" />
                Share
              </Button>
              <Button 
                onClick={() => { setShowSuccessDialog(false); inputRef.current?.focus(); }}
                className="bg-amber-600 hover:bg-amber-700"
              >
                <Zap className="size-4 mr-2" />
                New Bet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog - Thermal Style */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="bg-gradient-to-b from-slate-900 to-slate-950 border-amber-600/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              <div className="flex items-center justify-center gap-2 text-amber-400">
                <Receipt className="size-6" />
                ใบเสร็จโพยชั่วคราว
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {/* Receipt Content - Thermal Style */}
          <div className="bg-white text-black rounded-lg p-4 font-mono text-sm">
            {/* Header */}
            <div className="text-center border-b-2 border-dashed border-gray-400 pb-3 mb-3">
              <div className="text-lg font-bold text-blue-900">FIN LOTTO R+</div>
              <div className="text-xs text-gray-500">Premium Lottery System</div>
            </div>
            
            {/* Info */}
            <div className="space-y-1 text-xs border-b border-dashed border-gray-300 pb-3 mb-3">
              <div className="flex justify-between">
                <span className="text-gray-600">เลขโพย:</span>
                <span className="font-bold">{ticketId || 'TEMP-' + generateId().toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">หวย:</span>
                <span className="font-semibold text-blue-800">{selectedLottery?.name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">วันที่:</span>
                <span>{new Date().toLocaleDateString('th-TH')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">เวลา:</span>
                <span>{new Date().toLocaleTimeString('th-TH')}</span>
              </div>
            </div>
            
            {/* Items */}
            <div className="border-b border-dashed border-gray-300 pb-3 mb-3">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>เลข</span>
                <span>ประเภท</span>
                <span>ราคา</span>
              </div>
              <div className="max-h-[200px] overflow-auto space-y-1">
                {tempBets.map((bet, idx) => (
                  <div key={bet.id} className="flex justify-between text-xs">
                    <span className="font-bold w-12">{bet.number}</span>
                    <span className="text-gray-600 flex-1 text-center">{formatBetType(bet.betType)}</span>
                    <span className="text-right w-20">{bet.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Total */}
            <div className="bg-blue-50 -mx-4 px-4 py-3 border-y-2 border-dashed border-blue-300">
              <div className="flex justify-between text-xs mb-1">
                <span>จำนวนรายการ:</span>
                <span>{totalItems} รายการ</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-blue-900">
                <span>รวมทั้งหมด:</span>
                <span>฿{totalAmount.toLocaleString()}</span>
              </div>
            </div>
            
            {/* Footer */}
            <div className="text-center text-xs text-gray-400 mt-3 pt-3 border-t border-dashed border-gray-300">
              <p>ขอบคุณที่ใช้บริการ</p>
              <p className="font-semibold text-blue-800">FIN LOTTO R+ Premium</p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <DialogFooter className="flex gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={handleCopyTicket}
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <FileText className="size-4 mr-2" />
              คัดลอก
            </Button>
            <Button
              variant="outline"
              onClick={handleShareToLine}
              className="flex-1 border-emerald-600/50 text-emerald-400 hover:bg-emerald-950/50"
            >
              <MessageCircle className="size-4 mr-2" />
              Line
            </Button>
            <Button
              onClick={handlePrintReceipt}
              className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
            >
              <Printer className="size-4 mr-2" />
              พิมพ์
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Simple Paste Modal */}
      <Dialog open={showPasteModal} onOpenChange={setShowPasteModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-emerald-400 flex items-center gap-2">
              <ClipboardPaste className="size-5" />
              Paste โพย (แบบง่าย)
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              วางเลขทั้งหมด แล้วเลือกประเภทและราคากลาง
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Type Selection */}
            <div className="flex gap-2">
              <Button
                variant={pasteType === 'bon' ? 'default' : 'outline'}
                onClick={() => setPasteType('bon')}
                className={pasteType === 'bon' 
                  ? 'flex-1 bg-blue-600 hover:bg-blue-700' 
                  : 'flex-1 border-slate-700 text-slate-300 hover:bg-slate-800'}
              >
                บน
              </Button>
              <Button
                variant={pasteType === 'lang' ? 'default' : 'outline'}
                onClick={() => setPasteType('lang')}
                className={pasteType === 'lang' 
                  ? 'flex-1 bg-orange-600 hover:bg-orange-700' 
                  : 'flex-1 border-slate-700 text-slate-300 hover:bg-slate-800'}
              >
                ล่าง
              </Button>
              <Button
                variant={pasteType === 'tod' ? 'default' : 'outline'}
                onClick={() => setPasteType('tod')}
                className={pasteType === 'tod' 
                  ? 'flex-1 bg-purple-600 hover:bg-purple-700' 
                  : 'flex-1 border-slate-700 text-slate-300 hover:bg-slate-800'}
              >
                โต๊ด
              </Button>
              <Button
                variant={pasteType === 'reverse' ? 'default' : 'outline'}
                onClick={() => setPasteType('reverse')}
                className={pasteType === 'reverse' 
                  ? 'flex-1 bg-emerald-600 hover:bg-emerald-700' 
                  : 'flex-1 border-slate-700 text-slate-300 hover:bg-slate-800'}
              >
                กลับ
              </Button>
            </div>
            
            {pasteType === 'reverse' && (
              <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-800">
                <p className="text-xs text-emerald-400">
                  โหมดกลับ: เลข 12 จะเพิ่มเป็น 12บน, 12ล่าง, 21บน, 21ล่าง
                </p>
              </div>
            )}

            {/* Default Price */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400 w-24">ราคากลาง:</span>
              <Input
                type="number"
                value={pastePrice}
                onChange={(e) => setPastePrice(e.target.value)}
                className="flex-1 bg-slate-800/50 border-slate-700 text-white"
                placeholder="100"
              />
              <span className="text-sm text-slate-400">บาท</span>
            </div>

            {/* Paste Area */}
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`วางเลขที่นี่...\n\nตัวอย่าง:\n12\n23\n45=200\n67*150\n89, 90, 91`}
              className="h-48 bg-slate-800/50 border-slate-700 text-white font-mono placeholder:text-slate-500"
            />

            {/* Preview */}
            {pasteText && (
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm text-slate-400">Preview:</p>
                  <Badge className="bg-slate-600 text-white">
                    {parseLottoText(pasteText, pasteType, parseInt(pastePrice) || 100).length} รายการ
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {parseLottoText(pasteText, pasteType, parseInt(pastePrice) || 100)
                    .slice(0, 20)
                    .map((p, idx) => (
                      <Badge key={idx} className={cn(
                        "font-mono",
                        p.betType === 'top' && "bg-blue-700 text-white",
                        p.betType === 'bottom' && "bg-orange-700 text-white",
                        p.betType === 'tood' && "bg-purple-700 text-white"
                      )}>
                        {p.number}{p.betType === 'top' ? 'บ' : p.betType === 'bottom' ? 'ล' : 'ต'}={p.price}
                      </Badge>
                    ))}
                  {parseLottoText(pasteText, pasteType, parseInt(pastePrice) || 100).length > 20 && (
                    <Badge variant="outline" className="border-slate-600 text-slate-400">
                      +{parseLottoText(pasteText, pasteType, parseInt(pastePrice) || 100).length - 20} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowPasteModal(false); setPasteText(''); }}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handlePasteSubmit}
              disabled={!pasteText.trim()}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
            >
              <CheckCircle className="size-4 mr-2" />
              เพิ่มทั้งหมด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Win Digits Modal */}
      <Dialog open={showWinModal} onOpenChange={setShowWinModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-purple-400 flex items-center gap-2">
              <Shuffle className="size-5" />
              วินเลข (สร้างเลขอัตโนมัติ)
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              กรอกตัวเลขฐาน เช่น 1,2,3 ระบบจะสร้างเลขวินให้อัตโนมัติ
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Win Type Selection */}
            <div className="flex gap-2">
              <Button
                variant={winType === '2' ? 'default' : 'outline'}
                onClick={() => handleWinTypeChange('2')}
                className={winType === '2' 
                  ? 'flex-1 bg-purple-600 hover:bg-purple-700' 
                  : 'flex-1 border-slate-700 text-slate-300 hover:bg-slate-800'}
              >
                วิน 2 ตัว
              </Button>
              <Button
                variant={winType === '3' ? 'default' : 'outline'}
                onClick={() => handleWinTypeChange('3')}
                className={winType === '3' 
                  ? 'flex-1 bg-purple-600 hover:bg-purple-700' 
                  : 'flex-1 border-slate-700 text-slate-300 hover:bg-slate-800'}
              >
                วิน 3 ตัว
              </Button>
            </div>

            {/* Bet Type Selection - changes based on win type */}
            <div className="flex gap-2">
              {winType === '2' ? (
                <>
                  <Button
                    variant={winBetType === 'bon' ? 'default' : 'outline'}
                    onClick={() => setWinBetType('bon')}
                    size="sm"
                    className={winBetType === 'bon' 
                      ? 'flex-1 bg-blue-600 hover:bg-blue-700' 
                      : 'flex-1 border-slate-700 text-slate-300 hover:bg-slate-800'}
                  >
                    2 ตัวบน
                  </Button>
                  <Button
                    variant={winBetType === 'lang' ? 'default' : 'outline'}
                    onClick={() => setWinBetType('lang')}
                    size="sm"
                    className={winBetType === 'lang' 
                      ? 'flex-1 bg-orange-600 hover:bg-orange-700' 
                      : 'flex-1 border-slate-700 text-slate-300 hover:bg-slate-800'}
                  >
                    2 ตัวล่าง
                  </Button>
                  <Button
                    variant={winBetType === 'reverse' ? 'default' : 'outline'}
                    onClick={() => setWinBetType('reverse')}
                    size="sm"
                    className={winBetType === 'reverse' 
                      ? 'flex-1 bg-pink-600 hover:bg-pink-700' 
                      : 'flex-1 border-slate-700 text-slate-300 hover:bg-slate-800'}
                  >
                    2 ตัวกลับ
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant={winBetType === 'bon' ? 'default' : 'outline'}
                    onClick={() => setWinBetType('bon')}
                    size="sm"
                    className={winBetType === 'bon' 
                      ? 'flex-1 bg-blue-600 hover:bg-blue-700' 
                      : 'flex-1 border-slate-700 text-slate-300 hover:bg-slate-800'}
                  >
                    3 ตัวบน
                  </Button>
                  <Button
                    variant={winBetType === 'tod' ? 'default' : 'outline'}
                    onClick={() => setWinBetType('tod')}
                    size="sm"
                    className={winBetType === 'tod' 
                      ? 'flex-1 bg-green-600 hover:bg-green-700' 
                      : 'flex-1 border-slate-700 text-slate-300 hover:bg-slate-800'}
                  >
                    3 ตัวโต๊ด
                  </Button>
                  <Button
                    variant={winBetType === 'reverse' ? 'default' : 'outline'}
                    onClick={() => setWinBetType('reverse')}
                    size="sm"
                    className={winBetType === 'reverse' 
                      ? 'flex-1 bg-pink-600 hover:bg-pink-700' 
                      : 'flex-1 border-slate-700 text-slate-300 hover:bg-slate-800'}
                  >
                    3 ตัวกลับ
                  </Button>
                </>
              )}
            </div>

            {/* Digit Buttons 0-9 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-400">เลือกตัวเลข (กดเพื่อเลือก/ยกเลิก)</label>
                {selectedWinDigits.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSelectedWinDigits(new Set()); setWinResults([]); }}
                    className="text-xs text-slate-500 hover:text-white h-6 px-2"
                  >
                    ล้างทั้งหมด
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((digit) => (
                  <Button
                    key={digit}
                    variant={selectedWinDigits.has(digit) ? 'default' : 'outline'}
                    onClick={() => toggleWinDigit(digit)}
                    className={cn(
                      "h-14 text-2xl font-bold transition-all",
                      selectedWinDigits.has(digit)
                        ? "bg-purple-600 hover:bg-purple-700 text-white ring-2 ring-purple-400 ring-offset-2 ring-offset-slate-900"
                        : "border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    {digit}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-slate-500 text-center">
                เลือกแล้ว: {selectedWinDigits.size > 0 ? Array.from(selectedWinDigits).sort().join(', ') : '-'}
              </p>
            </div>

            {/* Price */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400 w-20">ราคา:</span>
              <Input
                type="number"
                value={winPrice}
                onChange={(e) => setWinPrice(e.target.value)}
                className="flex-1 bg-slate-800/50 border-slate-700 text-white"
                placeholder="100"
              />
              <span className="text-sm text-slate-400">บาท/เลข</span>
            </div>

            {/* Preview */}
            {winResults.length > 0 && (
              <div className="p-3 rounded-lg bg-purple-950/30 border border-purple-800">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm text-purple-400">เลขวินที่สร้าง ({winResults.length} เลข)</p>
                  <Badge className="bg-purple-600 text-white">
                    รวม {(winResults.length * (parseInt(winPrice) || 100)).toLocaleString()} บาท
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {winResults.slice(0, 30).map((num, idx) => (
                    <Badge key={idx} className="bg-slate-800 text-white font-mono">
                      {num}
                    </Badge>
                  ))}
                  {winResults.length > 30 && (
                    <Badge variant="outline" className="border-slate-600 text-slate-400">
                      +{winResults.length - 30} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowWinModal(false); setSelectedWinDigits(new Set()); setWinResults([]); }}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleWinSubmit}
              disabled={winResults.length === 0}
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
            >
              <CheckCircle className="size-4 mr-2" />
              เพิ่ม {winResults.length} เลข
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shortcuts Dialog */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-amber-400 flex items-center gap-2">
              <Keyboard className="size-5" />
              Shorthand Syntax
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p className="font-semibold text-amber-400">Format</p>
                <code className="block p-2 bg-slate-800 rounded font-mono">123x100x50</code>
                <code className="block p-2 bg-slate-800 rounded font-mono">12x100x50</code>
                <code className="block p-2 bg-slate-800 rounded font-mono">12x100r</code>
                <code className="block p-2 bg-slate-800 rounded font-mono">5r19</code>
                <code className="block p-2 bg-slate-800 rounded font-mono">12,13,14x100</code>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-slate-400">Result</p>
                <p className="p-2 text-slate-300">3top 100, tod 50</p>
                <p className="p-2 text-slate-300">2top 100, 2bot 50</p>
                <p className="p-2 text-slate-300">12, 21 each 100</p>
                <p className="p-2 text-slate-300">19 door pattern</p>
                <p className="p-2 text-slate-300">Multiple numbers</p>
              </div>
            </div>
            <Separator className="bg-slate-700" />
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-amber-400">Keyboard</p>
              <div className="flex justify-between">
                <kbd className="px-2 py-1 bg-slate-800 rounded text-xs">Enter</kbd>
                <span className="text-slate-400">Add to ticket</span>
              </div>
              <div className="flex justify-between">
                <kbd className="px-2 py-1 bg-slate-800 rounded text-xs">Escape</kbd>
                <span className="text-slate-400">Clear input</span>
              </div>
              <div className="flex justify-between">
                <kbd className="px-2 py-1 bg-slate-800 rounded text-xs">F1</kbd>
                <span className="text-slate-400">Show help</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
