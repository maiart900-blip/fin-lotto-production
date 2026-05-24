'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Trash2,
  Save,
  Loader2,
  Zap,
  Clock,
  Wallet,
  Delete,
  RotateCcw,
  Plus,
  Hand,
  LayoutGrid,
  Target,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface Lottery {
  id: string;
  name: string;
  close_time?: string;
  flag_emoji?: string;
}

interface BetEntry {
  id: string;
  number: string;
  betType: string;
  amount: number;
}

// Props
interface BettingTerminalProps {
  lottery: Lottery;
  entries: BetEntry[];
  setEntries: React.Dispatch<React.SetStateAction<BetEntry[]>>;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  blockedNumbers: string[];
  walletBalance: number;
  isUnlimitedCredit: boolean;
  onSmartPaste?: (input: string) => void;
}

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

// Bet type definitions with colors - grouped by color
const BET_TYPES = {
  red: [
    { id: '3top', label: '3 ตัวบน', rate: 900, digits: 3 },
    { id: '3tod', label: '3 ตัวโต๊ด', rate: 150, digits: 3 },
    { id: '3front', label: '3 ตัวหน้า', rate: 450, digits: 3 },
    { id: '3back', label: '3 ตัวล่าง', rate: 450, digits: 3 },
  ],
  blue: [
    { id: '2top', label: '2 ตัวบน', rate: 90, digits: 2 },
    { id: '2bot', label: '2 ตัวล่าง', rate: 90, digits: 2 },
    { id: '3flip', label: '3 ตัวกลับ', rate: 150, digits: 3 },
    { id: '2flip', label: '2 ตัวกลับ', rate: 90, digits: 2 },
  ],
  green: [
    { id: 'run_top', label: 'วิ่งบน', rate: 3.2, digits: 1 },
    { id: 'run_bot', label: 'วิ่งล่าง', rate: 4.2, digits: 1 },
  ],
};

const ALL_BET_TYPES = [...BET_TYPES.red, ...BET_TYPES.blue, ...BET_TYPES.green];

// Mode definitions
const MODES = [
  { id: 'manual', label: 'กดเลขเอง', icon: Hand, color: 'bg-green-500 hover:bg-green-600' },
  { id: 'panel', label: 'เลือกจากแผง', icon: LayoutGrid, color: 'bg-blue-500 hover:bg-blue-600' },
  { id: 'win', label: 'จับวิน', icon: Target, color: 'bg-purple-500 hover:bg-purple-600' },
];

