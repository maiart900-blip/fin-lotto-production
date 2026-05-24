'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Keyboard, 
  Send, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  ChevronLeft,
  Plus,
  Calculator,
  History,
  RotateCcw,
  Printer,
  AlertCircle,
  XCircle,
  FileText,
  Download
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface BetEntry {
  id: string;
  number: string;
  betType: string;
  amountTop: number;      // ราคาบน/3ตัว
  amountBottom: number;   // ราคาสองตัว/ล่าง
  commission: number;
  net: number;
  gross: number;
  status: 'pending' | 'confirmed' | 'error' | 'limit_warning';
  limitWarning?: string;
}

const BET_TYPES = [
  { key: '3บ', label: '3 ตัวบน', payRate: 800, digits: 3 },
  { key: '3ล', label: '3 ตัวล่าง', payRate: 150, digits: 3 },
  { key: '3ท', label: '3 ตัวโต๊ด', payRate: 120, digits: 3 },
  { key: '2บ', label: '2 ตัวบน', payRate: 90, digits: 2 },
  { key: '2ล', label: '2 ตัวล่าง', payRate: 90, digits: 2 },
  { key: 'บล', label: 'บน+ล่าง', payRate: 90, digits: 2 },
  { key: '1บ', label: 'วิ่งบน', payRate: 3, digits: 1 },
  { key: '1ล', label: 'วิ่งล่าง', payRate: 4, digits: 1 },
];

const COMMISSION_RATE = 20; // 20%

// เลขอั้น (Limited Numbers) - Mock data
const LIMITED_NUMBERS = ['123', '456', '789', '000', '111', '222', '333', '69', '96'];
const FULL_LIMIT_NUMBERS = ['888', '999', '777'];

// 19 ประตู
const NINETEEN_GATES = [
  '00', '11', '22', '33', '44', '55', '66', '77', '88', '99',
  '01', '12', '23', '34', '45', '56', '67', '78', '89'
];

// เลขเบิ้ล 2 ตัว
const DOUBLE_NUMBERS = ['00', '11', '22', '33', '44', '55', '66', '77', '88', '99'];

// เลขตอง 3 ตัว
const TRIPLE_NUMBERS = ['000', '111', '222', '333', '444', '555', '666', '777', '888', '999'];

