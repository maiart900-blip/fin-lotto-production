'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Trash2, 
  Keyboard, 
  X, 
  Send, 
  Clock,
  Crown,
  Zap,
  Grid3X3,
  Hash,
  Trophy,
  RotateCcw,
  Copy,
  Plus,
  AlertCircle,
  Loader2,
  CheckCircle,
  Gift,
  DollarSign,
  User,
  Calendar,
  FileText,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    return null;
  }
  return res.json();
}).catch(() => {
  return null;
});

// Types
interface BetItem {
  id: string;
  number: string;
  betType: string;
  amount: number;
}

interface Lottery {
  id: string;
  name: string;
  closeTime: string;
  isOpen: boolean;
}



// Bet type definitions
const BET_TYPES_2 = [
  { id: '2top', label: '2 ตัวบน', shortLabel: '2บน' },
  { id: '2bot', label: '2 ตัวล่าง', shortLabel: '2ล่าง' },
  { id: '2rev', label: '2 ตัวกลับ', shortLabel: '2กลับ' },
  { id: '2dbl', label: '2 เบิ้ล', shortLabel: '2เบิ้ล' },
  { id: '2win', label: '2 วิน', shortLabel: '2วิน' },
];

const BET_TYPES_3 = [
  { id: '3top', label: '3 ตัวบน', shortLabel: '3บน' },
  { id: '3tod', label: '3 โต๊ด', shortLabel: '3โต๊ด' },
  { id: '3rev', label: '3 ตัวกลับ', shortLabel: '3กลับ' },
  { id: '3tong', label: '3 ตอง', shortLabel: '3ตอง' },
  { id: '3dblf', label: '3 เบิ้ลหน้า', shortLabel: '3บิ้ลน' },
  { id: '3dblb', label: '3 เบิ้ลหลัง', shortLabel: '3บิ้ลล' },
  { id: '3win', label: '3 วิน', shortLabel: '3วิน' },
];

// Bet type labels for display
const BET_TYPE_LABELS: Record<string, string> = {
  '2top': '2 บน',
  '2bot': '2 ล่าง',
  '2rev': '2 กลับ',
  '2dbl': '2 เบิ้ล',
  '2win': '2 วิน',
  '3top': '3 บน',
  '3tod': '3 โต๊ด',
  '3rev': '3 กลับ',
  '3tong': '3 ตอง',
  '3dblf': '3 บิ้ลน',
  '3dblb': '3 บิ้ลล',
  '3win': '3 วิน',
  '1top': 'วิ่งบน',
  '1bot': 'วิ่งล่าง',
};

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

// Get all permutations of a string
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

// Reverse number
const reverseNumber = (num: string): string => num.split('').reverse().join('');

// Generate all doubles (เลขเบิ้ล)
const generateDoubles = (): string[] => {
  return Array.from({ length: 10 }, (_, i) => `${i}${i}`);
};

// Generate 19 gates combinations (19 ประตู)
const generate19Gates = (digit: string): string[] => {
  const results: string[] = [];
  for (let i = 0; i < 10; i++) {
    results.push(`${digit}${i}`);
    if (i !== parseInt(digit)) {
      results.push(`${i}${digit}`);
    }
  }
  return [...new Set(results)];
};

// Generate Win numbers (วินเลข)
const generateWinNumbers = (digits: string[], mode: '2' | '3'): string[] => {
  const results: string[] = [];
  if (mode === '2') {
    for (let i = 0; i < digits.length; i++) {
      for (let j = 0; j < digits.length; j++) {
        if (i !== j) {
          results.push(`${digits[i]}${digits[j]}`);
        }
      }
    }
  } else {
    for (let i = 0; i < digits.length; i++) {
      for (let j = 0; j < digits.length; j++) {
        for (let k = 0; k < digits.length; k++) {
          if (i !== j && j !== k && i !== k) {
            results.push(`${digits[i]}${digits[j]}${digits[k]}`);
          }
        }
      }
    }
  }
  return [...new Set(results)];
};