export function BettingTerminal({
  lottery,
  entries,
  setEntries,
  onBack,
  onSubmit,
  isSubmitting,
  blockedNumbers,
  walletBalance,
  isUnlimitedCredit,
  onSmartPaste,
}: BettingTerminalProps) {
  // State
  const [selectedBetTypes, setSelectedBetTypes] = useState<string[]>([]);
  const [inputNumber, setInputNumber] = useState('');
  const [inputAmount, setInputAmount] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pasteInput, setPasteInput] = useState('');
  const [showPasteMode, setShowPasteMode] = useState(false);
  const [activeMode, setActiveMode] = useState('manual');

  // Update time every second for countdown
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate countdown
  const countdown = useMemo(() => {
    if (!lottery.close_time) return null;
    const [hours, minutes] = lottery.close_time.split(':').map(Number);
    const closeDate = new Date();
    closeDate.setHours(hours, minutes, 0, 0);
    
    const diff = closeDate.getTime() - currentTime.getTime();
    if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, isExpired: true };
    
    return {
      hours: Math.floor(diff / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
      isExpired: false,
    };
  }, [lottery.close_time, currentTime]);

  // Total amount
  const totalAmount = useMemo(() => entries.reduce((sum, e) => sum + e.amount, 0), [entries]);

  // Get max digits from selected types
  const maxDigits = useMemo(() => {
    if (selectedBetTypes.length === 0) return 3;
    const types = selectedBetTypes.map(id => ALL_BET_TYPES.find(t => t.id === id));
    const digitCounts = types.filter(Boolean).map(t => t!.digits);
    // If mixed digits, use the largest
    return Math.max(...digitCounts);
  }, [selectedBetTypes]);

  // Toggle bet type selection
  const toggleBetType = useCallback((typeId: string) => {
    setSelectedBetTypes(prev => {
      if (prev.includes(typeId)) {
        return prev.filter(id => id !== typeId);
      } else {
        return [...prev, typeId];
      }
    });
    setInputNumber('');
  }, []);

  // Handle keypad press
  const handleKeyPress = useCallback((key: string) => {
    if (key === 'del') {
      setInputNumber(prev => prev.slice(0, -1));
    } else if (key === 'clear') {
      setInputNumber('');
    } else if (inputNumber.length < maxDigits) {
      setInputNumber(prev => prev + key);
    }
  }, [inputNumber.length, maxDigits]);

  // Add entry for all selected bet types
  const addEntry = useCallback(() => {
    if (selectedBetTypes.length === 0) {
      toast.error('กรุณาเลือกประเภทการแทงอย่างน้อย 1 ประเภท');
      return;
    }
    if (!inputAmount || Number(inputAmount) <= 0) {
      toast.error('กรุณากรอกจำนวนเงิน');
      return;
    }

    // Check blocked numbers
    if (blockedNumbers.includes(inputNumber)) {
      toast.error(`เลข ${inputNumber} เป็นเลขอั้น ไม่สามารถแทงได้`);
      return;
    }

    // Add entries for each selected bet type
    const newEntries: BetEntry[] = [];
    let hasError = false;

    selectedBetTypes.forEach(typeId => {
      const type = ALL_BET_TYPES.find(t => t.id === typeId);
      if (!type) return;

      // Validate digit count for this type
      if (inputNumber.length !== type.digits) {
        toast.error(`${type.label} ต้องการเลข ${type.digits} หลัก`);
        hasError = true;
        return;
      }

      newEntries.push({
        id: generateId(),
        number: inputNumber,
        betType: typeId,
        amount: Number(inputAmount),
      });
    });

    if (hasError) return;

    setEntries(prev => [...prev, ...newEntries]);
    setInputNumber('');
    
    const typeNames = selectedBetTypes.map(id => ALL_BET_TYPES.find(t => t.id === id)?.label).join(', ');
    toast.success(`เพิ่ม ${inputNumber} (${typeNames}) ฿${inputAmount} x ${selectedBetTypes.length}`);
  }, [selectedBetTypes, inputNumber, inputAmount, blockedNumbers, setEntries]);

  // Remove entry
  const removeEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  }, [setEntries]);

  // Handle smart paste
  const handleSmartPaste = useCallback(() => {
    if (onSmartPaste && pasteInput.trim()) {
      onSmartPaste(pasteInput);
      setPasteInput('');
      setShowPasteMode(false);
    }
  }, [pasteInput, onSmartPaste]);

  // Select all types in a color group
  const selectColorGroup = useCallback((group: 'red' | 'blue' | 'green') => {
    const groupTypes = BET_TYPES[group].map(t => t.id);
    setSelectedBetTypes(prev => {
      const hasAll = groupTypes.every(id => prev.includes(id));
      if (hasAll) {
        return prev.filter(id => !groupTypes.includes(id));
      } else {
        return [...new Set([...prev, ...groupTypes])];
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Top Header - Gold Bar with Timer */}
      <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 p-4 shadow-lg">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="text-black hover:bg-black/10 rounded-full">
              <ArrowLeft className="size-6" />
            </Button>
            <div>
              <h1 className="text-black font-bold text-xl flex items-center gap-2">
                {lottery.flag_emoji && <span className="text-2xl">{lottery.flag_emoji}</span>}
                {lottery.name}
              </h1>
              <p className="text-black/70 text-sm">
                งวดวันที่ {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          
          {/* Large Countdown Timer */}
          {countdown && !countdown.isExpired && (
            <div className="bg-black/20 backdrop-blur-sm px-6 py-3 rounded-2xl">
              <p className="text-black/80 text-xs text-center mb-1">
                <Clock className="inline size-3 mr-1" />
                ปิดรับอีก
              </p>
              <div className="flex gap-1 items-center">
                <div className="bg-black text-amber-400 px-3 py-2 rounded-lg font-mono font-bold text-2xl">
                  {String(countdown.hours).padStart(2, '0')}
                </div>
                <span className="text-black text-2xl font-bold">:</span>
                <div className="bg-black text-amber-400 px-3 py-2 rounded-lg font-mono font-bold text-2xl">
                  {String(countdown.minutes).padStart(2, '0')}
                </div>
                <span className="text-black text-2xl font-bold">:</span>
                <div className="bg-black text-amber-400 px-3 py-2 rounded-lg font-mono font-bold text-2xl">
                  {String(countdown.seconds).padStart(2, '0')}
                </div>
              </div>
            </div>
          )}

          {/* Wallet */}
          <div className="flex items-center gap-2 bg-black/20 px-4 py-2 rounded-xl">
            <Wallet className="size-5 text-black" />
            <span className="text-black font-bold text-lg">
              {isUnlimitedCredit ? 'Unlimited' : `฿${walletBalance.toLocaleString()}`}
            </span>
          </div>
        </div>
      </div>

      {/* Mode Selection Tabs */}
      <div className="bg-slate-800/50 border-b border-slate-700 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-3 justify-center">
            {MODES.map(mode => (
              <Button
                key={mode.id}
                onClick={() => setActiveMode(mode.id)}
                className={cn(
                  'flex-1 max-w-[200px] h-14 text-white font-bold text-lg transition-all',
                  activeMode === mode.id 
                    ? `${mode.color} ring-2 ring-white ring-offset-2 ring-offset-slate-800`
                    : 'bg-slate-700 hover:bg-slate-600'
                )}
              >
                <mode.icon className="size-5 mr-2" />
                {mode.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-12 gap-4">
          {/* Left Side - Entry List (New Compact Format) */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="bg-slate-800/80 border-amber-500/30 shadow-xl">
              <CardHeader className="pb-2 border-b border-slate-700">
                <CardTitle className="text-amber-400 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    # รายการโพย
                    <Badge className="bg-amber-500 text-black font-bold text-xs">{entries.length} รายการ</Badge>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                {/* Total Amount Display */}
                <div className="mb-3">
                  <p className="text-amber-400 text-3xl font-bold">฿{totalAmount.toLocaleString()}</p>
                  <p className="text-gray-500 text-xs">ยอดรวมทั้งหมด</p>
                </div>

                <ScrollArea className="h-[280px]">
                  {entries.length === 0 ? (
                    <div className="text-gray-500 text-center py-8">
                      <LayoutGrid className="size-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">ยังไม่มีรายการ</p>
                      <p className="text-xs mt-1">พิมพ์เลขบนคีย์บอร์ดได้เลย</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Group entries by bet type category */}
                      {(() => {
                        // Group entries by bet type
                        const grouped: Record<string, { entries: typeof entries; topAmount: number; botAmount: number }> = {};
                        
                        entries.forEach(entry => {
                          const type = ALL_BET_TYPES.find(t => t.id === entry.betType);
                          if (!type) return;
                          
                          // Determine category
                          let category = '';
                          if (entry.betType.includes('3')) category = '3 ตัว';
                          else if (entry.betType.includes('2')) category = '2 ตัว';
                          else if (entry.betType.includes('run')) category = 'วิ่ง';
                          else category = 'อื่นๆ';
                          
                          if (!grouped[category]) {
                            grouped[category] = { entries: [], topAmount: 0, botAmount: 0 };
                          }
                          grouped[category].entries.push(entry);
                          
                          // Calculate top/bottom amounts
                          if (entry.betType.includes('top') || entry.betType === '3top') {
                            grouped[category].topAmount = entry.amount;
                          }
                          if (entry.betType.includes('bot') || entry.betType === '2bot' || entry.betType === '3back') {
                            grouped[category].botAmount = entry.amount;
                          }
                        });

                        return Object.entries(grouped).map(([category, data]) => {
                          // Get unique numbers for this category
                          const uniqueNumbers = [...new Set(data.entries.map(e => e.number))];
                          
                          // Determine bet type labels
                          const betTypes = [...new Set(data.entries.map(e => {
                            const type = ALL_BET_TYPES.find(t => t.id === e.betType);
                            return type?.label.replace(/[0-9] ตัว/g, '').trim() || '';
                          }))].filter(Boolean);
                          
                          const betTypeLabel = betTypes.join(' x ') || 'บน x ล่าง';
                          const amountLabel = data.topAmount > 0 && data.botAmount > 0 
                            ? `${data.topAmount} x ${data.botAmount}`
                            : data.topAmount > 0 
                              ? `${data.topAmount}`
                              : data.botAmount > 0 
                                ? `${data.botAmount}`
                                : data.entries[0]?.amount || 0;

                          return (
                            <div key={category} className="bg-white rounded-lg p-2 text-black">
                              <div className="flex justify-between items-start mb-1">
                                <div>
                                  <p className="text-xs text-gray-600">{category}</p>
                                  <p className="text-xs text-gray-500">{betTypeLabel}</p>
                                  <p className="text-sm font-bold">{amountLabel}</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {uniqueNumbers.map((num, idx) => (
                                  <span key={idx} className="text-sm font-mono">{num}</span>
                                ))}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </ScrollArea>

                {/* Quick Actions */}
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
                    onClick={() => setEntries([])}
                    disabled={entries.length === 0}
                  >
                    <Trash2 className="size-4 mr-1" />
                    ล้างทั้งหมด
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button
              onClick={onSubmit}
              disabled={entries.length === 0 || isSubmitting}
              className="w-full h-14 text-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold shadow-xl"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-5 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Check className="size-5 mr-2" />
                  ส่งโพย
                </>
              )}
            </Button>
          </div>

          {/* Middle - Bet Types Selection */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="bg-slate-800/80 border-slate-700 shadow-xl">
              <CardHeader className="pb-2 border-b border-slate-700">
                <CardTitle className="text-white flex items-center justify-between">
                  <span>เลือกประเภทการแทง</span>
                  <span className="text-sm text-gray-400">
                    (กดพร้อมกันได้หลายประเภท)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Red Group - 3 Digits */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-red-400 text-sm font-semibold">3 ตัว (สีแดง)</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => selectColorGroup('red')}
                      className="text-red-400 text-xs h-6"
                    >
                      เลือกทั้งหมด
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {BET_TYPES.red.map(type => (
                      <Button
                        key={type.id}
                        onClick={() => toggleBetType(type.id)}
                        className={cn(
                          'h-16 text-white font-semibold transition-all relative',
                          selectedBetTypes.includes(type.id) 
                            ? 'bg-red-600 ring-2 ring-white' 
                            : 'bg-red-500/70 hover:bg-red-500'
                        )}
                      >
                        {selectedBetTypes.includes(type.id) && (
                          <Check className="absolute top-2 right-2 size-4" />
                        )}
                        <div className="text-center">
                          <p className="text-base">{type.label}</p>
                          <p className="text-xs opacity-80">จ่าย {type.rate}</p>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Blue Group - 2 Digits */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-blue-400 text-sm font-semibold">2 ตัว & กลับ (สีฟ้า)</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => selectColorGroup('blue')}
                      className="text-blue-400 text-xs h-6"
                    >
                      เลือกทั้งหมด
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {BET_TYPES.blue.map(type => (
                      <Button
                        key={type.id}
                        onClick={() => toggleBetType(type.id)}
                        className={cn(
                          'h-16 text-white font-semibold transition-all relative',
                          selectedBetTypes.includes(type.id) 
                            ? 'bg-blue-600 ring-2 ring-white' 
                            : 'bg-blue-500/70 hover:bg-blue-500'
                        )}
                      >
                        {selectedBetTypes.includes(type.id) && (
                          <Check className="absolute top-2 right-2 size-4" />
                        )}
                        <div className="text-center">
                          <p className="text-base">{type.label}</p>
                          <p className="text-xs opacity-80">จ่าย {type.rate}</p>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Green Group - Run */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-green-400 text-sm font-semibold">วิ่ง (สีเขียว)</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => selectColorGroup('green')}
                      className="text-green-400 text-xs h-6"
                    >
                      เลือกทั้งหมด
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {BET_TYPES.green.map(type => (
                      <Button
                        key={type.id}
                        onClick={() => toggleBetType(type.id)}
                        className={cn(
                          'h-16 text-white font-semibold transition-all relative',
                          selectedBetTypes.includes(type.id) 
                            ? 'bg-green-600 ring-2 ring-white' 
                            : 'bg-green-500/70 hover:bg-green-500'
                        )}
                      >
                        {selectedBetTypes.includes(type.id) && (
                          <Check className="absolute top-2 right-2 size-4" />
                        )}
                        <div className="text-center">
                          <p className="text-base">{type.label}</p>
                          <p className="text-xs opacity-80">จ่าย x{type.rate}</p>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Selected Types Summary */}
                {selectedBetTypes.length > 0 && (
                  <div className="pt-3 border-t border-slate-700">
                    <p className="text-sm text-gray-400 mb-2">ประเภทที่เลือก:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedBetTypes.map(id => {
                        const type = ALL_BET_TYPES.find(t => t.id === id);
                        const colorClass = BET_TYPES.red.some(t => t.id === id) ? 'bg-red-500' :
                                          BET_TYPES.blue.some(t => t.id === id) ? 'bg-blue-500' :
                                          'bg-green-500';
                        return (
                          <Badge key={id} className={cn(colorClass, 'text-white')}>
                            {type?.label}
                            <button 
                              onClick={() => toggleBetType(id)}
                              className="ml-1 hover:text-red-200"
                            >
                              &times;
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right - Number Input & Keypad */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="bg-slate-800/80 border-slate-700 shadow-xl">
              <CardHeader className="pb-2 border-b border-slate-700">
                <CardTitle className="text-white text-center">ระบุตัวเลข</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {/* Number Display Boxes */}
                <div className="flex justify-center gap-3 mb-4">
                  {Array.from({ length: maxDigits }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-20 h-24 rounded-xl border-2 bg-slate-900 flex items-center justify-center transition-all',
                        inputNumber[i] ? 'border-amber-500' : 'border-slate-600'
                      )}
                    >
                      <span className={cn(
                        'text-5xl font-mono font-bold',
                        inputNumber[i] ? 'text-amber-400' : 'text-slate-600'
                      )}>
                        {inputNumber[i] || '_'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Amount Input */}
                <div className="mb-4">
                  <p className="text-gray-400 text-sm mb-2 text-center">ใส่ราคา</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={inputAmount}
                      onChange={(e) => setInputAmount(e.target.value.replace(/\D/g, ''))}
                      className="flex-1 h-14 text-center text-2xl font-bold bg-white text-black border-amber-500"
                    />
                    <span className="text-amber-400 font-bold text-lg">บาท</span>
                  </div>
                </div>

                {/* Quick Amount Buttons */}
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {[10, 20, 50, 100, 500].map(amt => (
                    <Button
                      key={amt}
                      variant="outline"
                      size="sm"
                      onClick={() => setInputAmount(String(amt))}
                      className={cn(
                        'border-slate-600 text-gray-300 hover:bg-slate-700 hover:text-white',
                        inputAmount === String(amt) && 'bg-amber-500 text-black border-amber-500'
                      )}
                    >
                      {amt}
                    </Button>
                  ))}
                </div>

                {/* Number Keypad */}
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'].map(key => (
                    <Button
                      key={key}
                      onClick={() => handleKeyPress(key)}
                      disabled={selectedBetTypes.length === 0}
                      className={cn(
                        'h-16 text-2xl font-bold transition-all',
                        key === 'clear' ? 'bg-orange-500 hover:bg-orange-600 text-white' :
                        key === 'del' ? 'bg-red-500 hover:bg-red-600 text-white' :
                        'bg-slate-700 hover:bg-slate-600 text-white active:bg-amber-500 active:text-black'
                      )}
                    >
                      {key === 'clear' ? <RotateCcw className="size-6" /> :
                       key === 'del' ? <Delete className="size-6" /> :
                       key}
                    </Button>
                  ))}
                </div>

                {/* Add Button */}
                <Button
                  onClick={addEntry}
                  disabled={selectedBetTypes.length === 0 || inputNumber.length === 0 || !inputAmount}
                  className="w-full h-16 mt-4 text-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-bold shadow-lg"
                >
                  <Plus className="size-6 mr-2" />
                  เพิ่มรายการ
                  {selectedBetTypes.length > 1 && (
                    <Badge className="ml-2 bg-black/20 text-black">x{selectedBetTypes.length}</Badge>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
