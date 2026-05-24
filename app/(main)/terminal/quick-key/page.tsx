'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
  Zap, Send, Trash2, RotateCcw, Clock, 
  ChevronUp, ChevronDown, AlertTriangle, Check,
  Keyboard, Hash, DollarSign, ListPlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// 19 Doors configuration (หวยยี่กี)
const DOORS = Array.from({ length: 19 }, (_, i) => ({
  id: i + 1,
  name: `ประตู ${i + 1}`,
  shortName: `ป.${i + 1}`,
}));

// Bet types
const BET_TYPES = [
  { id: 'top3', name: '3 ตัวบน', digits: 3, rate: 900 },
  { id: 'bottom3', name: '3 ตัวล่าง', digits: 3, rate: 450 },
  { id: 'tood3', name: '3 ตัวโต๊ด', digits: 3, rate: 150 },
  { id: 'top2', name: '2 ตัวบน', digits: 2, rate: 90 },
  { id: 'bottom2', name: '2 ตัวล่าง', digits: 2, rate: 90 },
  { id: 'run_top', name: 'วิ่งบน', digits: 1, rate: 3.2 },
  { id: 'run_bottom', name: 'วิ่งล่าง', digits: 1, rate: 4.2 },
  { id: 'front', name: 'หน้า', digits: 2, rate: 90 },
  { id: 'back', name: 'หลัง', digits: 2, rate: 90 },
];

interface BetEntry {
  id: string;
  number: string;
  betType: string;
  amount: number;
  door?: number;
  timestamp: number;
}

interface QuickKeyState {
  currentNumber: string;
  currentAmount: string;
  selectedBetType: string;
  selectedDoor: number | null;
  entries: BetEntry[];
  swipeMode: 'front' | 'back' | null;
}

