'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ArrowLeft, 
  Trash2, 
  Send, 
  Plus, 
  Clock, 
  Wallet,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  Lock,
  Edit3,
  ShoppingCart,
  Sparkles,
  Home,
  Bell,
  User,
  Search,
  CheckSquare,
  Grid3X3,
  Zap,
  Tv,
} from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { toast } from 'sonner';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('Fetch error');
    throw error;
  }
  return res.json();
};

// Types
interface BetItem {
  id: string;
  number: string;
  bet_type: string;
  amount_top: number;
  amount_bottom: number;
  amount_tod: number;
  is_reverse: boolean;
  original_number?: string;
  source_type?: 'manual' | 'win_number' | '6back' | '19gate';
  source_input?: string; // เก็บเลขที่กรอกต้นฉบับ
}

type BetType = 
  | '3top' | '3tod' | '3top_tod' | '3front' | '3back'
  | '2top' | '2bot' 
  | 'run_top' | 'run_bot'
  | '6back' | '19gate' | 'win_number'
  | 'triple' | 'double_front' | 'double_back';

// Bet Type Config
const BET_TYPES: Record<BetType, { 
  label: string; 
  digits: number; 
  desc?: string; 
  color: string;
  payRate: number;
  category: 'three' | 'two' | 'run' | 'special';
}> = {
  '3top': { label: '3 ตัวบน', digits: 3, desc: 'ตรงตำแหน่ง', color: 'from-blue-500 to-blue-600', payRate: 900, category: 'three' },
  '3tod': { label: '3 ตัวโต๊ด', digits: 3, desc: 'ไม่เรียงลำดับ', color: 'from-blue-400 to-blue-500', payRate: 150, category: 'three' },
  '3top_tod': { label: '3 ตัวบน+โต๊ด', digits: 3, desc: 'บน+โต๊ด', color: 'from-blue-500 to-indigo-600', payRate: 900, category: 'three' },
  '3front': { label: '3 ตัวหน้า', digits: 3, desc: 'ตรง 3 ตัวหน้า', color: 'from-indigo-500 to-indigo-600', payRate: 450, category: 'three' },
  '3back': { label: '3 ตัวหลัง', digits: 3, desc: 'ตรง 3 ตัวหลัง', color: 'from-indigo-400 to-indigo-500', payRate: 450, category: 'three' },
  '2top': { label: '2 ตัวบน', digits: 2, desc: 'ตรงตำแหน่ง', color: 'from-emerald-500 to-emerald-600', payRate: 95, category: 'two' },
  '2bot': { label: '2 ตัวล่าง', digits: 2, desc: 'ตรงตำแหน่ง', color: 'from-emerald-400 to-emerald-500', payRate: 95, category: 'two' },
  'run_top': { label: 'วิ่งบน', digits: 1, desc: 'เลขเดียว', color: 'from-amber-500 to-amber-600', payRate: 3.2, category: 'run' },
  'run_bot': { label: 'วิ่งล่าง', digits: 1, desc: 'เลขเดียว', color: 'from-amber-400 to-amber-500', payRate: 4.2, category: 'run' },
  '6back': { label: '6 กลับ', digits: 3, desc: 'กลับ 6 แบบ', color: 'from-rose-500 to-rose-600', payRate: 900, category: 'special' },
  '19gate': { label: '19 ประตู', digits: 1, desc: '19 เลข', color: 'from-orange-500 to-orange-600', payRate: 95, category: 'special' },
  'win_number': { label: 'เลขวิน', digits: 2, desc: 'จับคู่ทุกตัว', color: 'from-fuchsia-500 to-fuchsia-600', payRate: 95, category: 'special' },
  'triple': { label: 'เลขตอง', digits: 1, desc: 'เลข 3 ซ้ำ', color: 'from-pink-500 to-pink-600', payRate: 900, category: 'special' },
  'double_front': { label: 'เบิ้ลหน้า', digits: 2, desc: 'ซ้ำหน้า AAB', color: 'from-violet-500 to-violet-600', payRate: 900, category: 'special' },
  'double_back': { label: 'เบิ้ลหลัง', digits: 2, desc: 'ซ้ำหลัง ABB', color: 'from-purple-500 to-purple-600', payRate: 900, category: 'special' },
};

// Quick amounts - เริ่มจาก 1, 5 และบวกเพิ่มเมื่อกดซ้ำ
const QUICK_AMOUNTS = [1, 5, 10, 20, 50, 100];

// Generate special numbers
const TRIPLE_NUMBERS = ['000', '111', '222', '333', '444', '555', '666', '777', '888', '999'];

// Generate Win Numbers - จับคู่ทุกตัวเลขที่กรอก
// เช่น 123 → 12, 13, 21, 23, 31, 32
// เช่น 1234 → 12, 13, 14, 21, 23, 24, 31, 32, 34, 41, 42, 43
const generateWinNumbers = (input: string): string[] => {
  // เอาเฉพาะตัวเลข
  const digits = input.replace(/\D/g, '');
  if (digits.length < 2) return [];
  
  // จำกัดสูงสุด 10 หลัก
  const limitedDigits = digits.slice(0, 10);
  
  // เอาตัวเลขไม่ซ้ำ (unique digits)
  const uniqueDigits = [...new Set(limitedDigits.split(''))];
  
  const numbers: string[] = [];
  
  // สร้างเลข 2 ตัวจากการจับคู่ทุกตัว
  for (let i = 0; i < uniqueDigits.length; i++) {
    for (let j = 0; j < uniqueDigits.length; j++) {
      if (i !== j) {
        const num = uniqueDigits[i] + uniqueDigits[j];
        if (!numbers.includes(num)) {
          numbers.push(num);
        }
      }
    }
  }
  
  return numbers;
};

// Generate Double Front (AAB pattern) - 100 numbers
const generateDoubleFrontNumbers = (): string[] => {
  const numbers: string[] = [];
  for (let a = 0; a <= 9; a++) {
    for (let b = 0; b <= 9; b++) {
      numbers.push(`${a}${a}${b}`);
    }
  }
  return numbers;
};

// Generate Double Back (ABB pattern) - 100 numbers
const generateDoubleBackNumbers = (): string[] => {
  const numbers: string[] = [];
  for (let a = 0; a <= 9; a++) {
    for (let b = 0; b <= 9; b++) {
      numbers.push(`${a}${b}${b}`);
    }
  }
  return numbers;
};

const DOUBLE_FRONT_NUMBERS = generateDoubleFrontNumbers();
const DOUBLE_BACK_NUMBERS = generateDoubleBackNumbers();