export default function HighSpeedBettingPage() {
  const [input, setInput] = useState('');
  const [betEntries, setBetEntries] = useState<BetEntry[]>([]);
  const [selectedLottery, setSelectedLottery] = useState('หวยรัฐบาล');
  const [selectedBetType, setSelectedBetType] = useState('2บ');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLimitWarning, setShowLimitWarning] = useState(false);
  const [limitWarningData, setLimitWarningData] = useState<{number: string, reason: string} | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printData, setPrintData] = useState<BetEntry[] | null>(null);
  const [showPairDialog, setShowPairDialog] = useState(false);
  const [showSetDialog, setShowSetDialog] = useState(false);
  const [pairInput, setPairInput] = useState('');
  const [setAmount, setSetAmount] = useState('100');
  const inputRef = useRef<HTMLInputElement>(null);

  // Quick action functions
  const add19Gates = () => {
    const amount = parseInt(setAmount) || 100;
    NINETEEN_GATES.forEach(num => {
      addBetEntryDirect(num, amount, 0);
    });
  };

  const addRudFront = (prefix: string) => {
    if (!prefix || prefix.length !== 1) {
      alert('กรุณาใส่เลขหน้า 1 ตัว เช่น 1 แล้วกดรูดหน้า');
      return;
    }
    const amount = parseInt(setAmount) || 100;
    for (let i = 0; i <= 9; i++) {
      addBetEntryDirect(`${prefix}${i}`, amount, 0);
    }
  };

  const addRudBack = (suffix: string) => {
    if (!suffix || suffix.length !== 1) {
      alert('กรุณาใส่เลขหลัง 1 ตัว เช่น 5 แล้วกดรูดหลัง');
      return;
    }
    const amount = parseInt(setAmount) || 100;
    for (let i = 0; i <= 9; i++) {
      addBetEntryDirect(`${i}${suffix}`, amount, 0);
    }
  };

  const addDoubleNumbers = () => {
    const amount = parseInt(setAmount) || 100;
    DOUBLE_NUMBERS.forEach(num => {
      addBetEntryDirect(num, amount, 0);
    });
  };

  const addTripleNumbers = () => {
    const amount = parseInt(setAmount) || 100;
    TRIPLE_NUMBERS.forEach(num => {
      addBetEntryDirect(num, amount, 0);
    });
  };

  const reverseCurrentInput = () => {
    const num = input.match(/^\d+/)?.[0];
    if (num && num.length >= 2) {
      const reversed = num.split('').reverse().join('');
      setInput(input.replace(num, `${num},${reversed}`));
    }
  };

  const addBetEntryDirect = (number: string, amountTop: number, amountBottom: number) => {
    const limitCheck = checkNumberLimit(number);
    const gross = amountTop + amountBottom;
    const commission = gross * (COMMISSION_RATE / 100);
    const net = gross - commission;
    
    const newEntry: BetEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      number,
      betType: selectedBetType,
      amountTop,
      amountBottom,
      commission,
      net,
      gross,
      status: limitCheck.full ? 'error' : limitCheck.limited ? 'limit_warning' : 'pending',
      limitWarning: limitCheck.message,
    };
    
    setBetEntries(prev => [...prev, newEntry]);
  };

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Check if number is limited
  const checkNumberLimit = (num: string): { limited: boolean; full: boolean; message?: string } => {
    if (FULL_LIMIT_NUMBERS.includes(num)) {
      return { limited: true, full: true, message: `เลข ${num} เต็มเพดานแล้ว` };
    }
    if (LIMITED_NUMBERS.includes(num)) {
      return { limited: true, full: false, message: `เลข ${num} เป็นเลขอั้น รับได้จำกัด` };
    }
    return { limited: false, full: false };
  };

  // Parse advanced input format:
  // "123*100" = เลข 123 ราคา 100
  // "12*100*50" = เลข 12 ราคาบน 100 ราคาล่าง 50
  // "12,34,56*100" = เลข 12, 34, 56 ราคา 100 ต่อตัว
  // "12,34*100*50" = เลข 12, 34 ราคาบน 100 ราคาล่าง 50
  const parseAdvancedInput = useCallback((value: string): { 
    numbers: string[], 
    amountTop: number, 
    amountBottom: number,
    isSplit: boolean 
  } | null => {
    const trimmed = value.trim();
    
    // Format: 123*100*50 (number * amountTop * amountBottom)
    const splitMatch = trimmed.match(/^([\d,\s]+)\*(\d+)\*(\d+)$/);
    if (splitMatch) {
      const numbers = splitMatch[1].split(/[\s,]+/).filter(n => /^\d+$/.test(n));
      const amountTop = parseInt(splitMatch[2]) || 0;
      const amountBottom = parseInt(splitMatch[3]) || 0;
      if (numbers.length > 0 && (amountTop > 0 || amountBottom > 0)) {
        return { numbers, amountTop, amountBottom, isSplit: true };
      }
    }
    
    // Format: 123*100 (number * amount)
    const simpleMatch = trimmed.match(/^([\d,\s]+)\*(\d+)$/);
    if (simpleMatch) {
      const numbers = simpleMatch[1].split(/[\s,]+/).filter(n => /^\d+$/.test(n));
      const amount = parseInt(simpleMatch[2]) || 0;
      if (numbers.length > 0 && amount > 0) {
        return { numbers, amountTop: amount, amountBottom: 0, isSplit: false };
      }
    }
    
    // Format: 123 100 (number space amount)
    const parts = trimmed.split(/\s+/);
    if (parts.length === 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
      return { numbers: [parts[0]], amountTop: parseInt(parts[1]), amountBottom: 0, isSplit: false };
    }
    
    return null;
  }, []);

  // Handle keyboard input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      addBetEntry();
    } else if (e.key === 'Escape') {
      setInput('');
      inputRef.current?.focus();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const currentIndex = BET_TYPES.findIndex(t => t.key === selectedBetType);
      const nextIndex = (currentIndex + 1) % BET_TYPES.length;
      setSelectedBetType(BET_TYPES[nextIndex].key);
    } else if (e.ctrlKey && e.key === 'p') {
      e.preventDefault();
      if (betEntries.length > 0) {
        handlePrintSlip();
      }
    }
  };

  const addBetEntry = () => {
    const parsed = parseAdvancedInput(input);
    if (!parsed) return;

    const newEntries: BetEntry[] = [];
    
    for (const num of parsed.numbers) {
      const limitCheck = checkNumberLimit(num);
      
      // Calculate totals
      let totalAmount = parsed.amountTop;
      let betType = selectedBetType;
      
      // If split pricing (บน+ล่าง)
      if (parsed.isSplit && parsed.amountBottom > 0) {
        totalAmount = parsed.amountTop + parsed.amountBottom;
        betType = 'บล'; // บน+ล่าง
      }
      
      const commission = Math.round(totalAmount * (COMMISSION_RATE / 100));
      const net = totalAmount - commission;
      
      const entry: BetEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        number: num,
        betType,
        amountTop: parsed.amountTop,
        amountBottom: parsed.amountBottom,
        commission,
        net,
        gross: totalAmount,
        status: limitCheck.full ? 'error' : limitCheck.limited ? 'limit_warning' : 'pending',
        limitWarning: limitCheck.message,
      };
      
      // Show warning for limited numbers
      if (limitCheck.limited && !limitCheck.full) {
        setLimitWarningData({ number: num, reason: limitCheck.message || '' });
        setShowLimitWarning(true);
      }
      
      // Don't add if full limit
      if (!limitCheck.full) {
        newEntries.push(entry);
      } else {
        // Show error dialog for full limit
        setLimitWarningData({ number: num, reason: limitCheck.message || '' });
        setShowLimitWarning(true);
      }
    }

    if (newEntries.length > 0) {
      setBetEntries(prev => [...prev, ...newEntries]);
    }
    
    setInput('');
    inputRef.current?.focus();
  };

  const removeBetEntry = (id: string) => {
    setBetEntries(prev => prev.filter(entry => entry.id !== id));
  };

  const clearAllEntries = () => {
    setBetEntries([]);
    setInput('');
    inputRef.current?.focus();
  };

  // กลับเลขทั้งหมด (Reverse all numbers)
  const reverseAllNumbers = () => {
    setBetEntries(prev => {
      const newEntries: BetEntry[] = [];
      prev.forEach(entry => {
        // Add original
        newEntries.push(entry);
        
        // Add reversed (only for 2+ digits)
        if (entry.number.length >= 2) {
          const reversed = entry.number.split('').reverse().join('');
          if (reversed !== entry.number && !prev.some(e => e.number === reversed)) {
            const limitCheck = checkNumberLimit(reversed);
            newEntries.push({
              ...entry,
              id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              number: reversed,
              status: limitCheck.full ? 'error' : limitCheck.limited ? 'limit_warning' : 'pending',
              limitWarning: limitCheck.message,
            });
          }
        }
      });
      return newEntries;
    });
  };

  const submitAllBets = async () => {
    if (betEntries.length === 0) return;
    
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mark all as confirmed
    const confirmedEntries = betEntries.map(entry => ({ 
      ...entry, 
      status: (entry.status === 'error' ? 'error' : 'confirmed') as 'error' | 'pending' | 'confirmed' | 'limit_warning'
    }));
    setBetEntries(confirmedEntries as BetEntry[]);
    
    // Store for printing
    setPrintData(confirmedEntries.filter(e => e.status === 'confirmed') as BetEntry[]);
    setShowPrintDialog(true);
    
    setIsSubmitting(false);
  };

  // Print slip
  const handlePrintSlip = () => {
    const entriesToPrint = printData || betEntries.filter(e => e.status !== 'error');
    
    // Create print content
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const totalGross = entriesToPrint.reduce((sum, e) => sum + e.gross, 0);
    const totalCommission = entriesToPrint.reduce((sum, e) => sum + e.commission, 0);
    const totalNet = entriesToPrint.reduce((sum, e) => sum + e.net, 0);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>ใบเสร็จ - ${selectedLottery}</title>
        <style>
          body { font-family: 'Sarabun', sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px; }
          .logo { font-size: 24px; font-weight: bold; color: #B8860B; }
          .date { font-size: 12px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #f5f5f5; }
          .number { font-size: 18px; font-weight: bold; color: #B8860B; }
          .total-row { font-weight: bold; background: #FFF8DC; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; border-top: 2px dashed #000; padding-top: 10px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">FIN LOTTO R+</div>
          <div>${selectedLottery}</div>
          <div class="date">${dateStr}</div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>เลข</th>
              <th>ประเภท</th>
              <th>ราคา</th>
              <th>สุทธิ</th>
            </tr>
          </thead>
          <tbody>
            ${entriesToPrint.map((entry, i) => `
              <tr>
                <td>${i + 1}</td>
                <td class="number">${entry.number}</td>
                <td>${BET_TYPES.find(t => t.key === entry.betType)?.label || entry.betType}</td>
                <td>${entry.gross.toLocaleString()}</td>
                <td>${entry.net.toLocaleString()}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3">รวมทั้งสิ้น (${entriesToPrint.length} รายการ)</td>
              <td>${totalGross.toLocaleString()}</td>
              <td>${totalNet.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        
        <div>
          <div>ยอดรวม: ${totalGross.toLocaleString()} บาท</div>
          <div>หักค่าคอม ${COMMISSION_RATE}%: -${totalCommission.toLocaleString()} บาท</div>
          <div style="font-size: 18px; font-weight: bold; color: #B8860B;">
            ยอดสุทธิ: ${totalNet.toLocaleString()} บาท
          </div>
        </div>
        
        <div class="footer">
          <div>ขอบคุณที่ใช้บริการ</div>
          <div>FIN LOTTO R+ Premium System</div>
        </div>
        
        <script>window.print(); window.close();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Calculate totals
  const totals = betEntries.reduce((acc, entry) => ({
    gross: acc.gross + entry.gross,
    commission: acc.commission + entry.commission,
    net: acc.net + entry.net,
    count: acc.count + 1,
    pendingCount: acc.pendingCount + (entry.status === 'pending' || entry.status === 'limit_warning' ? 1 : 0),
  }), { gross: 0, commission: 0, net: 0, count: 0, pendingCount: 0 });

  const getBetTypeLabel = (key: string) => {
    return BET_TYPES.find(t => t.key === key)?.label || key;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <Link href="/agent-terminal">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
            <ChevronLeft className="size-4 mr-1" />
            กลับ
          </Button>
        </Link>
        <div className="flex-1">
          <h1 
            className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
            style={{ textShadow: '0 0 20px rgba(255,215,0,0.3)' }}
          >
            High-Speed Betting Terminal PRO
          </h1>
          <p className="text-slate-500 text-xs">Tab=เปลี่ยนประเภท | Enter=เพิ่ม | Esc=ล้าง | Ctrl+P=พิมพ์</p>
        </div>
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
          <Clock className="size-3 mr-1" />
          {selectedLottery}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Input Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Main Input */}
          <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30">
            <CardContent className="p-4">
              {/* Bet Type Selector */}
              <div className="flex flex-wrap gap-2 mb-4">
                {BET_TYPES.map(type => (
                  <button
                    key={type.key}
                    onClick={() => setSelectedBetType(type.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                      "border",
                      selectedBetType === type.key
                        ? "bg-gradient-to-b from-amber-500 to-amber-600 border-amber-400 text-white shadow-lg shadow-amber-500/30"
                        : "bg-black/30 border-slate-700 text-slate-400 hover:border-amber-500/50"
                    )}
                  >
                    {type.key}
                  </button>
                ))}
              </div>

              {/* Quick Input */}
              <div className="relative">
                <Keyboard className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-amber-500/50" />
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="เลข*ราคา หรือ เลข*ราคาบน*ราคาล่าง เช่น 12*100*50"
                  className={cn(
                    "w-full pl-12 pr-24 py-4 rounded-xl text-xl font-mono",
                    "bg-black/50 border-2 border-amber-500/30",
                    "text-white placeholder:text-slate-600",
                    "focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 focus:outline-none",
                    "transition-all"
                  )}
                  autoComplete="off"
                />
                <Button
                  onClick={addBetEntry}
                  disabled={!input.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 border-0"
                >
                  <Plus className="size-4 mr-1" />
                  เพิ่ม
                </Button>
              </div>

              {/* Input Format Help */}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 font-mono">12*100</kbd>
                  <span>= เลข 12 ราคา 100</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 font-mono">12*100*50</kbd>
                  <span>= บน 100 + ล่าง 50</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 font-mono">12,34,56*100</kbd>
                  <span>= 3 ตัว ราคา 100 ต่อตัว</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 font-mono">12,34*50*25</kbd>
                  <span>= 2 ตัว บน 50 ล่าง 25</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Number Shortcuts */}
          <Card className="bg-black/40 backdrop-blur-xl border-amber-500/20">
            <CardContent className="p-3">
              <div className="text-xs text-amber-400 mb-2 font-medium">ทางลัดเลขด่วน</div>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {/* 19 ประตู */}
                <Button
                  onClick={() => add19Gates()}
                  size="sm"
                  variant="outline"
                  className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10 text-xs"
                >
                  19 ประตู
                </Button>
                {/* รูดหน้า */}
                <Button
                  onClick={() => addRudFront(input.match(/^\d+/)?.[0] || '')}
                  size="sm"
                  variant="outline"
                  className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 text-xs"
                >
                  รูดหน้า
                </Button>
                {/* รูดหลัง */}
                <Button
                  onClick={() => addRudBack(input.match(/^\d+/)?.[0] || '')}
                  size="sm"
                  variant="outline"
                  className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 text-xs"
                >
                  รูดหลัง
                </Button>
                {/* เลขคู่ 2 ตัว */}
                <Button
                  onClick={() => addDoubleNumbers()}
                  size="sm"
                  variant="outline"
                  className="border-pink-500/50 text-pink-400 hover:bg-pink-500/10 text-xs"
                >
                  เลขเบิ้ล
                </Button>
                {/* เลขตอง */}
                <Button
                  onClick={() => addTripleNumbers()}
                  size="sm"
                  variant="outline"
                  className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10 text-xs"
                >
                  เลขตอง
                </Button>
                {/* จับคู่ */}
                <Button
                  onClick={() => setShowPairDialog(true)}
                  size="sm"
                  variant="outline"
                  className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 text-xs"
                >
                  จับคู่
                </Button>
                {/* กลับเลข */}
                <Button
                  onClick={() => reverseCurrentInput()}
                  size="sm"
                  variant="outline"
                  className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10 text-xs"
                >
                  กลับเลข
                </Button>
                {/* เลขชุด */}
                <Button
                  onClick={() => setShowSetDialog(true)}
                  size="sm"
                  variant="outline"
                  className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10 text-xs"
                >
                  เลขชุด
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={reverseAllNumbers}
              disabled={betEntries.length === 0}
              variant="outline"
              className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
            >
              <RotateCcw className="size-4 mr-2" />
              กลับเลขทั้งหมด
            </Button>
            <Button
              onClick={clearAllEntries}
              disabled={betEntries.length === 0}
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="size-4 mr-2" />
              ล้างรายการทั้งหมด
            </Button>
            <Button
              onClick={handlePrintSlip}
              disabled={betEntries.length === 0}
              variant="outline"
              className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 ml-auto"
            >
              <Printer className="size-4 mr-2" />
              พิมพ์โพย
            </Button>
          </div>

          {/* Bet Entries Table */}
          <Card className="bg-black/40 backdrop-blur-xl border-slate-700/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                  <History className="size-4" />
                  รายการ ({betEntries.length} รายการ | รอส่ง {totals.pendingCount})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {betEntries.length === 0 ? (
                <div className="py-8 text-center text-slate-600">
                  <Keyboard className="size-12 mx-auto mb-3 opacity-30" />
                  <p>ยังไม่มีรายการ</p>
                  <p className="text-xs mt-1">พิมพ์เลขและกด Enter เพื่อเพิ่ม</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="py-2 px-2 text-left text-slate-500">#</th>
                        <th className="py-2 px-2 text-left text-slate-500">เลข</th>
                        <th className="py-2 px-2 text-left text-slate-500">ประเภท</th>
                        <th className="py-2 px-2 text-right text-slate-500">บน</th>
                        <th className="py-2 px-2 text-right text-slate-500">ล่าง</th>
                        <th className="py-2 px-2 text-right text-slate-500">รวม</th>
                        <th className="py-2 px-2 text-right text-slate-500">คอม</th>
                        <th className="py-2 px-2 text-right text-slate-500">สุทธิ</th>
                        <th className="py-2 px-2 text-center text-slate-500">สถานะ</th>
                        <th className="py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {betEntries.map((entry, index) => (
                        <tr
                          key={entry.id}
                          className={cn(
                            "transition-colors",
                            entry.status === 'confirmed' && "bg-emerald-500/5",
                            entry.status === 'error' && "bg-red-500/10",
                            entry.status === 'limit_warning' && "bg-orange-500/10"
                          )}
                        >
                          <td className="py-2 px-2 text-slate-600">{index + 1}</td>
                          <td className="py-2 px-2">
                            <span 
                              className={cn(
                                "text-xl font-mono font-bold",
                                entry.status === 'error' ? "text-red-400" :
                                entry.status === 'limit_warning' ? "text-orange-400" :
                                "text-amber-400"
                              )}
                              style={{ textShadow: '0 0 10px rgba(255,215,0,0.3)' }}
                            >
                              {entry.number}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            <Badge className="bg-slate-800 border-slate-700 text-slate-300 text-xs">
                              {getBetTypeLabel(entry.betType)}
                            </Badge>
                          </td>
                          <td className="py-2 px-2 text-right text-white">
                            {entry.amountTop > 0 ? entry.amountTop.toLocaleString() : '-'}
                          </td>
                          <td className="py-2 px-2 text-right text-white">
                            {entry.amountBottom > 0 ? entry.amountBottom.toLocaleString() : '-'}
                          </td>
                          <td className="py-2 px-2 text-right text-white font-medium">
                            {entry.gross.toLocaleString()}
                          </td>
                          <td className="py-2 px-2 text-right text-emerald-400">
                            -{entry.commission.toLocaleString()}
                          </td>
                          <td className="py-2 px-2 text-right text-amber-400 font-bold">
                            {entry.net.toLocaleString()}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {entry.status === 'confirmed' ? (
                              <CheckCircle2 className="size-4 text-emerald-400 mx-auto" />
                            ) : entry.status === 'error' ? (
                              <XCircle className="size-4 text-red-400 mx-auto" />
                            ) : entry.status === 'limit_warning' ? (
                              <AlertTriangle className="size-4 text-orange-400 mx-auto animate-pulse" />
                            ) : (
                              <Clock className="size-4 text-slate-500 mx-auto" />
                            )}
                          </td>
                          <td className="py-2 px-2">
                            {entry.status !== 'confirmed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeBetEntry(entry.id)}
                                className="text-slate-500 hover:text-red-400 p-1"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Totals Footer */}
                    <tfoot className="border-t-2 border-amber-500/30">
                      <tr className="bg-amber-500/5">
                        <td colSpan={5} className="py-3 px-2 text-right font-medium text-slate-400">
                          รวมทั้งสิ้น ({totals.count} รายการ)
                        </td>
                        <td className="py-3 px-2 text-right text-white font-bold">
                          {totals.gross.toLocaleString()}
                        </td>
                        <td className="py-3 px-2 text-right text-emerald-400 font-bold">
                          -{totals.commission.toLocaleString()}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span 
                            className="text-xl font-bold text-amber-400"
                            style={{ textShadow: '0 0 15px rgba(255,215,0,0.4)' }}
                          >
                            {totals.net.toLocaleString()}
                          </span>
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Summary Panel */}
        <div className="space-y-4">
          {/* Totals Card */}
          <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
                <Calculator className="size-4" />
                สรุปยอด
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-slate-400">จำนวนรายการ</span>
                  <span className="text-white font-medium">{totals.count} รายการ</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-slate-400">ยอดแทงรวม (Gross)</span>
                  <span className="text-white font-medium">{totals.gross.toLocaleString()} บ.</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-slate-400">หักค่าคอม ({COMMISSION_RATE}%)</span>
                  <span className="text-emerald-400 font-medium">-{totals.commission.toLocaleString()} บ.</span>
                </div>
                <div className="flex justify-between items-center py-3 bg-gradient-to-r from-amber-500/10 to-transparent rounded-lg px-3 -mx-3">
                  <span className="text-amber-400 font-medium">ยอดสุทธิ (Net)</span>
                  <span 
                    className="text-2xl font-bold text-amber-400"
                    style={{ textShadow: '0 0 10px rgba(255,215,0,0.4)' }}
                  >
                    {totals.net.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                onClick={submitAllBets}
                disabled={totals.pendingCount === 0 || isSubmitting}
                className={cn(
                  "w-full py-6 text-lg font-bold",
                  "bg-gradient-to-b from-amber-500 to-amber-600",
                  "hover:from-amber-400 hover:to-amber-500",
                  "shadow-lg shadow-amber-500/30",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isSubmitting ? (
                  <>
                    <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    กำลังส่ง...
                  </>
                ) : (
                  <>
                    <Send className="size-5 mr-2" />
                    บันทึกและส่งทั้งหมด
                  </>
                )}
              </Button>
              
              {/* Print Button */}
              <Button
                onClick={handlePrintSlip}
                disabled={betEntries.length === 0}
                variant="outline"
                className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              >
                <FileText className="size-4 mr-2" />
                บันทึกและพิมพ์โพย
              </Button>
            </CardContent>
          </Card>

          {/* Credit Status */}
          <Card className="bg-black/40 backdrop-blur-xl border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">เครดิตคงเหลือ</span>
                <span className="text-lg font-bold text-emerald-400">65,000</span>
              </div>
              <div className="h-2 bg-black/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, ((65000 - totals.net) / 100000) * 100))}%` }}
                />
              </div>
              <p className="text-xs text-slate-600 mt-2">
                หลังส่ง: {Math.max(0, 65000 - totals.net).toLocaleString()} บาท
              </p>
            </CardContent>
          </Card>

          {/* Keyboard Shortcuts */}
          <Card className="bg-black/40 backdrop-blur-xl border-slate-700/50">
            <CardContent className="p-4">
              <h4 className="text-xs font-medium text-slate-500 mb-3">คีย์ลัด</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <kbd className="px-2 py-1 rounded bg-slate-800 text-slate-400 font-mono">Enter</kbd>
                  <span className="text-slate-500">เพิ่มรายการ</span>
                </div>
                <div className="flex justify-between">
                  <kbd className="px-2 py-1 rounded bg-slate-800 text-slate-400 font-mono">Tab</kbd>
                  <span className="text-slate-500">เปลี่ยนประเภท</span>
                </div>
                <div className="flex justify-between">
                  <kbd className="px-2 py-1 rounded bg-slate-800 text-slate-400 font-mono">Esc</kbd>
                  <span className="text-slate-500">ล้างช่องกรอก</span>
                </div>
                <div className="flex justify-between">
                  <kbd className="px-2 py-1 rounded bg-slate-800 text-slate-400 font-mono">Ctrl+P</kbd>
                  <span className="text-slate-500">พิมพ์โพย</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Limit Warning Dialog */}
      <Dialog open={showLimitWarning} onOpenChange={setShowLimitWarning}>
        <DialogContent className="bg-[#0a0f1a] border-orange-500/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-400">
              <AlertCircle className="size-5" />
              เตือน: เลขอั้น / เต็มเพดาน
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-300">{limitWarningData?.reason}</p>
            {limitWarningData?.reason?.includes('เต็มเพดาน') && (
              <p className="text-red-400 mt-2 text-sm">ไม่สามารถรับแทงเลขนี้ได้อีก</p>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowLimitWarning(false)}
              className="bg-gradient-to-b from-amber-500 to-amber-600"
            >
              รับทราบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Success Dialog */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="bg-[#0a0f1a] border-emerald-500/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="size-5" />
              บันทึกสำเร็จ
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-slate-300">
              บันทึก {printData?.length || 0} รายการ ยอดสุทธิ {printData?.reduce((s, e) => s + e.net, 0).toLocaleString()} บาท
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handlePrintSlip}
                className="flex-1 bg-gradient-to-b from-amber-500 to-amber-600"
              >
                <Printer className="size-4 mr-2" />
                พิมพ์ใบเสร็จ
              </Button>
              <Button
                onClick={() => {
                  setShowPrintDialog(false);
                  setBetEntries([]);
                  setPrintData(null);
                }}
                variant="outline"
                className="flex-1 border-slate-700"
              >
                ปิด
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