export default function QuickKeyBettingTerminal() {
  const [state, setState] = useState<QuickKeyState>({
    currentNumber: '',
    currentAmount: '1',
    selectedBetType: 'top2',
    selectedDoor: null,
    entries: [],
    swipeMode: null,
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentSubmissions, setRecentSubmissions] = useState<string[]>([]);
  const numberInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Focus number input on mount
  useEffect(() => {
    numberInputRef.current?.focus();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter to add entry
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addEntry();
      }
      // Shift+Enter to submit all
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        submitAll();
      }
      // Tab to switch between number and amount
      if (e.key === 'Tab') {
        e.preventDefault();
        if (document.activeElement === numberInputRef.current) {
          amountInputRef.current?.focus();
          amountInputRef.current?.select();
        } else {
          numberInputRef.current?.focus();
          numberInputRef.current?.select();
        }
      }
      // F1-F7 for bet types
      if (e.key >= 'F1' && e.key <= 'F9') {
        e.preventDefault();
        const index = parseInt(e.key.replace('F', '')) - 1;
        if (BET_TYPES[index]) {
          setState(s => ({ ...s, selectedBetType: BET_TYPES[index].id }));
        }
      }
      // Escape to clear
      if (e.key === 'Escape') {
        setState(s => ({ ...s, currentNumber: '', swipeMode: null }));
        numberInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state]);

  // Add entry to list
  const addEntry = useCallback(() => {
    const { currentNumber, currentAmount, selectedBetType, selectedDoor, swipeMode } = state;
    
    if (!currentNumber || !currentAmount) return;

    const betType = BET_TYPES.find(b => b.id === selectedBetType);
    if (!betType) return;

    // Validate number length
    if (currentNumber.length !== betType.digits) {
      return;
    }

    const amount = parseFloat(currentAmount);
    if (isNaN(amount) || amount <= 0) return;

    // Handle swipe mode (front/back)
    if (swipeMode) {
      const numbers = generateSwipeNumbers(currentNumber, swipeMode);
      const newEntries = numbers.map(num => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        number: num,
        betType: selectedBetType,
        amount,
        door: selectedDoor || undefined,
        timestamp: Date.now(),
      }));
      
      setState(s => ({
        ...s,
        entries: [...s.entries, ...newEntries],
        currentNumber: '',
        swipeMode: null,
      }));
    } else {
      const newEntry: BetEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        number: currentNumber,
        betType: selectedBetType,
        amount,
        door: selectedDoor || undefined,
        timestamp: Date.now(),
      };

      setState(s => ({
        ...s,
        entries: [...s.entries, newEntry],
        currentNumber: '',
      }));
    }

    numberInputRef.current?.focus();
  }, [state]);

  // Generate swipe numbers (front = 19 combinations, back = 19 combinations)
  const generateSwipeNumbers = (baseNumber: string, mode: 'front' | 'back'): string[] => {
    const numbers: string[] = [];
    
    if (mode === 'front' && baseNumber.length === 2) {
      // Front swipe: XX -> 0XX, 1XX, 2XX, ..., 9XX
      for (let i = 0; i <= 9; i++) {
        numbers.push(`${i}${baseNumber}`);
      }
    } else if (mode === 'back' && baseNumber.length === 2) {
      // Back swipe: XX -> XX0, XX1, XX2, ..., XX9
      for (let i = 0; i <= 9; i++) {
        numbers.push(`${baseNumber}${i}`);
      }
    } else if (baseNumber.length === 1) {
      // Single digit swipe
      for (let i = 0; i <= 9; i++) {
        numbers.push(mode === 'front' ? `${i}${baseNumber}` : `${baseNumber}${i}`);
      }
    }
    
    return numbers;
  };

  // Remove entry
  const removeEntry = useCallback((id: string) => {
    setState(s => ({
      ...s,
      entries: s.entries.filter(e => e.id !== id),
    }));
  }, []);

  // Clear all entries
  const clearAll = useCallback(() => {
    setState(s => ({
      ...s,
      entries: [],
      currentNumber: '',
    }));
    numberInputRef.current?.focus();
  }, []);

  // Submit all entries
  const submitAll = useCallback(async () => {
    if (state.entries.length === 0) return;
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/entries/quick-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: state.entries,
          door: state.selectedDoor,
        }),
      });

      if (response.ok) {
        const submitted = state.entries.map(e => e.number);
        setRecentSubmissions(prev => [...submitted, ...prev].slice(0, 20));
        setState(s => ({ ...s, entries: [] }));
      }
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setIsSubmitting(false);
      numberInputRef.current?.focus();
    }
  }, [state.entries, state.selectedDoor]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalAmount = state.entries.reduce((sum, e) => sum + e.amount, 0);
    const totalEntries = state.entries.length;
    return { totalAmount, totalEntries };
  }, [state.entries]);

  // Quick amount buttons
  const QUICK_AMOUNTS = [1, 5, 10, 20, 50, 100, 500, 1000];

  return (
    <div className="min-h-screen live-midnight-canvas p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] flex items-center justify-center">
              <Zap className="size-5 text-[#0F172A]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#F5E1A4]">Quick-Key Terminal</h1>
              <p className="text-sm text-[#64748B]">High-Speed Betting Input</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#64748B]">
            <Keyboard className="size-4" />
            <span>F1-F9: ประเภท | Enter: เพิ่ม | Shift+Enter: ส่งทั้งหมด</span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          {/* Main Input Area */}
          <div className="lg:col-span-8 space-y-4">
            {/* Bet Type Selection */}
            <div className="ultra-glass-card p-4">
              <div className="flex items-center gap-2 mb-3 text-[#94A3B8]">
                <Hash className="size-4" />
                <span className="text-sm font-medium">ประเภทแทง</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
                {BET_TYPES.map((type, idx) => (
                  <button
                    key={type.id}
                    onClick={() => setState(s => ({ ...s, selectedBetType: type.id }))}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                      state.selectedBetType === type.id
                        ? 'bg-gradient-to-r from-[#EAB308] to-[#B8860B] text-[#0F172A]'
                        : 'bg-[#1E293B] text-[#94A3B8] hover:bg-[#334155] hover:text-[#F5E1A4]'
                    )}
                  >
                    <div className="text-xs opacity-60">F{idx + 1}</div>
                    {type.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Number & Amount Input */}
            <div className="ultra-glass-card p-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Number Input */}
                <div>
                  <label className="flex items-center gap-2 text-sm text-[#94A3B8] mb-2">
                    <Hash className="size-4" />
                    เลข ({BET_TYPES.find(b => b.id === state.selectedBetType)?.digits} หลัก)
                  </label>
                  <Input
                    ref={numberInputRef}
                    value={state.currentNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      const maxDigits = BET_TYPES.find(b => b.id === state.selectedBetType)?.digits || 3;
                      setState(s => ({ ...s, currentNumber: value.slice(0, maxDigits) }));
                    }}
                    placeholder="กรอกเลข..."
                    className="h-16 text-3xl font-mono text-center bg-[#0F172A] border-[#334155] text-[#FDE047] placeholder:text-[#475569]"
                    autoComplete="off"
                  />
                  {/* Swipe Mode Buttons */}
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setState(s => ({ ...s, swipeMode: s.swipeMode === 'front' ? null : 'front' }))}
                      className={cn(
                        'flex-1 border-[#334155]',
                        state.swipeMode === 'front' && 'bg-[#EAB308] text-[#0F172A] border-[#EAB308]'
                      )}
                    >
                      <ChevronUp className="size-4 mr-1" />
                      รูดหน้า
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setState(s => ({ ...s, swipeMode: s.swipeMode === 'back' ? null : 'back' }))}
                      className={cn(
                        'flex-1 border-[#334155]',
                        state.swipeMode === 'back' && 'bg-[#EAB308] text-[#0F172A] border-[#EAB308]'
                      )}
                    >
                      <ChevronDown className="size-4 mr-1" />
                      รูดหลัง
                    </Button>
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="flex items-center gap-2 text-sm text-[#94A3B8] mb-2">
                    <DollarSign className="size-4" />
                    จำนวนเงิน
                  </label>
                  <Input
                    ref={amountInputRef}
                    value={state.currentAmount}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d.]/g, '');
                      setState(s => ({ ...s, currentAmount: value }));
                    }}
                    placeholder="จำนวนเงิน..."
                    className="h-16 text-3xl font-mono text-center bg-[#0F172A] border-[#334155] text-[#22C55E] placeholder:text-[#475569]"
                  />
                  {/* Quick Amount Buttons */}
                  <div className="grid grid-cols-4 gap-1 mt-2">
                    {QUICK_AMOUNTS.map(amt => (
                      <Button
                        key={amt}
                        variant="outline"
                        size="sm"
                        onClick={() => setState(s => ({ ...s, currentAmount: amt.toString() }))}
                        className="border-[#334155] text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#22C55E]"
                      >
                        {amt}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Add Button */}
              <Button
                onClick={addEntry}
                className="w-full mt-4 h-12 bg-gradient-to-r from-[#EAB308] to-[#B8860B] hover:from-[#FDE047] hover:to-[#EAB308] text-[#0F172A] font-bold text-lg"
              >
                <ListPlus className="size-5 mr-2" />
                เพิ่มรายการ (Enter)
                {state.swipeMode && (
                  <span className="ml-2 px-2 py-0.5 bg-[#0F172A]/20 rounded text-sm">
                    รูด{state.swipeMode === 'front' ? 'หน้า' : 'หลัง'} x10
                  </span>
                )}
              </Button>
            </div>

            {/* 19 Doors Selection */}
            <div className="ultra-glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-[#94A3B8]">เลือกประตู (หวยยี่กี)</span>
                {state.selectedDoor && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setState(s => ({ ...s, selectedDoor: null }))}
                    className="text-[#64748B] hover:text-[#F5E1A4]"
                  >
                    ยกเลิก
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-10 gap-1">
                {DOORS.map(door => (
                  <button
                    key={door.id}
                    onClick={() => setState(s => ({ ...s, selectedDoor: door.id }))}
                    className={cn(
                      'aspect-square rounded-lg text-sm font-bold transition-all',
                      state.selectedDoor === door.id
                        ? 'bg-gradient-to-br from-[#EAB308] to-[#B8860B] text-[#0F172A] shadow-lg shadow-[#EAB308]/30'
                        : 'bg-[#1E293B] text-[#64748B] hover:bg-[#334155] hover:text-[#F5E1A4]'
                    )}
                  >
                    {door.id}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Entries List & Actions */}
          <div className="lg:col-span-4 space-y-4">
            {/* Summary */}
            <div className="ultra-glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#94A3B8]">รายการทั้งหมด</span>
                <span className="text-2xl font-bold text-[#F5E1A4]">{totals.totalEntries}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#94A3B8]">ยอดรวม</span>
                <span className="text-2xl font-bold text-[#22C55E]">{totals.totalAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Entries List */}
            <div className="ultra-glass-card p-4 max-h-[400px] overflow-y-auto">
              {state.entries.length === 0 ? (
                <div className="text-center py-8 text-[#64748B]">
                  <ListPlus className="size-8 mx-auto mb-2 opacity-50" />
                  <p>ยังไม่มีรายการ</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {state.entries.map((entry, idx) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-2 bg-[#1E293B] rounded-lg group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#64748B] w-6">{idx + 1}</span>
                        <span className="font-mono text-lg text-[#FDE047]">{entry.number}</span>
                        <span className="text-xs text-[#64748B]">
                          {BET_TYPES.find(b => b.id === entry.betType)?.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#22C55E] font-medium">{entry.amount}</span>
                        <button
                          onClick={() => removeEntry(entry.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-[#EF4444] hover:bg-[#EF4444]/20 rounded transition-all"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                onClick={submitAll}
                disabled={state.entries.length === 0 || isSubmitting}
                className="w-full h-14 bg-gradient-to-r from-[#22C55E] to-[#16A34A] hover:from-[#4ADE80] hover:to-[#22C55E] text-white font-bold text-lg disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    กำลังส่ง...
                  </>
                ) : (
                  <>
                    <Send className="size-5 mr-2" />
                    ส่งทั้งหมด (Shift+Enter)
                  </>
                )}
              </Button>
              <Button
                onClick={clearAll}
                variant="outline"
                className="w-full border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444]/10"
              >
                <Trash2 className="size-4 mr-2" />
                ล้างทั้งหมด
              </Button>
            </div>

            {/* Recent Submissions */}
            {recentSubmissions.length > 0 && (
              <div className="ultra-glass-card p-4">
                <div className="flex items-center gap-2 text-sm text-[#64748B] mb-2">
                  <Clock className="size-4" />
                  ส่งล่าสุด
                </div>
                <div className="flex flex-wrap gap-1">
                  {recentSubmissions.slice(0, 10).map((num, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-[#22C55E]/20 text-[#22C55E] rounded text-sm font-mono"
                    >
                      {num}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