// Countdown Timer Component with NaN protection
function CountdownTimer({ closeTime }: { closeTime: string | null | undefined }) {
  const [state, setState] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    status: 'open' | 'closing' | 'closed' | 'unknown';
    display: string;
  }>(() => {
    // Safe initial state
    return { hours: 0, minutes: 0, seconds: 0, status: 'unknown', display: '--:--:--' };
  });

  useEffect(() => {
    // Validate closeTime first
    if (!closeTime || typeof closeTime !== 'string') {
      setState({ hours: 0, minutes: 0, seconds: 0, status: 'unknown', display: '--:--:--' });
      return;
    }

    const updateTimer = () => {
      try {
        // Get current time in Bangkok timezone
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
        
        // Parse close time (format: HH:MM or HH:MM:SS)
        const timeParts = closeTime.split(':').map(Number);
        if (timeParts.some(isNaN) || timeParts.length < 2) {
          setState({ hours: 0, minutes: 0, seconds: 0, status: 'unknown', display: '--:--:--' });
          return;
        }
        
        const [closeH, closeM] = timeParts;
        if (closeH < 0 || closeH > 23 || closeM < 0 || closeM > 59) {
          setState({ hours: 0, minutes: 0, seconds: 0, status: 'unknown', display: '--:--:--' });
          return;
        }
        
        const closeDate = new Date(now);
        closeDate.setHours(closeH, closeM, 0, 0);
        
        const diff = closeDate.getTime() - now.getTime();

        if (diff <= 0) {
          setState({ hours: 0, minutes: 0, seconds: 0, status: 'closed', display: 'ปิดรับแล้ว' });
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          
          // Extra NaN protection
          const safeHours = isNaN(hours) ? 0 : hours;
          const safeMinutes = isNaN(minutes) ? 0 : minutes;
          const safeSeconds = isNaN(seconds) ? 0 : seconds;
          
          const pad = (n: number) => n.toString().padStart(2, '0');
          const display = `${pad(safeHours)}:${pad(safeMinutes)}:${pad(safeSeconds)}`;
          const status = diff <= 30 * 60 * 1000 ? 'closing' : 'open';
          
          setState({ hours: safeHours, minutes: safeMinutes, seconds: safeSeconds, status, display });
        }
      } catch {
        setState({ hours: 0, minutes: 0, seconds: 0, status: 'unknown', display: '--:--:--' });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [closeTime]);

  const statusColors: Record<string, string> = {
    open: 'text-emerald-400',
    closing: 'text-amber-400 animate-pulse',
    closed: 'text-red-400',
    unknown: 'text-slate-400',
  };

  const bgColors: Record<string, string> = {
    open: 'bg-emerald-500/20 border-emerald-500/30',
    closing: 'bg-amber-500/20 border-amber-500/30',
    closed: 'bg-red-500/20 border-red-500/30',
    unknown: 'bg-slate-500/20 border-slate-500/30',
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono font-semibold ${statusColors[state.status]} ${bgColors[state.status]}`}>
      <Clock className="w-4 h-4" />
      {state.status === 'closed' ? (
        <span className="flex items-center gap-1">
          <Lock className="w-3 h-3" />
          ปิดรับแล้ว
        </span>
      ) : state.status === 'unknown' ? (
        <span>--:--:--</span>
      ) : (
        <span>{state.display}</span>
      )}
    </div>
  );
}

export default function LottoBettingPage() {
  const params = useParams();
  const router = useRouter();
  const lotteryId = params.id as string;

  // States
  const [betItems, setBetItems] = useState<BetItem[]>([]);
  const [selectedBetType, setSelectedBetType] = useState<BetType>('2top');
  const [numberInput, setNumberInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // 3 digit options (multi-select for all 3-digit types)
  const [include3Top, setInclude3Top] = useState(false);
  const [include3Tod, setInclude3Tod] = useState(false);
  const [include3Front, setInclude3Front] = useState(false);
  const [include3Back, setInclude3Back] = useState(false);
  
  // 2 digit options (multi-select for all 2-digit types)
  const [include2Top, setInclude2Top] = useState(false);
  const [include2Bot, setInclude2Bot] = useState(false);
  const [include2Reverse, setInclude2Reverse] = useState(false);
  
  // Grid selection for special types
  const [selectedGridNumbers, setSelectedGridNumbers] = useState<string[]>([]);
  const [gridSearch, setGridSearch] = useState('');
  
  // Default prices
  const [defaultTop, setDefaultTop] = useState(1);
  const [defaultBot, setDefaultBot] = useState(0);
  const [defaultTod, setDefaultTod] = useState(0);
  
  // Auto Add feature
  const [autoAddEnabled, setAutoAddEnabled] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastAddedRef = useRef<number>(0); // Prevent double-add

  // Fetch data
  const { data: lottery, error: lotteryError } = useSWR(
    lotteryId ? `/api/lotteries/${lotteryId}` : null,
    fetcher
  );
  
  const { data: customer, error: customerError, mutate: mutateCustomer } = useSWR('/api/customer/me', fetcher, {
    onError: (err) => {
    }
  });
  const { data: blockedNumbers } = useSWR(
    lotteryId ? `/api/blocked-numbers?lottery_id=${lotteryId}` : null,
    fetcher
  );

  // Check if lottery is closed
  const isClosed = useMemo(() => {
    if (!lottery?.close_time) return false;
    return new Date(lottery.close_time) <= new Date();
  }, [lottery?.close_time]);

  // Get digit count for current bet type
  const getDigitCount = useCallback(() => {
    // Check if any 3-digit type is selected
    if (include3Top || include3Tod || include3Front || include3Back) {
      return 3;
    }
    // Check if any 2-digit type is selected
    if (include2Top || include2Bot || include2Reverse) {
      return 2;
    }
    // Default to bet type
    return BET_TYPES[selectedBetType]?.digits || 2;
  }, [selectedBetType, include3Top, include3Tod, include3Front, include3Back, include2Top, include2Bot, include2Reverse]);

  // Check if number is blocked
  const isBlocked = useCallback((number: string) => {
    if (!blockedNumbers?.data) return false;
    return blockedNumbers.data.some((b: { number: string }) => b.number === number);
  }, [blockedNumbers]);

  // Generate reverse number for 2 digits
  const getReverseNumber = (num: string): string | null => {
    if (num.length !== 2) return null;
    const reversed = num.split('').reverse().join('');
    return reversed !== num ? reversed : null;
  };

  // Generate 6 Back permutations
  const generate6Back = (num: string): string[] => {
    if (num.length !== 3) return [];
    const perms = new Set<string>();
    const chars = num.split('');
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 3; k++) {
          if (i !== j && j !== k && i !== k) {
            perms.add(chars[i] + chars[j] + chars[k]);
          }
        }
      }
    }
    return Array.from(perms).sort();
  };

  // Generate 19 Gate numbers
  const generate19Gate = (digit: string): string[] => {
    if (!/^\d$/.test(digit)) return [];
    const numbers = new Set<string>();
    for (let i = 0; i <= 9; i++) {
      numbers.add(digit + i.toString());
      numbers.add(i.toString() + digit);
    }
    return Array.from(numbers).sort((a, b) => parseInt(a) - parseInt(b));
  };

  // Add 3-digit numbers with top/tod options (multi-select)
  const add3DigitNumbers = (input: string) => {
    if (input.length < 3) {
      toast.error('กรุณากรอกเลข 3 ตัว');
      return;
    }
    
    if (!include3Top && !include3Tod) {
      toast.error('กรุณาเลือกอย่างน้อย 1 ประเภท (3 ตัวบน หรือ 3 ตัวโต๊ด)');
      return;
    }
    
    const numbers: string[] = [];
    for (let i = 0; i <= input.length - 3; i += 3) {
      numbers.push(input.substring(i, i + 3));
    }
    
    const newItems: BetItem[] = [];
    const updatedItems = [...betItems];
    let added = 0;
    let merged = 0;
    let skipped = 0;
    
    for (const num of numbers) {
      if (isBlocked(num)) {
        toast.error(`เลข ${num} ถูกอั้น`);
        skipped++;
        continue;
      }
      
      // Check if this number already exists in cart
      const existingIndex = updatedItems.findIndex(item => 
        item.number === num && (item.bet_type === '3top' || item.bet_type === '3tod' || item.bet_type === '3top_tod')
      );
      
      if (existingIndex !== -1) {
        // Merge with existing item
        const existing = updatedItems[existingIndex];
        let updated = false;
        
        if (include3Top && existing.amount_top === 0) {
          existing.amount_top = defaultTop;
          existing.bet_type = include3Tod ? '3top_tod' : '3top';
          updated = true;
        }
        if (include3Tod && existing.amount_tod === 0) {
          existing.amount_tod = defaultTod || defaultTop;
          existing.bet_type = include3Top ? '3top_tod' : '3tod';
          updated = true;
        }
        
        if (updated) {
          merged++;
        } else {
          skipped++;
        }
      } else {
        // Create new item
        const betType = include3Top && include3Tod ? '3top_tod' : include3Top ? '3top' : '3tod';
        newItems.push({
          id: `${Date.now()}-3digit-${num}-${Math.random()}`,
          number: num,
          bet_type: betType,
          amount_top: include3Top ? defaultTop : 0,
          amount_bottom: 0,
          amount_tod: include3Tod ? (defaultTod || defaultTop) : 0,
          is_reverse: false,
        });
        added++;
      }
    }
    
    setBetItems([...updatedItems.filter((_, i) => {
      // Keep all items, we already updated them in place
      return true;
    }), ...newItems]);
    
    if (added > 0 || merged > 0) {
      const parts = [];
      if (added > 0) parts.push(`เพิ่ม ${added} เลข`);
      if (merged > 0) parts.push(`รวม ${merged} ��ลข`);
      toast.success(parts.join(', '));
    } else if (skipped > 0) {
      toast.warning('เลขทั้งหมดมีอยู่ในตะกร้าแล้ว');
    }
    
    setNumberInput('');
  };

  // Add numbers based on bet type
  const addNumbers = () => {
    const cleanInput = numberInput.replace(/\D/g, '');
    const digitCount = getDigitCount();
    
    // Special handling for grid-based types
    if (['triple', 'double_front', 'double_back'].includes(selectedBetType)) {
      addGridSelection();
      return;
    }
    
    // For 3-digit types with options (multi-select)
    if (selectedBetType === '3top' || selectedBetType === '3tod') {
      add3DigitNumbers(cleanInput);
      return;
    }
    
    // For 2-digit types with options
    if (selectedBetType === '2top' || selectedBetType === '2bot') {
      add2DigitNumbers(cleanInput);
      return;
    }
    
    // For 19 Gate
    if (selectedBetType === '19gate') {
      if (cleanInput.length !== 1) {
        toast.error('กรุณากรอกเลข 0-9 จำนวน 1 ตัว');
        return;
      }
      const gateNumbers = generate19Gate(cleanInput);
      addMultipleNumbers(gateNumbers, '2top');
      setNumberInput('');
      return;
    }
    
    // For 6 Back
    if (selectedBetType === '6back') {
      if (cleanInput.length !== 3) {
        toast.error('กรุณากรอกเลข 3 ตัว');
        return;
      }
      const backNumbers = generate6Back(cleanInput);
      addMultipleNumbers(backNumbers, '3top');
      setNumberInput('');
      return;
    }
    
    // For Win Number - เลขวิน
    if (selectedBetType === 'win_number') {
      if (cleanInput.length < 2) {
        toast.error('กรุณากรอกอย่างน้อย 2 ตัว');
        return;
      }
      
      // Use autoAddSingleNumber which handles win_number
      autoAddSingleNumber(cleanInput);
      setNumberInput('');
      return;
    }
    
    // Standard number input
    if (cleanInput.length < digitCount) {
      toast.error(`กรุณากรอกเลข ${digitCount} ตัว`);
      return;
    }
    
    // Parse multiple numbers
    const numbers: string[] = [];
    for (let i = 0; i <= cleanInput.length - digitCount; i += digitCount) {
      numbers.push(cleanInput.substring(i, i + digitCount));
    }
    
    addMultipleNumbers(numbers, selectedBetType);
    setNumberInput('');
  };

  // Add 2-digit numbers with top/bot/reverse options
  const add2DigitNumbers = (input: string) => {
    if (input.length < 2) {
      toast.error('กรุณากรอกเลข 2 ตัว');
      return;
    }
    
    const numbers: string[] = [];
    for (let i = 0; i <= input.length - 2; i += 2) {
      numbers.push(input.substring(i, i + 2));
    }
    
    const newItems: BetItem[] = [];
    let skipped = 0;
    
    for (const num of numbers) {
      if (isBlocked(num)) {
        toast.error(`เลข ${num} ถูกอั้น`);
        skipped++;
        continue;
      }
      
      // Add based on selected options
      if (include2Top) {
        const exists = betItems.some(item => item.number === num && item.bet_type === '2top');
        if (!exists) {
          newItems.push({
            id: `${Date.now()}-2top-${num}-${Math.random()}`,
            number: num,
            bet_type: '2top',
            amount_top: defaultTop,
            amount_bottom: 0,
            amount_tod: 0,
            is_reverse: false,
          });
        } else {
          skipped++;
        }
      }
      
      if (include2Bot) {
        const exists = betItems.some(item => item.number === num && item.bet_type === '2bot');
        if (!exists) {
          newItems.push({
            id: `${Date.now()}-2bot-${num}-${Math.random()}`,
            number: num,
            bet_type: '2bot',
            amount_top: 0,
            amount_bottom: defaultBot || defaultTop,
            amount_tod: 0,
            is_reverse: false,
          });
        } else {
          skipped++;
        }
      }
      
      // Handle 2-digit reverse
      if (include2Reverse) {
        const reversed = getReverseNumber(num);
        if (reversed) {
          if (include2Top) {
            const exists = betItems.some(item => item.number === reversed && item.bet_type === '2top');
            if (!exists && !newItems.some(item => item.number === reversed && item.bet_type === '2top')) {
              newItems.push({
                id: `${Date.now()}-2top-rev-${reversed}-${Math.random()}`,
                number: reversed,
                bet_type: '2top',
                amount_top: defaultTop,
                amount_bottom: 0,
                amount_tod: 0,
                is_reverse: true,
                original_number: num,
              });
            }
          }
          if (include2Bot) {
            const exists = betItems.some(item => item.number === reversed && item.bet_type === '2bot');
            if (!exists && !newItems.some(item => item.number === reversed && item.bet_type === '2bot')) {
              newItems.push({
                id: `${Date.now()}-2bot-rev-${reversed}-${Math.random()}`,
                number: reversed,
                bet_type: '2bot',
                amount_top: 0,
                amount_bottom: defaultBot || defaultTop,
                amount_tod: 0,
                is_reverse: true,
                original_number: num,
              });
            }
          }
        }
      }
    }
    
    if (newItems.length > 0) {
      setBetItems([...betItems, ...newItems]);
      toast.success(`เพิ่ม ${newItems.length} รายการ${skipped > 0 ? ` (ข้าม ${skipped} รายการซ้ำ/อั้น)` : ''}`);
    } else {
      toast.warning('ไม่มีรายการใหม่ที่จะเพิ่ม');
    }
    setNumberInput('');
  };

  // Auto Add Effect - triggered when input reaches required digits
  useEffect(() => {
    if (!autoAddEnabled || isClosed) return;
    
    // Skip grid-based types (they use click selection) and win_number (needs manual add)
    if (['triple', 'double_front', 'double_back', 'win_number'].includes(selectedBetType)) return;
    
    const cleanInput = numberInput.replace(/\D/g, '');
    if (!cleanInput) return;
    
    // Prevent double-add within 300ms
    const now = Date.now();
    if (now - lastAddedRef.current < 300) return;
    
    // Determine required digits - check multi-select states first
    let requiredDigits: number;
    if (selectedBetType === '19gate') {
      requiredDigits = 1;
    } else if (selectedBetType === '6back') {
      requiredDigits = 3;
    } else if (selectedBetType === 'run_top' || selectedBetType === 'run_bot') {
      requiredDigits = 1;
    } else if (include3Top || include3Tod || include3Front || include3Back) {
      // Any 3-digit type selected = need 3 digits
      requiredDigits = 3;
    } else if (include2Top || include2Bot || include2Reverse) {
      // Any 2-digit type selected = need 2 digits
      requiredDigits = 2;
    } else {
      requiredDigits = BET_TYPES[selectedBetType]?.digits || 2;
    }
    
    // Check if we have enough digits
    if (cleanInput.length >= requiredDigits) {
      lastAddedRef.current = now;
      
      // Extract the number to add
      const numberToAdd = cleanInput.substring(0, requiredDigits);
      const remainingInput = cleanInput.substring(requiredDigits);
      
      // Auto add the number
      setTimeout(() => {
        // Call addNumbers logic directly for this single number
        autoAddSingleNumber(numberToAdd);
        
        // Clear input and set remaining (for continuous typing)
        setNumberInput(remainingInput);
        
        // Focus back to input
        setTimeout(() => {
          inputRef.current?.focus();
        }, 50);
      }, 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberInput, autoAddEnabled, selectedBetType, isClosed]);
  
  // Auto add single number (called by useEffect)
  const autoAddSingleNumber = useCallback((num: string) => {
    if (isClosed) {
      toast.error('หวยปิดรับแล้ว');
      return;
    }
    
    // Check blocked
    if (isBlocked(num)) {
      toast.error(`เลข ${num} ถูกอั้น`);
      return;
    }
    
    const newItems: BetItem[] = [];
    let addedCount = 0;
    
    // Handle different bet types
    if (selectedBetType === '19gate') {
      // Generate 19 gate numbers + กลับเลข
      const gateNumbers = generate19Gate(num);
      const allNumbers = new Set<string>();
      
      // เพิ่มเลขต้นฉบับและกลับเลข
      gateNumbers.forEach(gateNum => {
        allNumbers.add(gateNum);
        const reversed = gateNum.split('').reverse().join('');
        if (reversed !== gateNum) {
          allNumbers.add(reversed);
        }
      });
      
      // เพิ่มทั้ง 2บน และ 2ล่าง อัตโนมัติ
      for (const gateNum of allNumbers) {
        if (isBlocked(gateNum)) continue;
        
        // เพิ่ม 2บน
        if (!betItems.some(item => item.number === gateNum && item.bet_type === '2top') &&
            !newItems.some(item => item.number === gateNum && item.bet_type === '2top')) {
          newItems.push({
            id: `${Date.now()}-19gate-2top-${gateNum}-${Math.random()}`,
            number: gateNum,
            bet_type: '2top',
            amount_top: defaultTop,
            amount_bottom: 0,
            amount_tod: 0,
            is_reverse: false,
            original_number: num,
            source_type: '19gate',
            source_input: num,
          });
        }
        
        // เพิ่ม 2ล่าง
        if (!betItems.some(item => item.number === gateNum && item.bet_type === '2bot') &&
            !newItems.some(item => item.number === gateNum && item.bet_type === '2bot')) {
          newItems.push({
            id: `${Date.now()}-19gate-2bot-${gateNum}-${Math.random()}`,
            number: gateNum,
            bet_type: '2bot',
            amount_top: 0,
            amount_bottom: defaultBot || defaultTop,
            amount_tod: 0,
            is_reverse: false,
            original_number: num,
            source_type: '19gate',
            source_input: num,
          });
        }
      }
      
      addedCount = newItems.length;
      if (addedCount > 0) {
        setBetItems(prev => [...prev, ...newItems]);
        toast.success(`เพิ่ม 19 ประตู บน+ล่าง+กลับ (${addedCount} รายการ)`);
      } else {
        toast.warning('เลขทั้งหมดมีอยู่ในตะกร้าแล้ว');
      }
      return;
    }
    
    if (selectedBetType === '6back') {
      // Generate 6 back permutations
      const backNumbers = generate6Back(num);
      for (const backNum of backNumbers) {
        if (!isBlocked(backNum) && !betItems.some(item => item.number === backNum && item.bet_type === '3top')) {
          newItems.push({
            id: `${Date.now()}-6back-${backNum}-${Math.random()}`,
            number: backNum,
            bet_type: '3top',
            amount_top: defaultTop,
            amount_bottom: 0,
            amount_tod: defaultTod,
            is_reverse: backNum !== num,
            original_number: num,
            source_type: '6back',
            source_input: num,
          });
        }
      }
      addedCount = newItems.length;
      if (addedCount > 0) {
        setBetItems(prev => [...prev, ...newItems]);
        toast.success(`เพิ่ม 6 กลับ (${addedCount} เลข)`);
      } else {
        toast.warning('เลขทั้งหมดมีอยู่ในตะกร้าแล้ว');
      }
      return;
    }
    
    // Handle win_number - เลขวิน (อัตโนมัติทั้งบน+ล่าง+กลับ)
    if (selectedBetType === 'win_number') {
      if (num.length < 2) {
        toast.error('กรุณากรอกอย่างน้อย 2 ตัว');
        return;
      }
      
      // Generate เลขวิน
      const winNumbers = generateWinNumbers(num);
      
      if (winNumbers.length === 0) {
        toast.error('ไม่สามารถสร้างเลขวินได้ กรุณากรอกเลขที่ไม่ซ้ำกันอย่างน้อย 2 ตัว');
        return;
      }
      
      // รวมเลขกลับด้วย
      const allNumbers = new Set<string>();
      winNumbers.forEach(winNum => {
        allNumbers.add(winNum);
        const reversed = winNum.split('').reverse().join('');
        if (reversed !== winNum) {
          allNumbers.add(reversed);
        }
      });
      
      // เพิ่มทั้ง 2บน และ 2ล่าง อัตโนมัติ
      for (const winNum of allNumbers) {
        if (isBlocked(winNum)) continue;
        
        // เพิ่มบน
        if (!betItems.some(item => item.number === winNum && item.bet_type === '2top') &&
            !newItems.some(item => item.number === winNum && item.bet_type === '2top')) {
          newItems.push({
            id: `${Date.now()}-win-2top-${winNum}-${Math.random()}`,
            number: winNum,
            bet_type: '2top',
            amount_top: defaultTop,
            amount_bottom: 0,
            amount_tod: 0,
            is_reverse: false,
            original_number: num,
            source_type: 'win_number',
            source_input: num,
          });
        }
        
        // เพิ่มล่าง
        if (!betItems.some(item => item.number === winNum && item.bet_type === '2bot') &&
            !newItems.some(item => item.number === winNum && item.bet_type === '2bot')) {
          newItems.push({
            id: `${Date.now()}-win-2bot-${winNum}-${Math.random()}`,
            number: winNum,
            bet_type: '2bot',
            amount_top: 0,
            amount_bottom: defaultBot || defaultTop,
            amount_tod: 0,
            is_reverse: false,
            original_number: num,
            source_type: 'win_number',
            source_input: num,
          });
        }
      }
      
      addedCount = newItems.length;
      if (addedCount > 0) {
        setBetItems(prev => [...prev, ...newItems]);
        toast.success(`เ���ิ่มเลขวิน บน+ล่าง+กลับ (${addedCount} รายการ)`);
      } else {
        toast.warning('เลขทั้งหมดมีอยู่ในตะกร้าแล้วหรือถูกอั้���');
      }
      return;
    }
    
    // Handle 3-digit with multi-select (3top + 3tod + 3front + 3back)
    // Check if ANY 3-digit type is selected (not just based on selectedBetType)
    const is3DigitMode = include3Top || include3Tod || include3Front || include3Back;
    if (is3DigitMode && num.length === 3) {
      if (!include3Top && !include3Tod && !include3Front && !include3Back) {
        toast.error('กรุณาเลือกอย่างน้อย 1 ประเภท (บน/โต๊ด/หน้า/ล่าง)');
        return;
      }
      
      const itemsToAdd: Array<{ betType: BetType; amountTop: number; amountTod: number }> = [];
      
      // Add 3top if selected
      if (include3Top && !betItems.some(item => item.number === num && item.bet_type === '3top')) {
        itemsToAdd.push({ betType: '3top', amountTop: defaultTop, amountTod: 0 });
      }
      
      // Add 3tod if selected
      if (include3Tod && !betItems.some(item => item.number === num && item.bet_type === '3tod')) {
        itemsToAdd.push({ betType: '3tod', amountTop: 0, amountTod: defaultTod || defaultTop });
      }
      
      // Add 3front if selected
      if (include3Front && !betItems.some(item => item.number === num && item.bet_type === '3front')) {
        itemsToAdd.push({ betType: '3front', amountTop: defaultTop, amountTod: 0 });
      }
      
      // Add 3back if selected
      if (include3Back && !betItems.some(item => item.number === num && item.bet_type === '3back')) {
        itemsToAdd.push({ betType: '3back', amountTop: defaultTop, amountTod: 0 });
      }
      
      if (itemsToAdd.length === 0) {
        toast.warning(`เลข ${num} มีอยู่ในตะกร้าแล้ว`);
        return;
      }
      
      for (const item of itemsToAdd) {
        newItems.push({
          id: `${Date.now()}-${item.betType}-${num}-${Math.random()}`,
          number: num,
          bet_type: item.betType,
          amount_top: item.amountTop,
          amount_bottom: 0,
          amount_tod: item.amountTod,
          is_reverse: false,
        });
      }
      
      setBetItems(prev => [...prev, ...newItems]);
      const typeLabels = itemsToAdd.map(i => getBetTypeLabel(i.betType)).join(', ');
      toast.success(`เพิ่มเลข ${num} (${typeLabels})`);
      return;
    }
    
    // Handle 2-digit with multi-select (2top + 2bot + reverse)
    // Check if ANY 2-digit type is selected (not just based on selectedBetType)
    const is2DigitMode = include2Top || include2Bot || include2Reverse;
    if (is2DigitMode && num.length === 2) {
      if (!include2Top && !include2Bot && !include2Reverse) {
        toast.error('กรุณาเลือกอย่างน้อย 1 ประเภท (บน/ล่าง/กลับ)');
        return;
      }
      
      const numbersToAdd: Array<{ num: string; type: '2top' | '2bot'; isReverse: boolean }> = [];
      
      // Add main number
      if (include2Top && !betItems.some(item => item.number === num && item.bet_type === '2top')) {
        numbersToAdd.push({ num, type: '2top', isReverse: false });
      }
      if (include2Bot && !betItems.some(item => item.number === num && item.bet_type === '2bot')) {
        numbersToAdd.push({ num, type: '2bot', isReverse: false });
      }
      
      // Add reversed number if enabled
      if (include2Reverse) {
        const reversed = getReverseNumber(num);
        if (reversed) {
          if (include2Top && !betItems.some(item => item.number === reversed && item.bet_type === '2top')) {
            numbersToAdd.push({ num: reversed, type: '2top', isReverse: true });
          }
          if (include2Bot && !betItems.some(item => item.number === reversed && item.bet_type === '2bot')) {
            numbersToAdd.push({ num: reversed, type: '2bot', isReverse: true });
          }
        }
      }
      
      if (numbersToAdd.length === 0) {
        toast.warning(`เลข ${num}${include2Reverse ? ' และเลขกลับ' : ''} มีอยู่ในตะกร้าแล้ว`);
        return;
      }
      
      for (const item of numbersToAdd) {
        newItems.push({
          id: `${Date.now()}-${item.type}-${item.num}-${Math.random()}`,
          number: item.num,
          bet_type: item.type,
          amount_top: item.type === '2top' ? defaultTop : 0,
          amount_bottom: item.type === '2bot' ? (defaultBot || defaultTop) : 0,
          amount_tod: 0,
          is_reverse: item.isReverse,
          original_number: item.isReverse ? num : undefined,
        });
      }
      
      setBetItems(prev => [...prev, ...newItems]);
      const reverseText = include2Reverse ? ` (${newItems.length} รายการ)` : '';
      toast.success(`เพิ่มเลข ${num}${reverseText}`);
      return;
    }
    
    // Handle run types
    if (selectedBetType === 'run_top' || selectedBetType === 'run_bot') {
      const exists = betItems.some(item => item.number === num && item.bet_type === selectedBetType);
      if (exists) {
        toast.warning(`เลข ${num} มีอยู่ในตะกร้าแล้ว`);
        return;
      }
      
      newItems.push({
        id: `${Date.now()}-${selectedBetType}-${num}-${Math.random()}`,
        number: num,
        bet_type: selectedBetType,
        amount_top: selectedBetType === 'run_top' ? defaultTop : 0,
        amount_bottom: selectedBetType === 'run_bot' ? (defaultBot || defaultTop) : 0,
        amount_tod: 0,
        is_reverse: false,
      });
      
      setBetItems(prev => [...prev, ...newItems]);
      toast.success(`เพิ่มเลข ${num} (${getBetTypeLabel(selectedBetType)})`);
      return;
    }
    
    }, [selectedBetType, betItems, isBlocked, isClosed, include2Top, include2Bot, include2Reverse, include3Top, include3Tod, include3Front, include3Back, defaultTop, defaultBot, defaultTod]);

  // Add multiple numbers helper
  const addMultipleNumbers = (numbers: string[], betType: string) => {
    const newItems: BetItem[] = [];
    let skipped = 0;
    
    for (const num of numbers) {
      if (isBlocked(num)) {
        skipped++;
        continue;
      }
      const exists = betItems.some(item => item.number === num && item.bet_type === betType);
      if (exists) {
        skipped++;
        continue;
      }
      
      newItems.push({
        id: `${Date.now()}-${betType}-${num}-${Math.random()}`,
        number: num,
        bet_type: betType,
        amount_top: defaultTop,
        amount_bottom: 0,
        amount_tod: betType.includes('3') ? defaultTod : 0,
        is_reverse: false,
      });
    }
    
    if (newItems.length > 0) {
      setBetItems([...betItems, ...newItems]);
      toast.success(`เพิ่ม ${newItems.length} รายการ${skipped > 0 ? ` (ข้าม ${skipped} รายการซ้ำ/อั้น)` : ''}`);
    } else {
      toast.warning('ไม่มีรายการใหม่ที่จ��เพิ่ม');
    }
  };

  // Add grid selection (triple, double_front, double_back)
  const addGridSelection = () => {
    if (selectedGridNumbers.length === 0) {
      toast.error('กรุณาเลือกเลขอย่างน้อย 1 ตัว');
      return;
    }
    
    const newItems: BetItem[] = [];
    let skipped = 0;
    
    for (const num of selectedGridNumbers) {
      if (isBlocked(num)) {
        skipped++;
        continue;
      }
      const exists = betItems.some(item => item.number === num && item.bet_type === selectedBetType);
      if (exists) {
        skipped++;
        continue;
      }
      
      newItems.push({
        id: `${Date.now()}-${selectedBetType}-${num}-${Math.random()}`,
        number: num,
        bet_type: selectedBetType,
        amount_top: defaultTop,
        amount_bottom: 0,
        amount_tod: defaultTod,
        is_reverse: false,
      });
    }
    
    if (newItems.length > 0) {
      setBetItems([...betItems, ...newItems]);
      toast.success(`เพิ่ม ${newItems.length} รายการ${skipped > 0 ? ` (ข้าม ${skipped} รายการซ้ำ/อั้น)` : ''}`);
      setSelectedGridNumbers([]);
    } else {
      toast.warning('เลขที่เลือกมีอยู่ในตะกร้าแล้ว');
    }
  };

  // Toggle grid number selection
  const toggleGridNumber = (num: string) => {
    // Check if already in cart
    if (betItems.some(item => item.number === num && item.bet_type === selectedBetType)) {
      toast.warning(`เลข ${num} อยู่ในตะกร้าแล้ว`);
      return;
    }
    
    if (selectedGridNumbers.includes(num)) {
      setSelectedGridNumbers(selectedGridNumbers.filter(n => n !== num));
    } else {
      setSelectedGridNumbers([...selectedGridNumbers, num]);
    }
  };

  // Select all grid numbers
  const selectAllGridNumbers = () => {
    let allNumbers: string[] = [];
    if (selectedBetType === 'triple') allNumbers = TRIPLE_NUMBERS;
    else if (selectedBetType === 'double_front') allNumbers = DOUBLE_FRONT_NUMBERS;
    else if (selectedBetType === 'double_back') allNumbers = DOUBLE_BACK_NUMBERS;
    
    // Filter out already in cart
    const available = allNumbers.filter(num => 
      !betItems.some(item => item.number === num && item.bet_type === selectedBetType)
    );
    setSelectedGridNumbers(available);
  };

  // Update item amount - ใช้เมื่อพิมพ์เอง (แทนค่าเดิม)
  const updateItemAmount = (id: string, field: 'amount_top' | 'amount_bottom' | 'amount_tod', value: number) => {
    // Validate value - ห้าม NaN, undefined, ติดลบ
    const safeValue = Math.max(0, isNaN(value) ? 0 : value);
    setBetItems(betItems.map(item => 
      item.id === id ? { ...item, [field]: safeValue } : item
    ));
  };
  
  // Add to item amount - ใช้เมื่อกดปุ่มราคาเร็ว (บวกเพิ่ม)
  const addToItemAmount = (id: string, field: 'amount_top' | 'amount_bottom' | 'amount_tod', addValue: number) => {
    setBetItems(betItems.map(item => {
      if (item.id !== id) return item;
      const currentValue = item[field] || 0;
      const newValue = Math.max(0, currentValue + addValue);
      return { ...item, [field]: newValue };
    }));
  };

  // Remove item
  const removeItem = (id: string) => {
    setBetItems(betItems.filter(item => item.id !== id));
  };

  // Clear all items
  const clearAllItems = () => {
    setBetItems([]);
    toast.success('ล้างตะกร้าแล้ว');
  };

  // Apply price to all items - บวกเพิ่มจากค่าเดิม ไม่ใช่แทนค่า
  const applyPriceToAll = (amount: number, field: 'amount_top' | 'amount_bottom' | 'amount_tod' | 'both_top_tod') => {
    if (field === 'both_top_tod') {
      // Add to both top and tod for 3-digit items
      setBetItems(betItems.map(item => {
        if (['3top_tod', '3top', '3tod', '3front', '3back', 'triple', 'double_front', 'double_back', '6back'].includes(item.bet_type)) {
          const newTop = Math.max(0, (item.amount_top || 0) + amount);
          const newTod = Math.max(0, (item.amount_tod || 0) + amount);
          return { ...item, amount_top: newTop, amount_tod: newTod };
        }
        return item;
      }));
      toast.success(`+${amount} บาท (บน+โต๊ด) ทุกรายการ`);
    } else if (field === 'amount_top') {
      // Add to top amount
      setBetItems(betItems.map(item => {
        if (['3top', '3top_tod', '3front', '3back', '2top', 'run_top', '6back', '19gate', 'triple', 'double_front', 'double_back'].includes(item.bet_type)) {
          const newAmount = Math.max(0, (item.amount_top || 0) + amount);
          return { ...item, amount_top: newAmount };
        }
        return item;
      }));
      toast.success(`+${amount} บาท (บน) ทุกรายการ`);
    } else if (field === 'amount_bottom') {
      // Add to bottom amount
      setBetItems(betItems.map(item => {
        if (['2bot', 'run_bot'].includes(item.bet_type)) {
          const newAmount = Math.max(0, (item.amount_bottom || 0) + amount);
          return { ...item, amount_bottom: newAmount };
        }
        return item;
      }));
      toast.success(`+${amount} บาท (ล่าง) ทุกรายการ`);
    } else if (field === 'amount_tod') {
      // Add to tod amount
      setBetItems(betItems.map(item => {
        if (['3tod', '3top_tod'].includes(item.bet_type)) {
          const newAmount = Math.max(0, (item.amount_tod || 0) + amount);
          return { ...item, amount_tod: newAmount };
        }
        return item;
      }));
      toast.success(`+${amount} บาท (โต๊ด) ทุกรายการ`);
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    let total = 0;
    for (const item of betItems) {
      total += (item.amount_top || 0) + (item.amount_bottom || 0) + (item.amount_tod || 0);
    }
    return { total, count: betItems.length };
  }, [betItems]);

  // Submit bet
  const submitBet = async () => {
    try {
      // Validation 1: ต้องมีรายการ
      if (!betItems || betItems.length === 0) {
        toast.error('กรุณาเพิ่มเลขอย่างน้อย 1 รายการ');
        return;
      }
      
      // Validation 2: ตรวจทุกรายการต้องมีราคาอย่างน้อย 1 ช่อง
      const itemsWithNoPrice = betItems.filter(item => {
        const itemTotal = (Number(item.amount_top) || 0) + (Number(item.amount_bottom) || 0) + (Number(item.amount_tod) || 0);
        return itemTotal <= 0;
      });
      
      if (itemsWithNoPrice.length > 0) {
        toast.error(`มี ${itemsWithNoPrice.length} รายการที่ยังไม่ได้ใส่ราคา`);
        return;
      }
      
      // Validation 3: ยอดรวมต้องมากกว่า 0
      if (!totals || totals.total <= 0 || isNaN(totals.total)) {
        toast.error('กรุณาใส่ราคาอย่างน้อย 1 บาท');
        return;
      }
      
      // Validation 4: ต้อง login
      if (!customer || !customer.id) {
        toast.error('กรุณาเข้าสู่ระบบก่อนส่งโพย');
        router.push('/c/login');
        return;
      }
      
      // Validation 5: lotteryId ต้องมี
      if (!lotteryId) {
        toast.error('ไม่พบข้อมูลหวย กรุณาเลือกหวยใหม่');
        return;
      }
      
      // Validation 6: เครดิตต้อง���อ
      const customerBalance = Number(customer.credit_balance) || 0;
      if (customerBalance < totals.total) {
        toast.error(`เครดิตไม่เพียงพอ (มี ${customerBalance.toLocaleString()} ต้องการ ${totals.total.toLocaleString()} บาท) กรุณาเติมเงิน`);
        return;
      }
      
      // Validation 7: หวย���ังไม่ปิด
      if (isClosed) {
        toast.error('หวยปิดรับแทงแล้ว');
        return;
      }
      
      setShowConfirmDialog(true);
      
    } catch (error) {
      console.error('submitBet error:', error);
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
    }
  };

  // Confirm and submit
  const confirmSubmit = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const payload = {
        lottery_id: lotteryId,
        customer_id: customer.id,
        items: betItems.map(item => ({
          number: item.number,
          bet_type: item.bet_type,
          amount_top: Number(item.amount_top) || 0,
          amount_bottom: Number(item.amount_bottom) || 0,
          amount_tod: Number(item.amount_tod) || 0,
          is_reverse: item.is_reverse || false,
          original_number: item.original_number || item.number,
          source_type: item.source_type || 'manual',
          source_input: item.source_input,
        })),
        total_amount: totals.total,
      };
      
      
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      
      const data = await res.json();
      
      if (!res.ok) {
        const errorMsg = data.error || 'ไม่สามารถส่งโพยได้';
        throw new Error(errorMsg);
      }
      
      toast.success(`ส่งโพยสำเร็จ! (${data.item_count || betItems.length} รายการ, ${(data.total_amount || totals.total).toLocaleString()} บาท)`);
      setBetItems([]);
      setShowConfirmDialog(false);
      
      if (mutateCustomer) {
        await mutateCustomer();
      }
      
      router.push('/c/history');
      
    } catch (error) {
      console.error('confirmSubmit error:', error);
      const errorMessage = error instanceof Error ? error.message : 'ส่งโพยไม่สำเร็จ กรุณาลองใหม่';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get grid numbers based on bet type
  const getGridNumbers = useMemo(() => {
    if (selectedBetType === 'triple') return TRIPLE_NUMBERS;
    if (selectedBetType === 'double_front') return DOUBLE_FRONT_NUMBERS;
    if (selectedBetType === 'double_back') return DOUBLE_BACK_NUMBERS;
    return [];
  }, [selectedBetType]);

  // Filter grid numbers by search
  const filteredGridNumbers = useMemo(() => {
    if (!gridSearch) return getGridNumbers;
    return getGridNumbers.filter(num => num.includes(gridSearch));
  }, [getGridNumbers, gridSearch]);

  // Bet type label
  const getBetTypeLabel = (type: string) => {
    return BET_TYPES[type as BetType]?.label || type;
  };

  // Loading & Error states
  if (lotteryError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-400">ไม่พบข้อมูลหวย</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push('/c/buy')}>
              กลับหน้าหลัก
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!lottery) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-amber-500/20">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/c/buy" className="text-gray-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-lg font-bold text-amber-400">{lottery.name}</h1>
                <CountdownTimer closeTime={lottery.close_time} />
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">
                  {(customer?.credit_balance || 0).toLocaleString()} บาท
                </span>
              </div>
              <Link href="/c/live" className="flex items-center gap-1.5 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/20 transition-colors">
                <Tv className="w-4 h-4 text-red-400" />
                <span className="text-red-400 font-semibold text-sm">ดูไลฟ์สด</span>
              </Link>
              <Link href="/c/notifications" className="text-gray-400 hover:text-white">
                <Bell className="w-5 h-5" />
              </Link>
              <Link href="/c/profile" className="text-gray-400 hover:text-white">
                <User className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Bet Type & Number Input */}
          <div className="lg:col-span-2 space-y-4">
            {/* Bet Type Selection - UI สีทองสวย */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white">เลือกประเภทการแทง</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* 3 ตัว (สีแดง) - Multi-Select */}
                <p className="text-xs text-red-400 font-medium">3 ตัว (สีแดง) - กดเลือกได้หลายอัน</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { 
                      setSelectedBetType('3top'); 
                      setInclude3Top(!include3Top); 
                      setSelectedGridNumbers([]); 
                    }}
                    className={`py-3 px-4 rounded-lg font-bold text-center transition-all relative ${
                      include3Top
                        ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-900 ring-2 ring-white shadow-lg'
                        : 'bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-slate-900 hover:from-amber-300 hover:to-amber-500'
                    }`}
                  >
                    {include3Top && <CheckCircle className="absolute top-1 right-1 w-4 h-4 text-emerald-600" />}
                    <div className="text-sm font-bold">3 ตัวบน</div>
                    <div className="text-xs opacity-80">จ่าย 900</div>
                  </button>
                  <button
                    onClick={() => { 
                      setSelectedBetType('3tod'); 
                      setInclude3Tod(!include3Tod); 
                      setSelectedGridNumbers([]); 
                    }}
                    className={`py-3 px-4 rounded-lg font-bold text-center transition-all relative ${
                      include3Tod
                        ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-900 ring-2 ring-white shadow-lg'
                        : 'bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-slate-900 hover:from-amber-300 hover:to-amber-500'
                    }`}
                  >
                    {include3Tod && <CheckCircle className="absolute top-1 right-1 w-4 h-4 text-emerald-600" />}
                    <div className="text-sm font-bold">3 ตัวโต๊ด</div>
                    <div className="text-xs opacity-80">จ่าย 150</div>
                  </button>
                  <button
                    onClick={() => { 
                      setSelectedBetType('3front'); 
                      setInclude3Front(!include3Front); 
                      setSelectedGridNumbers([]); 
                    }}
                    className={`py-3 px-4 rounded-lg font-bold text-center transition-all relative ${
                      include3Front
                        ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-900 ring-2 ring-white shadow-lg'
                        : 'bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-slate-900 hover:from-amber-300 hover:to-amber-500'
                    }`}
                  >
                    {include3Front && <CheckCircle className="absolute top-1 right-1 w-4 h-4 text-emerald-600" />}
                    <div className="text-sm font-bold">3 ตัวหน้า</div>
                    <div className="text-xs opacity-80">จ่าย 450</div>
                  </button>
                  <button
                    onClick={() => { 
                      setSelectedBetType('3back'); 
                      setInclude3Back(!include3Back); 
                      setSelectedGridNumbers([]); 
                    }}
                    className={`py-3 px-4 rounded-lg font-bold text-center transition-all relative ${
                      include3Back
                        ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-900 ring-2 ring-white shadow-lg'
                        : 'bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-slate-900 hover:from-amber-300 hover:to-amber-500'
                    }`}
                  >
                    {include3Back && <CheckCircle className="absolute top-1 right-1 w-4 h-4 text-emerald-600" />}
                    <div className="text-sm font-bold">3 ตัวล่าง</div>
                    <div className="text-xs opacity-80">จ่าย 450</div>
                  </button>
                </div>

                {/* 2 ตัว & กลับ (สีฟ้า) - Multi-Select */}
                <p className="text-xs text-blue-400 font-medium mt-4">2 ตัว & กลับ (สีฟ้า) - กดเลือกได้หลายอัน</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { 
                      setSelectedBetType('2top'); 
                      setInclude2Top(!include2Top); 
                      setSelectedGridNumbers([]); 
                    }}
                    className={`py-3 px-4 rounded-lg font-bold text-center transition-all relative ${
                      include2Top
                        ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-900 ring-2 ring-white shadow-lg'
                        : 'bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-slate-900 hover:from-amber-300 hover:to-amber-500'
                    }`}
                  >
                    {include2Top && <CheckCircle className="absolute top-1 right-1 w-4 h-4 text-emerald-600" />}
                    <div className="text-sm font-bold">2 ตัวบน</div>
                    <div className="text-xs opacity-80">จ่าย 90</div>
                  </button>
                  <button
                    onClick={() => { 
                      setSelectedBetType('2bot'); 
                      setInclude2Bot(!include2Bot); 
                      setSelectedGridNumbers([]); 
                    }}
                    className={`py-3 px-4 rounded-lg font-bold text-center transition-all relative ${
                      include2Bot
                        ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-900 ring-2 ring-white shadow-lg'
                        : 'bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-slate-900 hover:from-amber-300 hover:to-amber-500'
                    }`}
                  >
                    {include2Bot && <CheckCircle className="absolute top-1 right-1 w-4 h-4 text-emerald-600" />}
                    <div className="text-sm font-bold">2 ตัวล่าง</div>
                    <div className="text-xs opacity-80">จ่าย 90</div>
                  </button>
                  <button
                    onClick={() => { setSelectedBetType('6back'); setSelectedGridNumbers([]); }}
                    className={`py-3 px-4 rounded-lg font-bold text-center transition-all ${
                      selectedBetType === '6back'
                        ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-900 ring-2 ring-white shadow-lg'
                        : 'bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-slate-900 hover:from-amber-300 hover:to-amber-500'
                    }`}
                  >
                    <div className="text-sm font-bold">3 ตัวกลับ</div>
                    <div className="text-xs opacity-80">จ่าย 150</div>
                  </button>
                  <button
                    onClick={() => { 
                      setSelectedBetType('2top'); 
                      setInclude2Reverse(!include2Reverse); 
                      setSelectedGridNumbers([]); 
                    }}
                    className={`py-3 px-4 rounded-lg font-bold text-center transition-all relative ${
                      include2Reverse
                        ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-900 ring-2 ring-white shadow-lg'
                        : 'bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-slate-900 hover:from-amber-300 hover:to-amber-500'
                    }`}
                  >
                    {include2Reverse && <CheckCircle className="absolute top-1 right-1 w-4 h-4 text-emerald-600" />}
                    <div className="text-sm font-bold">2 ตัวกลับ</div>
                    <div className="text-xs opacity-80">จ่าย 90</div>
                  </button>
                </div>

                {/* วิ่ง (สีเขียว) */}
                <p className="text-xs text-green-400 font-medium mt-4">วิ่ง (สีเขียว)</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setSelectedBetType('run_top'); setSelectedGridNumbers([]); }}
                    className={`py-3 px-4 rounded-lg font-bold text-center transition-all ${
                      selectedBetType === 'run_top'
                        ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-900 ring-2 ring-white shadow-lg'
                        : 'bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-slate-900 hover:from-amber-300 hover:to-amber-500'
                    }`}
                  >
                    <div className="text-sm font-bold">วิ่งบน</div>
                    <div className="text-xs opacity-80">จ่าย X3.2</div>
                  </button>
                  <button
                    onClick={() => { setSelectedBetType('run_bot'); setSelectedGridNumbers([]); }}
                    className={`py-3 px-4 rounded-lg font-bold text-center transition-all ${
                      selectedBetType === 'run_bot'
                        ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-900 ring-2 ring-white shadow-lg'
                        : 'bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-slate-900 hover:from-amber-300 hover:to-amber-500'
                    }`}
                  >
                    <div className="text-sm font-bold">วิ่งล่าง</div>
                    <div className="text-xs opacity-80">จ่าย X4.2</div>
                  </button>
                </div>

                {/* พิเศษ (สีม่วง) */}
                <p className="text-xs text-purple-400 font-medium mt-4">พิเศษ</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setSelectedBetType('19gate'); setSelectedGridNumbers([]); }}
                    className={`py-3 px-4 rounded-lg font-bold text-center transition-all ${
                      selectedBetType === '19gate'
                        ? 'bg-gradient-to-b from-orange-400 via-orange-500 to-orange-600 text-white ring-2 ring-white shadow-lg'
                        : 'bg-gradient-to-b from-orange-500 via-orange-600 to-orange-700 text-white hover:from-orange-400 hover:to-orange-600'
                    }`}
                  >
                    <div className="text-sm font-bold">19 ประตู</div>
                    <div className="text-xs opacity-80">จ่าย 90</div>
                  </button>
                  <button
                    onClick={() => { setSelectedBetType('win_number'); setSelectedGridNumbers([]); }}
                    className={`py-3 px-4 rounded-lg font-bold text-center transition-all ${
                      selectedBetType === 'win_number'
                        ? 'bg-gradient-to-b from-fuchsia-400 via-fuchsia-500 to-fuchsia-600 text-white ring-2 ring-white shadow-lg'
                        : 'bg-gradient-to-b from-fuchsia-500 via-fuchsia-600 to-fuchsia-700 text-white hover:from-fuchsia-400 hover:to-fuchsia-600'
                    }`}
                  >
                    <div className="text-sm font-bold">เลขวิน</div>
                    <div className="text-xs opacity-80">จับคู่ทุกตัว</div>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Number Input or Grid Selection */}
            {['triple', 'double_front', 'double_back'].includes(selectedBetType) ? (
              /* Grid Selection for Special Types */
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                      {getBetTypeLabel(selectedBetType)}
                      <Badge variant="secondary" className="bg-amber-500/20 text-amber-400">
                        {selectedBetType === 'triple' ? '10 เลข' : '100 เลข'}
                      </Badge>
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                        onClick={selectAllGridNumbers}
                      >
                        <CheckSquare className="w-4 h-4 mr-1" />
                        เลือกทั้งหมด
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-500 text-gray-400 hover:bg-gray-500/10"
                        onClick={() => setSelectedGridNumbers([])}
                      >
                        <X className="w-4 h-4 mr-1" />
                        ล้าง
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Search */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="ค้นหาเลข..."
                      value={gridSearch}
                      onChange={(e) => setGridSearch(e.target.value.replace(/\D/g, ''))}
                      className="pl-9 bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  
                  {/* Grid */}
                  <ScrollArea className="h-[300px]">
                    <div className={`grid ${selectedBetType === 'triple' ? 'grid-cols-5' : 'grid-cols-10'} gap-2`}>
                      {filteredGridNumbers.map(num => {
                        const inCart = betItems.some(item => item.number === num && item.bet_type === selectedBetType);
                        const isSelected = selectedGridNumbers.includes(num);
                        return (
                          <Button
                            key={num}
                            size="sm"
                            variant="outline"
                            disabled={inCart}
                            className={
                              inCart 
                                ? 'bg-slate-700 border-slate-600 text-gray-500 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 border-0 text-white'
                                  : 'border-slate-600 text-white hover:bg-slate-700'
                            }
                            onClick={() => toggleGridNumber(num)}
                          >
                            {num}
                            {inCart && <span className="text-xs ml-1">✓</span>}
                          </Button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  
                  {/* Add Selected */}
                  {selectedGridNumbers.length > 0 && (
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-gray-400">
                        เลือก {selectedGridNumbers.length} เลข
                      </span>
                      <Button
                        className="bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                        onClick={addGridSelection}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        เพิ่มเข้าตะกร้า
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              /* Standard Number Input */
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Edit3 className="w-5 h-5 text-amber-400" />
                      กรอกเลข
                    </CardTitle>
                    {/* Auto Add Toggle */}
                    <div className="flex items-center gap-2">
                      <label 
                        htmlFor="auto-add" 
                        className={`text-xs font-medium cursor-pointer flex items-center gap-1.5 px-2 py-1 rounded-full transition-colors ${
                          autoAddEnabled 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : 'bg-slate-600/50 text-gray-400'
                        }`}
                      >
                        <Zap className={`w-3.5 h-3.5 ${autoAddEnabled ? 'text-emerald-400' : 'text-gray-500'}`} />
                        Auto
                      </label>
                      <Switch
                        id="auto-add"
                        checked={autoAddEnabled}
                        onCheckedChange={setAutoAddEnabled}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Win Number - Options for Top/Bot */}
                  {selectedBetType === 'win_number' && (
                    <div className="bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-lg p-3 space-y-2">
                      <p className="text-fuchsia-400 text-sm font-medium flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        เลขวิน - จับคู่ทุกตัวเลข
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox 
                            checked={include2Top} 
                            onCheckedChange={(c) => setInclude2Top(!!c)}
                            className="border-emerald-500 data-[state=checked]:bg-emerald-500"
                          />
                          <span className="text-emerald-400 text-sm">2 ตัวบน (x95)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox 
                            checked={include2Bot} 
                            onCheckedChange={(c) => setInclude2Bot(!!c)}
                            className="border-emerald-400 data-[state=checked]:bg-emerald-400"
                          />
                          <span className="text-emerald-300 text-sm">2 ���ัวล่าง (x95)</span>
                        </label>
                      </div>
                      <p className="text-fuchsia-300/70 text-xs">
                        กรอก 123 จะได้: 12, 13, 21, 23, 31, 32 (6 เลข)
                      </p>
                    </div>
                  )}
                  
                  {/* Auto Add Info */}
                  {autoAddEnabled && selectedBetType !== 'win_number' && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <p className="text-emerald-400 text-xs">
                        พิมพ์เลขครบ {getDigitCount()} หลัก จะเพิ่มเข้าตะกร้าอัตโนมัติ
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={selectedBetType === 'win_number' ? 10 : undefined}
                      placeholder={
                        selectedBetType === 'win_number' ? 'กรอกตัวเลข 2-10 ตัว เช่น 123 หรือ 1234'
                        : selectedBetType === '19gate' ? 'กรอกเลข 0-9 (1 ตัว)'
                        : selectedBetType === '6back' ? 'กรอกเลข 3 ตัว'
                        : selectedBetType.includes('run') ? 'กรอกเลข 0-9 (1 ตัว)'
                        : autoAddEnabled 
                          ? `พิมพ์เลข ${getDigitCount()} หลัก...`
                          : `กรอกเลข ${getDigitCount()} ตัว (หลายเลขได้)`
                      }
                      value={numberInput}
                      onChange={(e) => setNumberInput(e.target.value.replace(/\D/g, ''))}
                      className="bg-slate-700 border-slate-600 text-white text-xl font-mono tracking-wider focus:ring-2 focus:ring-amber-500/50"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (selectedBetType === 'win_number' || !autoAddEnabled) {
                            addNumbers();
                          }
                        }
                      }}
                    />
                    {/* Show add button when auto-add is OFF or for win_number */}
                    {(!autoAddEnabled || selectedBetType === 'win_number') && (
                      <Button
                        className={`text-white px-6 ${
                          selectedBetType === 'win_number'
                            ? 'bg-gradient-to-r from-fuchsia-500 to-fuchsia-600'
                            : 'bg-gradient-to-r from-amber-500 to-orange-500'
                        }`}
                        onClick={addNumbers}
                        disabled={!numberInput || isClosed || (selectedBetType === 'win_number' && numberInput.length < 2)}
                      >
                        <Plus className="w-5 h-5" />
                        {selectedBetType === 'win_number' && <span className="ml-1">เพิ่มเลขวิน</span>}
                      </Button>
                    )}
                  </div>
                  
                  {/* Win Number Preview */}
                  {selectedBetType === 'win_number' && numberInput.length >= 2 && (
                    <div className="bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-lg p-3">
                      <p className="text-fuchsia-300 text-xs mb-2">ตัวอย่างเลขที่จะได้:</p>
                      <div className="flex flex-wrap gap-1">
                        {generateWinNumbers(numberInput).slice(0, 20).map((num, i) => (
                          <Badge key={i} variant="outline" className="border-fuchsia-500/50 text-fuchsia-400 text-xs">
                            {num}
                          </Badge>
                        ))}
                        {generateWinNumbers(numberInput).length > 20 && (
                          <Badge variant="outline" className="border-fuchsia-500/50 text-fuchsia-400 text-xs">
                            +{generateWinNumbers(numberInput).length - 20} เลข
                          </Badge>
                        )}
                      </div>
                      <p className="text-fuchsia-400 text-xs mt-2">
                        รวม {generateWinNumbers(numberInput).length} คู่
                        {include2Top && include2Bot ? ' (บน+ล่าง)' : include2Top ? ' (บน)' : include2Bot ? ' (ล่าง)' : ' (บน)'}
                      </p>
                    </div>
                  )}
                  
                  {/* Quick info */}
                  {selectedBetType === '2top' && include2Reverse && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                      <p className="text-amber-400 text-sm">
                        <Sparkles className="w-4 h-4 inline mr-1" />
                        2 ตัวกลับ: กรอก 21 จะได้ 21 + 12 อัตโนมัติ
                      </p>
                    </div>
                  )}
                  
                  {selectedBetType === '19gate' && (
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                      <p className="text-orange-400 text-sm">
                        <Sparkles className="w-4 h-4 inline mr-1" />
                        19 ประตู: กรอก 5 จะได้ 05,15,25,...,59 (19 เลข)
                      </p>
                    </div>
                  )}
                  
                  {selectedBetType === '6back' && (
                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
                      <p className="text-rose-400 text-sm">
                        <Sparkles className="w-4 h-4 inline mr-1" />
                        6 กลับ: กรอก 123 จะได้ 123,132,213,231,312,321 (6 เลข)
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Default Prices */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm">ราคาเริ่มต้น</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 block mb-1">บน</label>
                    <Input
                      type="number"
                      value={defaultTop}
                      onChange={(e) => setDefaultTop(Number(e.target.value) || 0)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 block mb-1">ล่าง</label>
                    <Input
                      type="number"
                      value={defaultBot}
                      onChange={(e) => setDefaultBot(Number(e.target.value) || 0)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 block mb-1">โต๊ด</label>
                    <Input
                      type="number"
                      value={defaultTod}
                      onChange={(e) => setDefaultTod(Number(e.target.value) || 0)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>
                
                {/* Quick Amounts */}
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-2">ราคาเร็ว</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_AMOUNTS.map(amt => (
                      <Button
                        key={amt}
                        size="sm"
                        variant="outline"
                        className="border-slate-600 text-white hover:bg-slate-700"
                        onClick={() => setDefaultTop(amt)}
                      >
                        {amt}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Cart */}
          <div className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700 sticky top-20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-amber-400" />
                    ตะกร้าโพย
                    <Badge variant="secondary" className="bg-amber-500/20 text-amber-400">
                      {totals.count}
                    </Badge>
                  </CardTitle>
                  {betItems.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={clearAllItems}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      ล้าง
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {betItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>ยังไม่มีรายการ</p>
                  </div>
                ) : (
                  <>
                    {/* Apply to all with options - บวกเพิ่มทุกครั้ง */}
                    <div className="mb-4 p-3 bg-slate-700/50 rounded-lg space-y-3">
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Plus className="w-3 h-3" />
                        บวกราคาให้ทุกรายการ
                      </p>
                      
                      {/* Apply to Top */}
                      <div>
                        <p className="text-xs text-blue-400 mb-1.5 font-medium">บน</p>
                        <div className="grid grid-cols-6 gap-1">
                          {QUICK_AMOUNTS.map(amt => (
                            <Button
                              key={`top-${amt}`}
                              size="sm"
                              variant="outline"
                              className="border-blue-500/50 text-blue-400 hover:bg-blue-500/30 hover:scale-105 active:scale-95 transition-all text-xs h-7"
                              onClick={() => applyPriceToAll(amt, 'amount_top')}
                            >
                              +{amt}
                            </Button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Apply to Bottom (only show if there are 2bot items) */}
                      {betItems.some(item => ['2bot', 'run_bot'].includes(item.bet_type)) && (
                        <div>
                          <p className="text-xs text-emerald-400 mb-1.5 font-medium">ล่าง</p>
                          <div className="grid grid-cols-6 gap-1">
                            {QUICK_AMOUNTS.map(amt => (
                              <Button
                                key={`bot-${amt}`}
                                size="sm"
                                variant="outline"
                                className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30 hover:scale-105 active:scale-95 transition-all text-xs h-7"
                                onClick={() => applyPriceToAll(amt, 'amount_bottom')}
                              >
                                +{amt}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Apply to Tod (only show if there are 3tod items) */}
                      {betItems.some(item => ['3tod', '3top_tod'].includes(item.bet_type)) && (
                        <div>
                          <p className="text-xs text-purple-400 mb-1.5 font-medium">โต๊ด</p>
                          <div className="grid grid-cols-6 gap-1">
                            {QUICK_AMOUNTS.map(amt => (
                              <Button
                                key={`tod-${amt}`}
                                size="sm"
                                variant="outline"
                                className="border-purple-500/50 text-purple-400 hover:bg-purple-500/30 hover:scale-105 active:scale-95 transition-all text-xs h-7"
                                onClick={() => applyPriceToAll(amt, 'amount_tod')}
                              >
                                +{amt}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Apply to Both (only show if there are 3top_tod items) */}
                      {betItems.some(item => item.bet_type === '3top_tod') && (
                        <div>
                          <p className="text-xs text-amber-400 mb-1.5 font-medium">ทั้งบน+โต๊ด</p>
                          <div className="grid grid-cols-6 gap-1">
                            {QUICK_AMOUNTS.map(amt => (
                              <Button
                                key={`both-${amt}`}
                                size="sm"
                                variant="outline"
                                className="border-amber-500/50 text-amber-400 hover:bg-amber-500/30 hover:scale-105 active:scale-95 transition-all text-xs h-7"
                                onClick={() => applyPriceToAll(amt, 'both_top_tod')}
                              >
                                +{amt}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Items List */}
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {betItems.map(item => (
                          <div
                            key={item.id}
                            className="bg-slate-700/50 rounded-lg p-3 border border-slate-600"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xl font-mono text-white">{item.number}</span>
                                <Badge 
                                  variant="secondary" 
                                  className={`bg-gradient-to-r ${BET_TYPES[item.bet_type as BetType]?.color || 'from-gray-500 to-gray-600'} text-white text-xs`}
                                >
                                  {getBetTypeLabel(item.bet_type)}
                                </Badge>
                                {item.is_reverse && (
                                  <Badge variant="outline" className="border-amber-500 text-amber-400 text-xs">
                                    กลับ
                                  </Badge>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0"
                                onClick={() => removeItem(item.id)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {/* Show "บน" for: 3top, 3top_tod, 3front, 3back, 2top, run_top, 6back, 19gate, triple, double_front, double_back */}
                              {['3top', '3top_tod', '3front', '3back', '2top', 'run_top', '6back', '19gate', 'triple', 'double_front', 'double_back'].includes(item.bet_type) && (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <label className="text-xs text-blue-400 font-medium min-w-[60px]">บน x{BET_TYPES[item.bet_type as BetType]?.payRate || 900}</label>
                                    <Input
                                      type="number"
                                      value={item.amount_top || ''}
                                      onChange={(e) => updateItemAmount(item.id, 'amount_top', Number(e.target.value) || 0)}
                                      className="bg-slate-800 border-blue-500/50 text-white h-7 text-sm focus:border-blue-500 w-16 text-center"
                                    />
                                    <span className="text-blue-400 text-xs">บาท</span>
                                  </div>
                                  <div className="flex gap-1">
                                    {QUICK_AMOUNTS.map(amt => (
                                      <Button
                                        key={`item-top-${item.id}-${amt}`}
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 border-blue-500/40 text-blue-400 hover:bg-blue-500/30 hover:scale-105 active:scale-95 transition-all text-xs h-6 px-1"
                                        onClick={() => addToItemAmount(item.id, 'amount_top', amt)}
                                      >
                                        +{amt}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Show "ล่าง" for: 2bot, run_bot */}
                              {['2bot', 'run_bot'].includes(item.bet_type) && (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <label className="text-xs text-emerald-400 font-medium min-w-[60px]">ล่าง x{BET_TYPES[item.bet_type as BetType]?.payRate || 95}</label>
                                    <Input
                                      type="number"
                                      value={item.amount_bottom || ''}
                                      onChange={(e) => updateItemAmount(item.id, 'amount_bottom', Number(e.target.value) || 0)}
                                      className="bg-slate-800 border-emerald-500/50 text-white h-7 text-sm focus:border-emerald-500 w-16 text-center"
                                    />
                                    <span className="text-emerald-400 text-xs">บาท</span>
                                  </div>
                                  <div className="flex gap-1">
                                    {QUICK_AMOUNTS.map(amt => (
                                      <Button
                                        key={`item-bot-${item.id}-${amt}`}
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 hover:scale-105 active:scale-95 transition-all text-xs h-6 px-1"
                                        onClick={() => addToItemAmount(item.id, 'amount_bottom', amt)}
                                      >
                                        +{amt}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Show "โต���ด" for: 3tod, 3top_tod */}
                              {['3tod', '3top_tod'].includes(item.bet_type) && (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <label className="text-xs text-purple-400 font-medium min-w-[60px]">โต๊ด x150</label>
                                    <Input
                                      type="number"
                                      value={item.amount_tod || ''}
                                      onChange={(e) => updateItemAmount(item.id, 'amount_tod', Number(e.target.value) || 0)}
                                      className="bg-slate-800 border-purple-500/50 text-white h-7 text-sm focus:border-purple-500 w-16 text-center"
                                    />
                                    <span className="text-purple-400 text-xs">บาท</span>
                                  </div>
                                  <div className="flex gap-1">
                                    {QUICK_AMOUNTS.map(amt => (
                                      <Button
                                        key={`item-tod-${item.id}-${amt}`}
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 border-purple-500/40 text-purple-400 hover:bg-purple-500/30 hover:scale-105 active:scale-95 transition-all text-xs h-6 px-1"
                                        onClick={() => addToItemAmount(item.id, 'amount_tod', amt)}
                                      >
                                        +{amt}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            {/* Item Total */}
                            <div className="text-right mt-2 pt-2 border-t border-slate-600/50">
                              <span className="text-amber-400 text-sm font-semibold">
                                รวม {((item.amount_top || 0) + (item.amount_bottom || 0) + (item.amount_tod || 0)).toLocaleString()} บาท
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    
                    {/* Summary */}
                    <div className="mt-4 pt-4 border-t border-slate-600">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-gray-400">รวมทั้งสิ้น</span>
                        <span className="text-2xl font-bold text-amber-400">
                          {totals.total.toLocaleString()} บาท
                        </span>
                      </div>
                      <Button
                        className={`w-full font-semibold py-6 transition-all ${
                          isClosed 
                            ? 'bg-gray-600 cursor-not-allowed'
                            : betItems.length === 0 || totals.total <= 0
                              ? 'bg-slate-600 cursor-not-allowed'
                              : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 hover:scale-[1.02] active:scale-[0.98]'
                        } text-white`}
                        onClick={submitBet}
                        disabled={isSubmitting || isClosed}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            กำลังส่งโพย...
                          </>
                        ) : isClosed ? (
                          <>
                            <Lock className="w-5 h-5 mr-2" />
                            ปิดรับแทง
                          </>
                        ) : betItems.length === 0 ? (
                          <>
                            <ShoppingCart className="w-5 h-5 mr-2" />
                            เพิ่มเลขก่อนส่งโพย
                          </>
                        ) : totals.total <= 0 ? (
                          <>
                            <AlertCircle className="w-5 h-5 mr-2" />
                            กรุณาใส่ราคา
                          </>
                        ) : (
                          <>
                            <Send className="w-5 h-5 mr-2" />
                            ส่งโพย ({totals.total.toLocaleString()} บาท)
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-400 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              ยืนยันการส่งโพย
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">หวย</span>
                <span className="text-white">{lottery.name}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">จำนวนรายการ</span>
                <span className="text-white">{totals.count} รายการ</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">ยอดรวม</span>
                <span className="text-amber-400 font-semibold">{totals.total.toLocaleString()} บาท</span>
              </div>
              <div className="border-t border-slate-600 mt-3 pt-3">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400">เครดิตก่อนแทง</span>
                  <span className="text-white">{(customer?.credit_balance || 0).toLocaleString()} บาท</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">เครดิตหลังแทง</span>
                  <span className="text-emerald-400 font-semibold">
                    {((customer?.credit_balance || 0) - totals.total).toLocaleString()} บาท
                  </span>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-400 text-center">
              สามารถยกเลิกโพยได้ภายใน 30 นาที
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-slate-600 text-gray-300"
              onClick={() => setShowConfirmDialog(false)}
            >
              ยกเลิก
            </Button>
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-500 text-white min-w-[120px]"
              onClick={confirmSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  กำลังส่ง...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  ยืนยันส่งโพย
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