export default function LotteryTerminalPage() {
  // Time state - must be before lotteries filtering
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  // Fetch lotteries from API - filter out closed lotteries based on time
  const { data: lotteriesData, isLoading: isLoadingLotteries, error: lotteriesError } = useSWR('/api/lotteries', fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  
  // States - must be declared before using in SWR
  const [selectedLotteryId, setSelectedLotteryId] = useState<string>('');
  const [digitMode, setDigitMode] = useState<'2' | '3'>('2');
  const [currentInput, setCurrentInput] = useState('');
  const [defaultPrice, setDefaultPrice] = useState(1);
  const [bets, setBets] = useState<BetItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showWinDialog, setShowWinDialog] = useState(false);
  const [winSelectedDigits, setWinSelectedDigits] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState('');
  
  // Prize checking states
  const [showPrizeCheck, setShowPrizeCheck] = useState(false);
  const [prizeCheckResult, setPrizeCheckResult] = useState<{
    winners: Array<{ number: string; betType: string; amount: number; payout: number }>;
    totalPayout: number;
  } | null>(null);
  
  // Multi-select bet types
  const [selectedBetTypes, setSelectedBetTypes] = useState<string[]>(['2top']);
  
  // State for expanded customer detail in history
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Fetch latest result for selected lottery
  const todayDate = new Date().toISOString().split('T')[0];
  const { data: latestResults } = useSWR(
    selectedLotteryId ? `/api/results?lottery_id=${selectedLotteryId}&date=${todayDate}` : null,
    fetcher
  );
  const latestResult = latestResults?.[0];
  
  // Fetch payout rates
  const { data: payoutRates } = useSWR('/api/payout-rates', fetcher);
  
  // Fetch saved entries (today's entries grouped by submission)
  const { data: savedEntriesData, mutate: mutateSavedEntries } = useSWR(
    `/api/entries?date=${todayDate}&with_results=true`,
    fetcher
  );
  
  // Safely process lotteries - handle null/undefined
  const lotteries: Lottery[] = useMemo(() => {
    if (!lotteriesData || !Array.isArray(lotteriesData)) {
      return [];
    }
    
    // Map all lotteries first (before filtering by time)
    const mapped = lotteriesData.map((l: any) => ({
      id: l.id,
      name: l.name,
      closeTime: l.close_time?.slice(0, 5) || '23:59',
      isOpen: l.is_active && !l.is_closed_temp,
    }));
    
    // Filter by time - only remove lotteries that have PASSED their close time
    const filtered = mapped.filter((l: Lottery) => {
      if (!l.isOpen) return false;
      
      const [hours, minutes] = l.closeTime.split(':').map(Number);
      const closeDate = new Date(currentTime);
      closeDate.setHours(hours, minutes, 0, 0);
      
      return currentTime < closeDate;
    });
    
    return filtered.sort((a: Lottery, b: Lottery) => {
      const [aH, aM] = a.closeTime.split(':').map(Number);
      const [bH, bM] = b.closeTime.split(':').map(Number);
      return (aH * 60 + aM) - (bH * 60 + bM);
    });
  }, [lotteriesData, currentTime]);
  
  // Set default lottery when loaded
  useEffect(() => {
    if (lotteries.length > 0 && !selectedLotteryId) {
      setSelectedLotteryId(lotteries[0].id);
    }
  }, [lotteries, selectedLotteryId]);
  
  // Selected lottery
  const selectedLottery = lotteries.find(l => l.id === selectedLotteryId);
  
  // Current bet types based on mode
  const currentBetTypes = digitMode === '2' ? BET_TYPES_2 : BET_TYPES_3;
  
  // Group entries by customer_name or time batch for today's history
  const groupedEntries = useMemo(() => {
    if (!savedEntriesData?.entries) return [];
    
    const groups: Record<string, {
      customer_name: string;
      customer_id: string | null;
      entries: any[];
      total_amount: number;
      total_won: number;
      lottery_names: string[];
      has_result: boolean;
      created_at: string;
    }> = {};
    
    // Sort by created_at first
    const sortedEntries = [...savedEntriesData.entries].sort((a: any, b: any) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    let currentBatchKey = '';
    let currentBatchTime: Date | null = null;
    const BATCH_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes = same batch
    
    sortedEntries.forEach((entry: any) => {
      const entryTime = new Date(entry.created_at);
      
      // Determine batch key
      let batchKey: string;
      if (entry.customer_name) {
        // If has customer name, use it as key
        batchKey = entry.customer_name;
      } else if (entry.customer_id) {
        batchKey = entry.customer_id;
      } else {
        // Group by time batch (entries within 3 minutes = same batch)
        if (!currentBatchTime || (entryTime.getTime() - currentBatchTime.getTime()) > BATCH_INTERVAL_MS) {
          // New batch
          currentBatchKey = `batch_${entryTime.toISOString()}`;
          currentBatchTime = entryTime;
        }
        batchKey = currentBatchKey;
      }
      
      if (!groups[batchKey]) {
        const timeStr = entryTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        groups[batchKey] = {
          customer_name: entry.customer_name || `โพย ${timeStr} น.`,
          customer_id: entry.customer_id,
          entries: [],
          total_amount: 0,
          total_won: 0,
          lottery_names: [],
          has_result: false,
          created_at: entry.created_at,
        };
      }
      
      groups[batchKey].entries.push(entry);
      groups[batchKey].total_amount += Number(entry.amount || 0);
      
      // Get lottery name
      const entryLottery = lotteries.find((l: Lottery) => l.id === entry.lottery_id);
      if (entryLottery?.name && !groups[batchKey].lottery_names.includes(entryLottery.name)) {
        groups[batchKey].lottery_names.push(entryLottery.name);
      }
      
      // Calculate winnings
      const entryResult = savedEntriesData.results?.find((r: any) => r.lottery_id === entry.lottery_id);
      if (entryResult?.three_top || entryResult?.two_bot) {
        groups[batchKey].has_result = true;
        const threeTop = entryResult.three_top || '';
        const twoBot = entryResult.two_bot || '';
        const twoTop = threeTop.slice(-2);
        const rates: Record<string, number> = {
          '3top': 900, '3tod': 150, '2top': 90, '2bot': 90, '1top': 3, '1bot': 4,
        };
        
        if (entry.bet_type === '2top' && entry.number === twoTop) {
          groups[batchKey].total_won += entry.amount * (rates['2top'] || 90);
        }
        if (entry.bet_type === '2bot' && entry.number === twoBot) {
          groups[batchKey].total_won += entry.amount * (rates['2bot'] || 90);
        }
        if (entry.bet_type === '3top' && entry.number === threeTop) {
          groups[batchKey].total_won += entry.amount * (rates['3top'] || 900);
        }
      }
    });
    
    return Object.values(groups);
  }, [savedEntriesData, lotteries]);
  
  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  // Reset selected bet types when digit mode changes
  useEffect(() => {
    if (digitMode === '2') {
      setSelectedBetTypes(['2top']);
    } else {
      setSelectedBetTypes(['3top']);
    }
  }, [digitMode]);
  
  // Calculate totals
  const totalAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);
  const totalItems = bets.length;
  
  // Check prizes for current bets
  const checkPrizes = useCallback(() => {
    if (!latestResult) {
      toast.error('ยังไม่มีผลหวยวันนี้');
      return;
    }
    
    if (bets.length === 0) {
      toast.error('ยังไม่มีรายการแทง');
      return;
    }
    
    const threeTop = latestResult.three_top || '';
    const twoBot = latestResult.two_bot || '';
    const twoTop = threeTop.slice(-2); // 2 ตัวบนจาก 3 ตัวบน
    
    const winners: Array<{ number: string; betType: string; amount: number; payout: number }> = [];
    
    // Default payout rates (can be customized)
    const defaultRates: Record<string, number> = {
      '3top': 900, '3tod': 150, '3rev': 450, '3tong': 900, '3dblf': 450, '3dblb': 450, '3win': 900,
      '2top': 90, '2bot': 90, '2rev': 45, '2dbl': 90, '2win': 90,
      '1top': 3, '1bot': 4,
    };
    
    const rates = payoutRates?.reduce((acc: Record<string, number>, rate: any) => {
      acc[rate.bet_type] = rate.payout_rate;
      return acc;
    }, {}) || defaultRates;
    
    bets.forEach(bet => {
      let isWinner = false;
      const betType = bet.betType;
      const number = bet.number;
      
      // Check 3 digit bets
      if (betType === '3top' && number === threeTop) isWinner = true;
      if (betType === '3tod' && getPermutations(number).includes(threeTop)) isWinner = true;
      if (betType === '3tong' && number === threeTop && number[0] === number[1] && number[1] === number[2]) isWinner = true;
      
      // Check 2 digit bets
      if (betType === '2top' && number === twoTop) isWinner = true;
      if (betType === '2bot' && number === twoBot) isWinner = true;
      if (betType === '2rev') {
        if (number === twoTop || reverseNumber(number) === twoTop) isWinner = true;
        if (number === twoBot || reverseNumber(number) === twoBot) isWinner = true;
      }
      
      // Check running numbers
      if (betType === '1top' && threeTop.includes(number)) isWinner = true;
      if (betType === '1bot' && twoBot.includes(number)) isWinner = true;
      
      if (isWinner) {
        const rate = rates[betType] || 0;
        winners.push({
          number: bet.number,
          betType: BET_TYPE_LABELS[betType] || betType,
          amount: bet.amount,
          payout: bet.amount * rate,
        });
      }
    });
    
    const totalPayout = winners.reduce((sum, w) => sum + w.payout, 0);
    
    setPrizeCheckResult({ winners, totalPayout });
    setShowPrizeCheck(true);
    
    if (winners.length > 0) {
      toast.success(`พบผู้ถูกรางวัล ${winners.length} รายการ!`);
    } else {
      toast.info('ไม่มีรายการถูกรางวัล');
    }
  }, [latestResult, bets, payoutRates]);
  
  // Toggle bet type selection
  const toggleBetType = useCallback((betTypeId: string) => {
    setSelectedBetTypes(prev => {
      if (prev.includes(betTypeId)) {
        // Don't allow deselecting if it's the only one
        if (prev.length === 1) {
          toast.error('ต้องเลือกประเภทแทงอย่างน้อย 1 ประเภท');
          return prev;
        }
        return prev.filter(id => id !== betTypeId);
      } else {
        return [...prev, betTypeId];
      }
    });
  }, []);
  
  // Expand numbers based on bet types (กลับเลข, เบิ้ล, โต๊ด, ตอง)
  const expandNumbers = useCallback((number: string, betTypes: string[]): { number: string; betType: string }[] => {
    const results: { number: string; betType: string }[] = [];
    const existingSet = new Set<string>();
    
    for (const betType of betTypes) {
      // Handle reverse (กลับเลข)
      if (betType === '2rev' || betType === '3rev') {
        const perms = getPermutations(number);
        const baseBetType = betType === '2rev' ? '2top' : '3top';
        
        // Add to both บน and ล่าง if 2rev
        if (betType === '2rev') {
          perms.forEach(perm => {
            const key1 = `${perm}-2top`;
            const key2 = `${perm}-2bot`;
            if (!existingSet.has(key1)) {
              existingSet.add(key1);
              results.push({ number: perm, betType: '2top' });
            }
            if (!existingSet.has(key2)) {
              existingSet.add(key2);
              results.push({ number: perm, betType: '2bot' });
            }
          });
        } else {
          // 3rev - add to บน only
          perms.forEach(perm => {
            const key = `${perm}-3top`;
            if (!existingSet.has(key)) {
              existingSet.add(key);
              results.push({ number: perm, betType: '3top' });
            }
          });
        }
      }
      // Handle doubles (เบิ้ล 2 ตัว)
      else if (betType === '2dbl') {
        // Only add if the number is a double
        if (number[0] === number[1]) {
          const key = `${number}-2top`;
          if (!existingSet.has(key)) {
            existingSet.add(key);
            results.push({ number, betType: '2top' });
          }
        }
      }
      // Handle 3 เบิ้ลหน้า (first two digits same)
      else if (betType === '3dblf') {
        if (number.length === 3 && number[0] === number[1]) {
          const key = `${number}-3top`;
          if (!existingSet.has(key)) {
            existingSet.add(key);
            results.push({ number, betType: '3top' });
          }
        }
      }
      // Handle 3 เบิ้ลหลัง (last two digits same)
      else if (betType === '3dblb') {
        if (number.length === 3 && number[1] === number[2]) {
          const key = `${number}-3top`;
          if (!existingSet.has(key)) {
            existingSet.add(key);
            results.push({ number, betType: '3top' });
          }
        }
      }
      // Handle ตอง (all digits same)
      else if (betType === '3tong') {
        if (number.length === 3 && number[0] === number[1] && number[1] === number[2]) {
          const key = `${number}-3top`;
          if (!existingSet.has(key)) {
            existingSet.add(key);
            results.push({ number, betType: '3top' });
          }
        }
      }
      // Handle โต๊ด (all permutations)
      else if (betType === '3tod') {
        const perms = getPermutations(number);
        perms.forEach(perm => {
          const key = `${perm}-3tod`;
          if (!existingSet.has(key)) {
            existingSet.add(key);
            results.push({ number: perm, betType: '3tod' });
          }
        });
      }
      // Handle วิน (will be handled separately in dialog)
      else if (betType === '2win' || betType === '3win') {
        // Skip - handled by Win dialog
      }
      // Normal bet types
      else {
        const key = `${number}-${betType}`;
        if (!existingSet.has(key)) {
          existingSet.add(key);
          results.push({ number, betType });
        }
      }
    }
    
    return results;
  }, []);
  
  // Add bets to list
  const addBets = useCallback((number: string) => {
    if (selectedBetTypes.length === 0) {
      toast.error('กรุณาเลือกประเภทการแทง');
      return;
    }
    
    if (!defaultPrice || defaultPrice <= 0) {
      toast.error('กรุณาใส่ราคา');
      return;
    }
    
    // Check digit length matches mode
    if (digitMode === '2' && number.length !== 2) {
      toast.error('กรุณาใส่เลข 2 หลัก');
      return;
    }
    if (digitMode === '3' && number.length !== 3) {
      toast.error('กรุณาใส่เลข 3 หลัก');
      return;
    }
    
    // Expand numbers based on selected bet types
    const expandedBets = expandNumbers(number, selectedBetTypes);
    
    if (expandedBets.length === 0) {
      // If no expansion happened (e.g., selected เบิ้ล but number is not a double)
      // Add as normal bets
      selectedBetTypes.forEach(betType => {
        if (!betType.includes('rev') && !betType.includes('dbl') && !betType.includes('tong') && !betType.includes('win')) {
          const newBet: BetItem = {
            id: generateId(),
            number,
            betType,
            amount: defaultPrice,
          };
          setBets(prev => {
            // Check for duplicates
            const exists = prev.some(b => b.number === number && b.betType === betType);
            if (exists) {
              toast.info(`${number} ${BET_TYPE_LABELS[betType]} มีในรายการแล้ว`);
              return prev;
            }
            return [...prev, newBet];
          });
        }
      });
    } else {
      // Add expanded bets
      expandedBets.forEach(({ number: num, betType }) => {
        const newBet: BetItem = {
          id: generateId(),
          number: num,
          betType,
          amount: defaultPrice,
        };
        setBets(prev => {
          // Check for duplicates
          const exists = prev.some(b => b.number === num && b.betType === betType);
          if (exists) {
            return prev;
          }
          return [...prev, newBet];
        });
      });
      
      if (expandedBets.length > 1) {
        toast.success(`เพิ่ม ${expandedBets.length} รายการ`);
      }
    }
  }, [selectedBetTypes, defaultPrice, digitMode, expandNumbers]);
  
// Handle input change with auto-submit
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cleaned = value.replace(/\D/g, '');
    const targetLength = digitMode === '3' ? 3 : 2;
    
    if (cleaned.length <= targetLength) {
      setCurrentInput(cleaned);
      
      // Auto-submit when reaching target length
      if (cleaned.length === targetLength) {
        addBets(cleaned);
        setCurrentInput('');
        inputRef.current?.focus();
      }
    }
  }, [digitMode, addBets]);
  
  // Handle numpad input (from on-screen keyboard)
  const handleNumpadInput = useCallback((key: string) => {
    const newValue = currentInput + key;
    const cleaned = newValue.replace(/\D/g, '');
    const targetLength = digitMode === '3' ? 3 : 2;
    
    if (cleaned.length <= targetLength) {
      setCurrentInput(cleaned);
      
      if (cleaned.length === targetLength) {
        addBets(cleaned);
        setCurrentInput('');
        inputRef.current?.focus();
      }
    }
  }, [currentInput, digitMode, addBets]);
  
  // Handle paste - รองรับการ paste หลายเลขพ�����อมกัน
  // รูปแบบที่รองรับ: "12 34 56", "12,34,56", "12\n34\n56", "123456" (แยกตาม digit mode)
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const cleaned = pastedText.replace(/[^\d\s,\n]/g, ''); // เก็บเฉพาะตัวเลข, space, comma, newline
    
    const targetLength = digitMode === '3' ? 3 : 2;
    let numbers: string[] = [];
    
    // ลองแยกด้วย space, comma, หรือ newline ก่อน
    const separated = cleaned.split(/[\s,\n]+/).filter(n => n.length > 0);
    
    if (separated.length > 1) {
      // ถ้าแยกได้หลายตัว ใช้แต่ละตัวที่มีความยาวถูกต้อง
      numbers = separated.filter(n => n.length === targetLength);
    } else {
      // ถ้าเป็นตัวเลขต่อกัน แยกตาม targetLength
      const allDigits = cleaned.replace(/\D/g, '');
      for (let i = 0; i < allDigits.length; i += targetLength) {
        const num = allDigits.slice(i, i + targetLength);
        if (num.length === targetLength) {
          numbers.push(num);
        }
      }
    }
    
    if (numbers.length === 0) {
      toast.error(`ไม่พบเลข ${targetLength} หลักที่ถูกต้อง`);
      return;
    }
    
    // เพิ่มทุกเลขที่ paste มา
    let addedCount = 0;
    numbers.forEach(num => {
      addBets(num);
      addedCount++;
    });
    
    toast.success(`Paste สำเร็จ ${addedCount} เลข`);
    setCurrentInput('');
    inputRef.current?.focus();
  }, [digitMode, addBets]);
  
  // Handle keyboard shortcuts (basic - ไม่รวม Win Dialog)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if Win Dialog is open (handled separately)
      if (showWinDialog) return;
      
      // Ignore if typing in other inputs (except main input)
      if (e.target !== inputRef.current && (e.target as HTMLElement).tagName === 'INPUT') {
        return;
      }
      
      // Tab to switch mode
      if (e.key === 'Tab') {
        e.preventDefault();
        setDigitMode(prev => prev === '2' ? '3' : '2');
        setCurrentInput('');
      }
      
      // Escape to clear
      if (e.key === 'Escape') {
        setCurrentInput('');
        inputRef.current?.focus();
      }
      
      // Enter to submit
      if (e.key === 'Enter' && bets.length > 0) {
        e.preventDefault();
        setShowConfirmDialog(true);
      }
      
      // Hotkeys for bet types (F1-F6 for quick toggle)
      if (e.key === 'F1') {
        e.preventDefault();
        toggleBetType(digitMode === '2' ? '2top' : '3top');
      }
      if (e.key === 'F2') {
        e.preventDefault();
        toggleBetType(digitMode === '2' ? '2bot' : '3back');
      }
      if (e.key === 'F3') {
        e.preventDefault();
        toggleBetType(digitMode === '2' ? '2rev' : '3rev');
      }
      if (e.key === 'F4' && digitMode === '3') {
        e.preventDefault();
        toggleBetType('3tod');
      }
      
      // Backspace with Ctrl to clear all
      if (e.key === 'Backspace' && e.ctrlKey) {
        e.preventDefault();
        setBets([]);
        setCurrentInput('');
        inputRef.current?.focus();
      }
      
      // + or = to increase amount
      if ((e.key === '+' || e.key === '=') && e.ctrlKey) {
        e.preventDefault();
        setDefaultPrice(prev => Math.min(prev + 1, 1000));
      }
      
      // - to decrease amount
      if (e.key === '-' && e.ctrlKey) {
        e.preventDefault();
        setDefaultPrice(prev => Math.max(prev - 1, 1));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bets.length, showWinDialog, digitMode, toggleBetType]);
  
  // Remove bet
  const removeBet = useCallback((id: string) => {
    setBets(prev => prev.filter(b => b.id !== id));
  }, []);
  
  // Clear all bets
  const clearAllBets = useCallback(() => {
    setBets([]);
    setCurrentInput('');
    inputRef.current?.focus();
  }, []);
  
  // Add doubles (เลขเบิ้ล)
  const addDoubles = useCallback(() => {
    const doubles = generateDoubles();
    doubles.forEach(num => {
      const newBet: BetItem = {
        id: generateId(),
        number: num,
        betType: '2top',
        amount: defaultPrice,
      };
      setBets(prev => {
        const exists = prev.some(b => b.number === num && b.betType === '2top');
        if (exists) return prev;
        return [...prev, newBet];
      });
    });
    toast.success('เพิ่มเลขเบิ้ล 10 รายการ');
  }, [defaultPrice]);
  
  // Add 19 gates (19 ประตู) - อัตโนมัติทั้งบนและล่าง + กลับเลข
  const add19Gates = useCallback((digit: string) => {
    const gates = generate19Gates(digit);
    const allNumbers: string[] = [];
    
    // เพิ่มเลขกลับด้วย
    gates.forEach(num => {
      allNumbers.push(num);
      const reversed = reverseNumber(num);
      if (reversed !== num && !allNumbers.includes(reversed)) {
        allNumbers.push(reversed);
      }
    });
    
    const betTypes = ['2top', '2bot']; // ทั้งบนและล่าง
    const newBets: BetItem[] = [];
    
    allNumbers.forEach(num => {
      betTypes.forEach(betType => {
        newBets.push({
          id: generateId(),
          number: num,
          betType,
          amount: defaultPrice,
        });
      });
    });
    
    setBets(prev => {
      // กรองเลขที่ซ้ำออก
      const filtered = newBets.filter(newBet => 
        !prev.some(b => b.number === newBet.number && b.betType === newBet.betType)
      );
      return [...prev, ...filtered];
    });
    
    toast.success(`เพิ่ม 19 ประตู (${digit}) - บน+ล่าง+กลับ ${newBets.length} รายการ`);
  }, [defaultPrice]);
  
  // Add reverse (กลับเลข) for all current bets
  const addReverse = useCallback(() => {
    const currentBets = [...bets];
    let added = 0;
    currentBets.forEach(bet => {
      const reversed = reverseNumber(bet.number);
      if (reversed !== bet.number) {
        const exists = bets.some(b => b.number === reversed && b.betType === bet.betType);
        if (!exists) {
          const newBet: BetItem = {
            id: generateId(),
            number: reversed,
            betType: bet.betType,
            amount: bet.amount,
          };
          setBets(prev => [...prev, newBet]);
          added++;
        }
      }
    });
    if (added > 0) {
      toast.success(`เพิ่มเลขกลับ ${added} รายการ`);
    } else {
      toast.info('ไม่มีเลขกลับที่เพิ่มได้');
    }
  }, [bets]);
  
  // Toggle Win digit selection
  const toggleWinDigit = useCallback((digit: string) => {
    setWinSelectedDigits(prev => 
      prev.includes(digit) 
        ? prev.filter(d => d !== digit)
        : [...prev, digit]
    );
  }, []);
  
  // Generate Win numbers - อัตโนมัติทั้งบน ล่าง และกลับ
  // วินเลข 2 ตัว: จับคู่ permutation + บน+ล่าง (ไม่ต้องกลับเพิ่มเพราะ permutation ครบแล้ว)
  // วินเลข 3 ตัว: จับคู่ permutation 6 กลับ + 3บน+โต๊ด
  // รองรับสูงสุด 10 ตัว (0-9)
  const generateWinAndAdd = useCallback(() => {
    if (winSelectedDigits.length < 2) {
      toast.error('กรุณาเลือกอย่างน้อย 2 ตัวเลข');
      return;
    }
    if (winSelectedDigits.length > 10) {
      toast.error('เลือกได้สูงสุด 10 ตัวเลข (0-9)');
      return;
    }
    
    // generateWinNumbers สร้าง permutation ครบแล้ว
    // 2 ตัว: เช่น [1,2,3] -> 12,13,21,23,31,32 (ครบทุกคู่)
    // 3 ตัว: เช่น [1,2,3] -> 123,132,213,231,312,321 (6 กลับครบ)
    const winNumbers = generateWinNumbers(winSelectedDigits, digitMode);
    
    // กำหนด betTypes ตาม mode
    // 2 ตัว: บน + ล่าง
    // 3 ตัว: 3บน + โต๊ด
    const betTypes = digitMode === '2' ? ['2top', '2bot'] : ['3top', '3tod'];
    const newBets: BetItem[] = [];
    
    // สร้างรายการสำหรับทุกเลขและทุก betType
    winNumbers.forEach(num => {
      betTypes.forEach(betType => {
        newBets.push({
          id: generateId(),
          number: num,
          betType,
          amount: defaultPrice,
        });
      });
    });
    
    setBets(prev => {
      const filtered = newBets.filter(newBet => 
        !prev.some(b => b.number === newBet.number && b.betType === newBet.betType)
      );
      return [...prev, ...filtered];
    });
    
    const modeText = digitMode === '2' ? 'บน+ล่าง' : '3บน+โต๊ด (6กลับ)';
    toast.success(`เพิ่มวินเลข ${winNumbers.length} เลข x ${betTypes.length} ประเภท = ${newBets.length} รายการ (${modeText})`);
    setShowWinDialog(false);
    setWinSelectedDigits([]);
  }, [winSelectedDigits, digitMode, defaultPrice]);
  
  // Keyboard shortcuts for Win Dialog
  useEffect(() => {
    if (!showWinDialog) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // กดเลข 0-9 เพื่อ toggle
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        toggleWinDigit(e.key);
        return;
      }
      // Enter เพื่อสร้างเลข
      if (e.key === 'Enter' && winSelectedDigits.length >= 2) {
        e.preventDefault();
        generateWinAndAdd();
        return;
      }
      // Escape เพื่อปิด dialog
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowWinDialog(false);
        return;
      }
      // Backspace เพื่อลบตัวสุดท้าย
      if (e.key === 'Backspace' && winSelectedDigits.length > 0) {
        e.preventDefault();
        setWinSelectedDigits(prev => prev.slice(0, -1));
        return;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showWinDialog, winSelectedDigits, toggleWinDigit, generateWinAndAdd]);
  
  // Submit bets - ส่งข้อมูลไป API จริง
  const handleSubmit = useCallback(async () => {
    if (!selectedLotteryId || bets.length === 0) {
      toast.error('กรุณาเลือกหวยและเพิ่มรายการก่อน');
      return;
    }
    
    // Require customer name for manual key entries to enable payout tracking
    if (!customerName || !customerName.trim()) {
      toast.error('กรุณาใส่ชื่อลูกค้าก่อนส่งโพย (จำเป็นสำหรับจ่ายรางวัล)');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // แปลง bets เป็น entries format
      const entries = bets.map(bet => ({
        number: bet.number,
        betType: bet.betType,
        amount: bet.amount,
      }));
      
      const response = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries,
          lotteryId: selectedLotteryId,
          customer_name: customerName.trim(), // Required: ชื่อลูกค้าสำหรับ link กับ customer record
          source_type: 'manual', // Mark as manual key entry
          // ไม่ส่ง userId - admin คีย์เข้าระบบโดยไม่ตัดเครดิต
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'เกิดข้อผิดพลาด');
      }
      
      toast.success(result.message || `ส่งโพยสำเร็จ! ${totalItems} รายการ`);
      
      setBets([]);
      setCurrentInput('');
      setCustomerName(''); // Clear customer name
      setShowConfirmDialog(false);
      inputRef.current?.focus();
      
    } catch (error: any) {
      console.error('Submit error:', error);
      toast.error(error.message || 'ไม่สามารถส่งโพยได้');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedLotteryId, bets, totalItems, customerName]);
  
  // Loading state
  if (isLoadingLotteries) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-amber-400">กำลังโหลดข้อมูลหวย...</p>
        </div>
      </div>
    );
  }
  
  // Empty state - no lotteries available (NOT an error)
  if (!isLoadingLotteries && lotteries.length === 0) {
    // Check if there's raw data but it got filtered out
    const hasRawData = lotteriesData && Array.isArray(lotteriesData) && lotteriesData.length > 0;
    
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center max-w-md p-6">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">
            {hasRawData ? 'หวยทั้งหมดปิดรับแล้ว' : 'ยังไม่มีหวยในระบบ'}
          </h2>
          <p className="text-gray-400 mb-6">
            {hasRawData 
              ? 'หวยทั้งหมดเลยเวลาปิดรับแล้ว กรุณารอหวยงวดถัดไป หรือเปิดหวยใหม่ในหน้าจัดการหวย' 
              : 'กรุณาเพิ่มหวยในหน้าจัดการหวยก่อน เพื่อเริ่มใช้งานระบบคีย์หวย'
            }
          </p>
          <div className="flex flex-col gap-3">
            <Button
              variant="default"
              onClick={() => window.location.href = '/lotteries'}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              <Keyboard className="h-4 w-4 mr-2" />
              ไปหน้าจัดการหวย
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              รีเฟรชหน้า
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white" style={{ fontFamily: 'Kanit, sans-serif' }}>
      {/* Google Font */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap');
      `}</style>
      
      {/* Header - Compact */}
      <div className="bg-gradient-to-r from-[#1a1a1a] via-[#0f0f0f] to-[#1a1a1a] border-b border-amber-900/30 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Crown className="h-5 w-5 text-amber-500" />
              <h1 className="text-lg font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-600 bg-clip-text text-transparent">
                FIN LOTTO
              </h1>
            </div>
            
            <Select value={selectedLotteryId} onValueChange={setSelectedLotteryId}>
              <SelectTrigger className="w-[200px] h-8 bg-[#1a1a1a] border-amber-900/50 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-amber-900/50">
                {lotteries.map(lottery => (
                  <SelectItem key={lottery.id} value={lottery.id} className="text-white hover:bg-amber-900/20 focus:bg-amber-900/20">
                    <div className="flex items-center gap-2">
                      <span>{lottery.name}</span>
                      <Badge variant="outline" className="text-xs text-green-400 border-green-400/50">
                        {lottery.closeTime}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">
              <Clock className="h-3.5 w-3.5" />
              <span className="font-mono text-sm font-semibold">
                {currentTime.toLocaleTimeString('th-TH')}
              </span>
            </div>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/50 px-2 py-0.5 text-xs">
              เปิดรับ
            </Badge>
          </div>
        </div>
      </div>
      
      <div className="flex h-[calc(100vh-60px)]">
        {/* Left Sidebar - Cart */}
        <div className="w-72 bg-gradient-to-b from-[#111111] to-[#0a0a0a] border-r border-amber-900/30 flex flex-col">
          {/* Sticky Header with Totals */}
          <div className="p-2 border-b border-amber-900/30 bg-[#0f0f0f] sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-amber-400">฿{totalAmount.toLocaleString()}</span>
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0">
                  {totalItems}
                </Badge>
              </div>
              {bets.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllBets}
                  className="h-6 px-2 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  ล้าง
                </Button>
              )}
            </div>
            
            {/* Customer Name Input - Compact */}
            <Input
              type="text"
              placeholder="ชื่อลูกค้า"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="mt-1.5 bg-[#0a0a0a] border-amber-900/30 text-white placeholder:text-gray-600 text-xs h-7"
            />
          </div>
          
          <ScrollArea className="flex-1 p-1.5">
            {bets.length === 0 ? (
              <div className="text-center text-gray-500 py-6">
                <Keyboard className="h-10 w-10 mx-auto mb-1.5 opacity-30" />
                <p className="text-xs">ยังไม่มีรายการ</p>
                <p className="text-[10px] mt-0.5 text-gray-600">พิมพ์เลขได้เลย</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* Group bets by digit type and bet type */}
                {(() => {
                  // Group by digit length (2 ตัว, 3 ตัว) then by bet type combination
                  const grouped: Record<string, { 
                    bets: BetItem[]; 
                    digitType: string;
                    topAmount: number; 
                    botAmount: number;
                    betTypes: string[];
                  }> = {};
                  
                  bets.forEach(bet => {
                    const digitType = bet.number.length === 2 ? '2 ตัว' : bet.number.length === 3 ? '3 ตัว' : 'วิ่ง';
                    const key = `${digitType}-${bet.amount}`;
                    
                    if (!grouped[key]) {
                      grouped[key] = { 
                        bets: [], 
                        digitType,
                        topAmount: 0, 
                        botAmount: 0,
                        betTypes: []
                      };
                    }
                    grouped[key].bets.push(bet);
                    
                    // Track bet types and amounts
                    if (!grouped[key].betTypes.includes(bet.betType)) {
                      grouped[key].betTypes.push(bet.betType);
                    }
                    if (bet.betType.includes('top') || bet.betType === '3top') {
                      grouped[key].topAmount = bet.amount;
                    }
                    if (bet.betType.includes('bot') || bet.betType === '2bot' || bet.betType === '3back') {
                      grouped[key].botAmount = bet.amount;
                    }
                  });

                  return Object.entries(grouped).map(([key, data]) => {
                    // Get unique numbers
                    const uniqueNumbers = [...new Set(data.bets.map(b => b.number))];
                    
                    // Format bet type labels
                    const betTypeLabels = data.betTypes.map(bt => {
                      if (bt === '2top' || bt === '3top') return 'บน';
                      if (bt === '2bot' || bt === '3back') return 'ล่าง';
                      if (bt === '2rev' || bt === '3rev') return 'กลับ';
                      if (bt === '2dbl') return 'เบิ้ล';
                      if (bt === '3tod') return 'โต๊ด';
                      if (bt === 'run_top') return 'วิ่งบน';
                      if (bt === 'run_bot') return 'วิ่งล่าง';
                      return BET_TYPE_LABELS[bt] || bt;
                    });
                    
                    const betTypeLabel = betTypeLabels.join(' x ');
                    const amountLabel = data.topAmount > 0 && data.botAmount > 0 
                      ? `${data.topAmount} x ${data.botAmount}`
                      : `${data.topAmount || data.botAmount || data.bets[0]?.amount || 0}`;

                    return (
                      <div key={key} className="bg-white/95 rounded px-2 py-1.5 text-black">
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] text-gray-500 shrink-0">{data.digitType}</span>
                            <span className="text-[10px] text-amber-600 shrink-0">{betTypeLabel}</span>
                            <span className="text-xs font-bold text-gray-800 shrink-0">฿{amountLabel}</span>
                          </div>
                          <span className="text-[10px] text-gray-400">{uniqueNumbers.length}x</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {uniqueNumbers.slice(0, 12).map((num, idx) => (
                            <span key={idx} className="text-xs font-mono text-gray-700 bg-gray-100 px-1 rounded">{num}</span>
                          ))}
                          {uniqueNumbers.length > 12 && (
                            <span className="text-[10px] text-gray-400">+{uniqueNumbers.length - 12}</span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </ScrollArea>
          
          {/* Prize Check Section */}
          <div className="p-3 border-t border-amber-900/30 bg-gradient-to-r from-green-900/20 to-emerald-900/20">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-green-400 flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                ตรวจรางวัล
              </h3>
              {latestResult && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                  มีผลแล้ว
                </Badge>
              )}
            </div>
            
            {latestResult ? (
              <div className="space-y-2">
                <div className="flex gap-2 text-xs">
                  <div className="flex-1 bg-[#0a0a0a] rounded-lg p-2 text-center border border-green-900/30">
                    <p className="text-gray-500 mb-1">3 ตัวบน</p>
                    <p className="text-xl font-bold text-green-400 font-mono">
                      {latestResult.three_top || '-'}
                    </p>
                  </div>
                  <div className="flex-1 bg-[#0a0a0a] rounded-lg p-2 text-center border border-blue-900/30">
                    <p className="text-gray-500 mb-1">2 ตัวล่าง</p>
                    <p className="text-xl font-bold text-blue-400 font-mono">
                      {latestResult.two_bot || '-'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={checkPrizes}
                  disabled={bets.length === 0}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white border-0"
                  size="sm"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  ตรวจโพยนี้
                </Button>
              </div>
            ) : (
              <p className="text-xs text-gray-500 text-center py-2">
                รอผลหวยออก...
              </p>
            )}
          </div>
          
          <div className="p-4 border-t border-amber-900/30 space-y-3 bg-[#0f0f0f]">
            <Button
              onClick={clearAllBets}
              variant="outline"
              disabled={bets.length === 0}
              className="w-full border-red-900/50 text-red-400 hover:bg-red-900/20 hover:border-red-500/50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              ล้างทั้งหมด
            </Button>
            <Button
              onClick={() => setShowConfirmDialog(true)}
              disabled={bets.length === 0}
              className="w-full h-14 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-600 hover:via-yellow-600 hover:to-amber-700 text-black font-bold text-lg shadow-lg shadow-amber-500/20"
            >
              <Send className="h-5 w-5 mr-2" />
              ส่งโพย
            </Button>
            <p className="text-[10px] text-center text-gray-600">
              กด Enter เพื่อส่งโพย | Esc ล้าง | Tab สลับโหมด
            </p>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1 p-3 overflow-auto bg-[#0a0a0a]">
          {/* Inline Operator Entry Row */}
          <div className="bg-gradient-to-r from-[#111111] to-[#0d0d0d] border border-amber-900/30 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Mode Toggle - Compact */}
              <div className="flex border border-amber-900/50 rounded overflow-hidden">
                <button
                  onClick={() => { setDigitMode('3'); setCurrentInput(''); }}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors ${digitMode === '3' ? 'bg-amber-500 text-black' : 'text-amber-500 hover:bg-amber-900/30'}`}
                >
                  3ตัว
                </button>
                <button
                  onClick={() => { setDigitMode('2'); setCurrentInput(''); }}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors ${digitMode === '2' ? 'bg-amber-500 text-black' : 'text-amber-500 hover:bg-amber-900/30'}`}
                >
                  2ตัว
                </button>
              </div>
              
              {/* Number Input - Prominent */}
              <Input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                value={currentInput}
                onChange={handleInputChange}
                onPaste={handlePaste}
                placeholder={digitMode === '3' ? '___' : '__'}
                className="w-24 h-10 text-2xl font-mono text-center bg-[#0a0a0a] border-2 border-amber-500/50 focus:border-amber-400 text-amber-400 placeholder:text-gray-700 rounded"
              />
              
              {/* Bet Types - Inline Toggle */}
              <div className="flex gap-1">
                {currentBetTypes.map((betType) => (
                  <button
                    key={betType.id}
                    onClick={() => toggleBetType(betType.id)}
                    className={`px-2 py-1.5 text-xs font-bold rounded transition-colors ${
                      selectedBetTypes.includes(betType.id)
                        ? 'bg-amber-500 text-black'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {betType.shortLabel}
                  </button>
                ))}
              </div>
              
              {/* Price Input */}
              <div className="flex items-center gap-1 bg-[#0a0a0a] px-2 py-1 rounded border border-gray-700">
                <span className="text-gray-500 text-xs">฿</span>
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(Math.min(10000, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-14 bg-transparent border-0 text-center text-amber-400 font-bold text-sm p-0 h-6 focus-visible:ring-0"
                />
              </div>
              
              {/* Quick Amounts */}
              <div className="flex gap-0.5">
                {[1, 5, 10, 20, 50].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setDefaultPrice(amt)}
                    className={`w-7 h-7 text-[10px] font-bold rounded ${defaultPrice === amt ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                  >
                    {amt}
                  </button>
                ))}
              </div>
              
              {/* Add Button */}
              <Button
                onClick={() => {
                  if (currentInput.length === parseInt(digitMode) && selectedBetTypes.length > 0) {
                    addBet(currentInput);
                  }
                }}
                disabled={currentInput.length !== parseInt(digitMode) || selectedBetTypes.length === 0}
                className="h-10 px-4 bg-green-600 hover:bg-green-500 text-white font-bold"
              >
                +เพิ่ม
              </Button>
            </div>
            
            {/* Keyboard Hints - Ultra Compact */}
            <div className="flex gap-2 mt-2 text-[9px] text-gray-600">
              <span>Tab=สลับ</span>
              <span>Enter=ส่ง</span>
              <span>F1=บน</span>
              <span>F2=ล่าง</span>
              <span>F3=กลับ</span>
            </div>
          </div>
          
          {/* Quick Actions - Ultra Compact Inline */}
          <div className="flex flex-wrap gap-2 mb-3 p-2 bg-[#111111] rounded border border-gray-800">
            {/* Doubles */}
            <button onClick={addDoubles} className="flex items-center gap-1.5 px-2 py-1 bg-amber-900/30 hover:bg-amber-900/50 rounded text-xs text-amber-400">
              <Copy className="h-3 w-3" /> เบิ้ล
            </button>
            
            {/* 19 Gates - Inline */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-purple-400 mr-1">19ประตู:</span>
              {[0,1,2,3,4,5,6,7,8,9].map(d => (
                <button
                  key={d}
                  onClick={() => add19Gates(String(d))}
                  className="w-5 h-5 text-[10px] font-bold rounded bg-purple-900/30 text-purple-400 hover:bg-purple-900/50"
                >
                  {d}
                </button>
              ))}
            </div>
            
            {/* Win Numbers */}
            <button onClick={() => setShowWinDialog(true)} className="flex items-center gap-1.5 px-2 py-1 bg-green-900/30 hover:bg-green-900/50 rounded text-xs text-green-400">
              <Trophy className="h-3 w-3" /> วิน
            </button>
            
            {/* Reverse */}
            <button onClick={addReverse} className="flex items-center gap-1.5 px-2 py-1 bg-blue-900/30 hover:bg-blue-900/50 rounded text-xs text-blue-400">
              <RotateCcw className="h-3 w-3" /> กลับ
            </button>
          </div>
          
          {/* Virtual Numpad for Mobile */}
          <Card className="bg-gradient-to-br from-[#111111] to-[#0d0d0d] border-amber-900/30 lg:hidden">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-xs text-gray-400 flex items-center gap-2">
                <Keyboard className="h-3 w-3" />
                แป้นพิมพ์
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-3">
                {[1,2,3,4,5,6,7,8,9,'C',0,'⌫'].map((key) => (
                  <Button
                    key={key}
                    variant="outline"
                    className={`h-16 text-2xl font-bold rounded-xl ${
                      key === 'C' 
                        ? 'border-red-900/50 text-red-400 hover:bg-red-900/20' 
                        : key === '⌫'
                        ? 'border-amber-900/50 text-amber-400 hover:bg-amber-900/20'
                        : 'border-gray-800 text-white hover:bg-gray-800 hover:border-amber-500/50'
                    }`}
                    onClick={() => {
                      if (key === 'C') {
                        setCurrentInput('');
                      } else if (key === '⌫') {
                        setCurrentInput(prev => prev.slice(0, -1));
                      } else {
                        handleNumpadInput(String(key));
                      }
                    }}
                  >
                    {key}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Saved Entries History Section */}
      <div className="mt-6">
        <Card className="bg-gradient-to-br from-[#111111] to-[#0a0a0a] border-gray-800">
          <CardHeader className="border-b border-gray-800">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-400" />
                ประวัติโพยวันนี้
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                  {groupedEntries.length} ลูกค้า
                </Badge>
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                  {savedEntriesData?.entries?.length || 0} รายการ
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {groupedEntries.length > 0 ? (
              <div className="divide-y divide-gray-800">
                {groupedEntries.map((group, idx) => (
                  <div key={group.customer_name + idx}>
                    {/* Customer Row - Clickable */}
                    <div 
                      className="p-4 hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => setExpandedCustomer(
                        expandedCustomer === group.customer_name ? null : group.customer_name
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-medium text-white">
                                {group.customer_name}
                              </span>
                              <span className="text-gray-600">|</span>
                              <span className="text-xs text-amber-400">
                                {group.lottery_names.join(', ')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">
                                {group.entries.length} รายการ
                              </span>
                              <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${
                                expandedCustomer === group.customer_name ? 'rotate-180' : ''
                              }`} />
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs text-gray-500">ยอดรวม</p>
                            <p className="text-lg font-bold text-white">
                              ฿{group.total_amount.toLocaleString()}
                            </p>
                          </div>
                          
                          <div className="text-center min-w-[80px]">
                            <Badge className={group.has_result 
                              ? 'bg-green-500/20 text-green-400 border-green-500/30'
                              : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                            }>
                              {group.has_result ? 'ออกแล้ว' : 'รอผล'}
                            </Badge>
                          </div>
                          
                          <div className="text-right min-w-[100px]">
                            <p className="text-xs text-gray-500">ถูกรางวัล</p>
                            {group.total_won > 0 ? (
                              <p className="text-lg font-bold text-green-400">
                                +฿{group.total_won.toLocaleString()}
                              </p>
                            ) : (
                              <p className="text-sm text-gray-500">-</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Expanded Detail - Show all numbers */}
                    {expandedCustomer === group.customer_name && (
                      <div className="bg-black/30 border-t border-gray-800">
                        <div className="p-4">
                          <p className="text-xs text-gray-500 mb-3">รายละเอียดเลขที่แทง:</p>
                          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                            {group.entries.map((entry: any, entryIdx: number) => {
                              // Check if this entry won
                              const entryResult = savedEntriesData.results?.find((r: any) => r.lottery_id === entry.lottery_id);
                              let isWinner = false;
                              if (entryResult?.three_top || entryResult?.two_bot) {
                                const threeTop = entryResult.three_top || '';
                                const twoBot = entryResult.two_bot || '';
                                const twoTop = threeTop.slice(-2);
                                
                                if (entry.bet_type === '2top' && entry.number === twoTop) isWinner = true;
                                if (entry.bet_type === '2bot' && entry.number === twoBot) isWinner = true;
                                if (entry.bet_type === '3top' && entry.number === threeTop) isWinner = true;
                              }
                              
                              const betTypeLabel: Record<string, string> = {
                                '2top': 'บน', '2bot': 'ล่าง', '3top': '3บน', '3tod': 'โต๊ด',
                                '1top': 'วิ่งบน', '1bot': 'วิ่งล่าง',
                              };
                              
                              return (
                                <div 
                                  key={entry.id || entryIdx}
                                  className={`p-2 rounded-lg text-center border ${
                                    isWinner 
                                      ? 'bg-green-500/20 border-green-500/50' 
                                      : 'bg-gray-800/50 border-gray-700'
                                  }`}
                                >
                                  <p className={`text-lg font-bold ${isWinner ? 'text-green-400' : 'text-white'}`}>
                                    {entry.number}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {betTypeLabel[entry.bet_type] || entry.bet_type}
                                  </p>
                                  <p className="text-xs text-amber-400">
                                    ฿{Number(entry.amount).toLocaleString()}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <FileText className="h-12 w-12 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500">ยั���ไม่มีโพยวั��นี้</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-gradient-to-br from-[#111111] to-[#0a0a0a] border-amber-900/50 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-400 flex items-center gap-2 text-xl">
              <Send className="h-5 w-5" />
              ยืนยันส่งโพย
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <div className="flex justify-between items-center p-4 bg-[#0a0a0a] rounded-xl border border-gray-800">
              <span className="text-gray-400">หวย:</span>
              <span className="font-bold text-white">{selectedLottery?.name}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-[#0a0a0a] rounded-xl border border-gray-800">
              <span className="text-gray-400">จำนวนรายการ:</span>
              <span className="font-bold text-white">{totalItems} รายการ</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 rounded-xl border border-amber-500/30">
              <span className="text-amber-400 font-medium">ยอดรวม:</span>
              <span className="font-bold text-2xl bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                ฿{totalAmount.toLocaleString()}
              </span>
            </div>
          </div>
          
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black hover:from-amber-600 hover:to-yellow-600 font-bold px-8"
            >
              {isSubmitting ? (
                <>
                  <Zap className="h-4 w-4 mr-2 animate-pulse" />
                  กำลังส่ง...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  ยืนยันส่งโพย
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Prize Check Result Dialog */}
      <Dialog open={showPrizeCheck} onOpenChange={setShowPrizeCheck}>
        <DialogContent className="bg-gradient-to-br from-[#111111] to-[#0a0a0a] border-green-900/50 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-400 flex items-center gap-2 text-xl">
              <Trophy className="h-5 w-5" />
              ผลการตรวจรางวัล
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {/* Result Summary */}
            <div className="flex gap-3">
              <div className="flex-1 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl p-4 border border-green-500/30 text-center">
                <Gift className="h-6 w-6 text-green-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-green-400">
                  {prizeCheckResult?.winners.length || 0}
                </p>
                <p className="text-xs text-gray-400">รายการถูกรางวัล</p>
              </div>
              <div className="flex-1 bg-gradient-to-br from-amber-500/20 to-yellow-500/10 rounded-xl p-4 border border-amber-500/30 text-center">
                <DollarSign className="h-6 w-6 text-amber-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-amber-400">
                  ฿{(prizeCheckResult?.totalPayout || 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">ยอดจ่ายรางวัล</p>
              </div>
            </div>
            
            {/* Winners List */}
            {prizeCheckResult?.winners && prizeCheckResult.winners.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-400">รายละเอียดผู้ถูกรางวัล:</p>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {prizeCheckResult.winners.map((winner, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between bg-[#0a0a0a] rounded-lg p-3 border border-green-900/30"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold font-mono text-white">
                            {winner.number}
                          </span>
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            {winner.betType}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">แทง ฿{winner.amount}</p>
                          <p className="text-lg font-bold text-green-400">+฿{winner.payout.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="text-center py-6">
                <AlertCircle className="h-12 w-12 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400">ไม่มีรายการถูกรางวัล</p>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowPrizeCheck(false)}
                className="flex-1 border-gray-700 text-gray-400 hover:bg-gray-800"
              >
                ปิด
              </Button>
              {prizeCheckResult?.winners && prizeCheckResult.winners.length > 0 && (
                <Button
                  onClick={() => {
                    const text = prizeCheckResult.winners.map(w => 
                      `${w.number} (${w.betType}) - แทง ฿${w.amount} ถูก ฿${w.payout.toLocaleString()}`
                    ).join('\n') + `\n\nรวมจ่าย: ฿${prizeCheckResult.totalPayout.toLocaleString()}`;
                    navigator.clipboard.writeText(text);
                    toast.success('คัดลอกแล้ว');
                  }}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white border-0"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  คัดลอก
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Win Numbers Dialog */}
      <Dialog open={showWinDialog} onOpenChange={setShowWinDialog}>
        <DialogContent className="bg-gradient-to-br from-[#111111] to-[#0a0a0a] border-green-900/50 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-green-400 flex items-center gap-2 text-xl">
              <Trophy className="h-5 w-5" />
              วินเลข
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-gray-400 mb-2">
              เลือกตัวเลขที่ต้องการ (อย่างน้อย 2 ตัว) แล้วระบบจะสร้างคู่ทั้งหมดให้
            </p>
            <p className="text-xs text-amber-500/70 mb-4">
              กดเลข 0-9 บนแป้นพิมพ์ได้เลย | Enter = สร้างเลข | Backspace = ลบตัวสุดท้าย
            </p>
            
            <div className="grid grid-cols-5 gap-3 mb-4">
              {[0,1,2,3,4,5,6,7,8,9].map(d => (
                <Button
                  key={d}
                  variant={winSelectedDigits.includes(String(d)) ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => toggleWinDigit(String(d))}
                  className={winSelectedDigits.includes(String(d))
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-black hover:from-green-600 hover:to-emerald-600 font-bold'
                    : 'border-green-900/50 text-green-400 hover:bg-green-900/20'
                  }
                >
                  {d}
                </Button>
              ))}
            </div>
            
            {winSelectedDigits.length >= 2 && (() => {
              const winNumbers = generateWinNumbers(winSelectedDigits, digitMode);
              // permutation ครบแล้ว ไม่ต้องกลับเพิ่ม
              // 2 ตัว: จับคู่ครบทุกคู่ (n*(n-1) คู่)
              // 3 ตัว: 6 กลับครบ (n*(n-1)*(n-2) permutations)
              const betTypes = digitMode === '2' ? 2 : 2; // บน+ล่าง หรือ 3บน+โต๊ด
              const totalBets = winNumbers.length * betTypes;
              const modeText = digitMode === '2' ? 'บน+ล่าง' : '3บน+โต๊ด (6กลับ)';
              return (
                <div className="text-center p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                  <p className="text-sm text-green-400">
                    เลือก {winSelectedDigits.length} ตัว → สร้าง <span className="font-bold text-lg">{winNumbers.length}</span> เลข
                    <br />
                    <span className="font-bold text-lg">{totalBets}</span> รายการ
                    <br />
                    <span className="text-xs text-gray-400">
                      ({winNumbers.length} เลข × {modeText})
                    </span>
                  </p>
                </div>
              );
            })()}
          </div>
          
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => { setShowWinDialog(false); setWinSelectedDigits([]); }}
              className="border-gray-700 text-gray-400 hover:bg-gray-800"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={generateWinAndAdd}
              disabled={winSelectedDigits.length < 2}
              className="bg-gradient-to-r from-green-500 to-emerald-500 text-black hover:from-green-600 hover:to-emerald-600 font-bold"
            >
              สร้างเลข
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
