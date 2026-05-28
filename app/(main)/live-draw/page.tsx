'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Play, 
  Square, 
  CheckCircle, 
  RotateCw, 
  Tv,
  Trophy,
  Loader2,
  Plus,
  Sparkles,
  Crown,
} from 'lucide-react';
import useSWR, { mutate } from 'swr';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Lottery {
  id: string;
  name: string;
  icon: string;
  result_time: string;
}

interface LiveDrawSession {
  id: string;
  lottery_id: string;
  draw_date: string;
  status: 'pending' | 'spinning' | 'stopped' | 'completed';
  top_result: string | null;
  bottom_result: string | null;
  spinning_started_at: string | null;
  stopped_at: string | null;
  lottery: Lottery;
}

// Premium 3D Ball Component - Ruby Red with Glossy Effect
function LottoBall3D({ 
  digit, 
  isSpinning, 
  delay = 0,
  size = 'large',
  showResult = false,
}: { 
  digit: string;
  isSpinning: boolean; 
  delay?: number;
  size?: 'large' | 'medium';
  showResult?: boolean;
}) {
  const [currentDigit, setCurrentDigit] = useState(digit || '0');
  const [isBouncing, setIsBouncing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (isSpinning) {
      // Start spinning after delay
      const startTimeout = setTimeout(() => {
        intervalRef.current = setInterval(() => {
          setCurrentDigit(Math.floor(Math.random() * 10).toString());
        }, 60);
      }, delay);
      
      return () => {
        clearTimeout(startTimeout);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      // Stop and show final digit with bounce
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (digit) {
        setCurrentDigit(digit);
        if (showResult) {
          setIsBouncing(true);
          setTimeout(() => setIsBouncing(false), 600);
        }
      }
    }
  }, [isSpinning, digit, delay, showResult]);

  const sizeClasses = size === 'large' 
    ? 'w-16 h-16 text-3xl md:w-20 md:h-20 md:text-4xl lg:w-24 lg:h-24 lg:text-5xl'
    : 'w-14 h-14 text-2xl md:w-16 md:h-16 md:text-3xl lg:w-20 lg:h-20 lg:text-4xl';

  return (
    <div 
      className={cn(
        sizeClasses,
        "relative flex items-center justify-center rounded-full font-bold transition-all duration-300",
        // 3D Ball Effect - Ruby Red
        "bg-gradient-to-br from-red-500 via-red-600 to-red-800",
        // Glossy shine effect
        "before:absolute before:inset-[3px] before:rounded-full",
        "before:bg-gradient-to-br before:from-white/40 before:via-transparent before:to-transparent",
        "before:pointer-events-none",
        // Inner shadow for depth
        "shadow-[inset_0_-8px_20px_rgba(0,0,0,0.4),inset_0_8px_20px_rgba(255,255,255,0.2)]",
        // Outer glow and shadow
        "shadow-red-500/40",
        // Spinning animation
        isSpinning && "animate-spin-slow shadow-[0_0_30px_rgba(239,68,68,0.6)]",
        // Bounce animation when result shows
        isBouncing && "animate-bounce-ball scale-110",
        // Result glow
        showResult && !isSpinning && "shadow-[0_0_40px_rgba(239,68,68,0.5),0_8px_32px_rgba(0,0,0,0.4)]"
      )}
      style={{
        // Additional 3D depth
        transform: isSpinning ? undefined : 'perspective(200px) rotateX(5deg)',
        boxShadow: showResult && !isSpinning 
          ? '0 0 40px rgba(239,68,68,0.5), 0 8px 32px rgba(0,0,0,0.4), inset 0 -8px 20px rgba(0,0,0,0.4), inset 0 8px 20px rgba(255,255,255,0.2)'
          : undefined
      }}
    >
      {/* Number - Pure White */}
      <span 
        className="relative z-10 text-white font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
        style={{
          textShadow: '0 2px 4px rgba(0,0,0,0.5), 0 0 20px rgba(255,255,255,0.3)'
        }}
      >
        {currentDigit}
      </span>
      
      {/* Highlight spot */}
      <div className="absolute top-2 left-3 w-4 h-3 md:w-5 md:h-4 lg:w-6 lg:h-5 rounded-full bg-gradient-to-br from-white/60 to-transparent blur-[2px]" />
    </div>
  );
}

// Live Result Display with 3D Balls
function LiveResultDisplay({ 
  session, 
  isSpinning,
  topResult,
  bottomResult,
}: { 
  session: LiveDrawSession | null;
  isSpinning: boolean;
  topResult: string;
  bottomResult: string;
}) {
  const sixDigits = topResult.padEnd(6, '0').split('');
  const twoDigits = bottomResult.padEnd(2, '0').split('');

  return (
    <div className="space-y-10">
      {/* 6 Digits - First Prize */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Crown className="size-6 text-amber-400" />
          <h3 
            className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
            style={{ textShadow: '0 0 20px rgba(255,215,0,0.3)' }}
          >
            รางวัลที่ 1
          </h3>
          <Crown className="size-6 text-amber-400" />
        </div>
        <p className="text-slate-400 text-sm mb-4">(6 หลัก)</p>
        
        {/* 6 Balls Row */}
        <div className="flex justify-center gap-2 md:gap-3 lg:gap-4">
          {sixDigits.map((digit, i) => (
            <LottoBall3D 
              key={`top-${i}`}
              digit={digit}
              isSpinning={isSpinning}
              delay={i * 100}
              size="large"
              showResult={!isSpinning && !!topResult}
            />
          ))}
        </div>
        
        {/* Derived Results */}
        {!isSpinning && topResult && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <div className="px-4 py-2 rounded-full bg-black/40 backdrop-blur-sm border border-amber-500/30">
              <span className="text-slate-400 text-sm">3 ตัวบน: </span>
              <span className="font-mono font-bold text-amber-400 text-lg">{topResult.slice(-3)}</span>
            </div>
            <div className="px-4 py-2 rounded-full bg-black/40 backdrop-blur-sm border border-amber-500/30">
              <span className="text-slate-400 text-sm">2 ตัวบน: </span>
              <span className="font-mono font-bold text-amber-400 text-lg">{topResult.slice(-2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
        <Sparkles className="size-5 text-amber-500" />
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
      </div>

      {/* 2 Digits Bottom */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Trophy className="size-5 text-amber-400" />
          <h3 className="text-lg md:text-xl font-bold text-slate-300">2 ตัวล่าง</h3>
          <Trophy className="size-5 text-amber-400" />
        </div>
        
        {/* 2 Balls Row */}
        <div className="flex justify-center gap-3 md:gap-4">
          {twoDigits.map((digit, i) => (
            <LottoBall3D 
              key={`bot-${i}`}
              digit={digit}
              isSpinning={isSpinning}
              delay={i * 100 + 600}
              size="medium"
              showResult={!isSpinning && !!bottomResult}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LiveDrawPage() {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedLotteryId, setSelectedLotteryId] = useState<string>('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [topResult, setTopResult] = useState('');
  const [bottomResult, setBottomResult] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Fetch lotteries
  const { data: lotteries = [] } = useSWR<Lottery[]>('/api/lotteries', fetcher);

  // Fetch live draw sessions
  const { data: sessions = [], isLoading } = useSWR<LiveDrawSession[]>(
    `/api/live-draw?date=${selectedDate}`,
    fetcher,
    { refreshInterval: isSpinning ? 1000 : 5000 }
  );

  // Current active session
  const activeSession = sessions.find(s => s.lottery_id === selectedLotteryId);

  // Update local state when session changes
  useEffect(() => {
    if (activeSession) {
      setTopResult(activeSession.top_result || '');
      setBottomResult(activeSession.bottom_result || '');
      setIsSpinning(activeSession.status === 'spinning');
    }
  }, [activeSession]);

  // Create new session
  const createSession = async () => {
    if (!selectedLotteryId) {
      toast.error('กรุณาเลือกหวย');
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/live-draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lottery_id: selectedLotteryId,
          draw_date: selectedDate,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success('สร้างรอบออกผลสำเร็จ');
      mutate(`/api/live-draw?date=${selectedDate}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsCreating(false);
    }
  };

  // Start spinning
  const startSpinning = async () => {
    if (!activeSession) return;

    try {
      await fetch('/api/live-draw', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeSession.id,
          action: 'start_spinning',
        }),
      });

      setIsSpinning(true);
      toast.success('เริ่มหมุนแล้ว');
      mutate(`/api/live-draw?date=${selectedDate}`);
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  // Stop and save result
  const stopAndSave = async () => {
    if (!activeSession) return;

    if (!topResult || topResult.length !== 6) {
      toast.error('กรุณากรอกเลข 6 หลักบน');
      return;
    }
    if (!bottomResult || bottomResult.length !== 2) {
      toast.error('กรุณากรอกเลข 2 หลักล่าง');
      return;
    }

    try {
      await fetch('/api/live-draw', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeSession.id,
          action: 'stop',
          top_result: topResult,
          bottom_result: bottomResult,
        }),
      });

      setIsSpinning(false);
      toast.success('บันทึกผลสำเร็จ');
      mutate(`/api/live-draw?date=${selectedDate}`);
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  // Complete and process winners
  const completeSession = async () => {
    if (!activeSession) return;

    try {
      await fetch('/api/live-draw', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeSession.id,
          action: 'complete',
        }),
      });

      toast.success('ยืนยันผลและบันทึกลง lottery_results สำเร็จ');
      mutate(`/api/live-draw?date=${selectedDate}`);
      // Also mutate shared result endpoints so other pages auto-refresh
      mutate('/api/lottery-results?limit=10');
      mutate('/api/results?limit=20');
      mutate(`/api/results?lottery_id=${activeSession.lottery_id}&date=${selectedDate}`);
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-slate-600 text-white">รอออกผล</Badge>;
      case 'spinning':
        return <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black animate-pulse">กำลังหมุน</Badge>;
      case 'stopped':
        return <Badge className="bg-blue-500 text-white">หยุดแล้ว</Badge>;
      case 'completed':
        return <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 text-white">เสร็จสิ้น</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] -m-6 p-6">
      {/* Ambient Background Glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 
              className="text-2xl md:text-3xl font-bold flex items-center gap-3"
              style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
            >
              <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-lg shadow-amber-500/30">
                <Tv className="size-6 text-black" />
              </div>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300">
                ถ่ายทอดสดออกผล
              </span>
            </h1>
            <p className="text-slate-400 mt-1">ระบบออกผลหวยแบบ Live - Premium Experience</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-44 bg-black/40 border-amber-500/30 text-white"
            />
            <Select value={selectedLotteryId} onValueChange={setSelectedLotteryId}>
              <SelectTrigger className="w-52 bg-black/40 border-amber-500/30 text-white">
                <SelectValue placeholder="เลือกหวย" />
              </SelectTrigger>
              <SelectContent className="bg-[#0f172a] border-amber-500/30">
                {lotteries.map((l) => (
                  <SelectItem key={l.id} value={l.id} className="text-white hover:bg-amber-500/20">
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Display */}
          <div className="lg:col-span-2 space-y-6">
            {/* Live Result Display - Premium Card */}
            <div className="relative p-8 rounded-3xl backdrop-blur-xl bg-black/50 border border-amber-500/30 shadow-[0_0_60px_rgba(255,215,0,0.1)]">
              {/* Top shine */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
              
              <div className="text-center pb-6">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Sparkles className="size-5 text-amber-400" />
                  <h2 className="text-xl font-bold text-white">
                    {activeSession?.lottery?.name || 'เลือกหวย'}
                  </h2>
                  {activeSession && getStatusBadge(activeSession.status)}
                </div>
                <p className="text-sm text-slate-400">
                  วันที่ {new Date(selectedDate).toLocaleDateString('th-TH', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
              
              {activeSession ? (
                <LiveResultDisplay 
                  session={activeSession}
                  isSpinning={isSpinning}
                  topResult={topResult}
                  bottomResult={bottomResult}
                />
              ) : (
                <div className="text-center py-16">
                  <div className="size-20 mx-auto rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center border border-amber-500/30 mb-4">
                    <Tv className="size-10 text-amber-500/50" />
                  </div>
                  <p className="text-slate-400 mb-4">
                    {selectedLotteryId 
                      ? 'ยังไม่มีรอบออกผลสำหรับหวยนี้'
                      : 'กรุณาเลือกหวยที่ต้องการออกผล'}
                  </p>
                  {selectedLotteryId && !activeSession && (
                    <Button 
                      onClick={createSession} 
                      disabled={isCreating}
                      className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold shadow-lg shadow-amber-500/30"
                    >
                      {isCreating ? (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="size-4 mr-2" />
                      )}
                      สร้างรอบออกผล
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Control Panel - Premium Midnight Gold */}
            {activeSession && activeSession.status !== 'completed' && (
              <div className="relative p-6 rounded-2xl backdrop-blur-xl bg-black/50 border border-amber-500/30">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
                
                <h3 className="text-lg font-bold text-amber-400 mb-6 flex items-center gap-2">
                  <Sparkles className="size-5" />
                  แผงควบคุม
                </h3>
                
                <div className="space-y-6">
                  {/* Result Input */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <Label className="mb-2 block text-slate-300">เลข 6 หลักบน (รางวัลที่ 1)</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="123456"
                        value={topResult}
                        onChange={(e) => setTopResult(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="font-mono text-2xl text-center h-14 bg-black/40 border-amber-500/30 text-amber-400"
                        maxLength={6}
                        disabled={activeSession.status === 'stopped'}
                      />
                    </div>
                    <div>
                      <Label className="mb-2 block text-slate-300">เลข 2 หลักล่าง</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="12"
                        value={bottomResult}
                        onChange={(e) => setBottomResult(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        className="font-mono text-2xl text-center h-14 bg-black/40 border-amber-500/30 text-amber-400"
                        maxLength={2}
                        disabled={activeSession.status === 'stopped'}
                      />
                    </div>
                  </div>

                  {/* Derived Results Preview */}
                  {topResult.length >= 3 && (
                    <div className="p-4 rounded-xl bg-black/40 border border-slate-700">
                      <p className="text-sm text-slate-400 mb-3">ผลที่จะได้:</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-amber-500/20 border-amber-500/40 text-amber-300">
                          3 ตัวบน: <span className="font-mono ml-1">{topResult.slice(-3)}</span>
                        </Badge>
                        <Badge className="bg-amber-500/20 border-amber-500/40 text-amber-300">
                          2 ตัวบน: <span className="font-mono ml-1">{topResult.slice(-2)}</span>
                        </Badge>
                        <Badge className="bg-amber-500/20 border-amber-500/40 text-amber-300">
                          วิ่งบน: <span className="font-mono ml-1">{topResult.slice(-1)}</span>
                        </Badge>
                        {bottomResult.length >= 2 && (
                          <>
                            <Badge className="bg-emerald-500/20 border-emerald-500/40 text-emerald-300">
                              2 ตัวล่าง: <span className="font-mono ml-1">{bottomResult}</span>
                            </Badge>
                            <Badge className="bg-emerald-500/20 border-emerald-500/40 text-emerald-300">
                              วิ่งล่าง: <span className="font-mono ml-1">{bottomResult.slice(-1)}</span>
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Control Buttons - 3D Metallic */}
                  <div className="flex flex-wrap gap-3">
                    {activeSession.status === 'pending' && (
                      <Button 
                        onClick={startSpinning} 
                        className="gap-2 px-6 py-3 bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/30"
                        style={{
                          boxShadow: '0 4px 15px rgba(16,185,129,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
                        }}
                      >
                        <Play className="size-5" />
                        เริ่มหมุน
                      </Button>
                    )}
                    
                    {activeSession.status === 'spinning' && (
                      <Button 
                        onClick={stopAndSave} 
                        className="gap-2 px-6 py-3 bg-gradient-to-b from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 text-white font-bold shadow-lg shadow-red-500/30"
                        style={{
                          boxShadow: '0 4px 15px rgba(239,68,68,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
                        }}
                      >
                        <Square className="size-5" />
                        หยุดและบันทึก
                      </Button>
                    )}
                    
                    {activeSession.status === 'stopped' && (
                      <>
                        <Button 
                          onClick={startSpinning} 
                          className="gap-2 px-6 py-3 bg-gradient-to-b from-slate-600 to-slate-800 hover:from-slate-500 hover:to-slate-700 text-white font-bold border border-slate-500"
                        >
                          <RotateCw className="size-5" />
                          หมุนใหม่
                        </Button>
                        <Button 
                          onClick={completeSession} 
                          className="gap-2 px-6 py-3 bg-gradient-to-b from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-black font-bold shadow-lg shadow-amber-500/30"
                          style={{
                            boxShadow: '0 4px 15px rgba(245,158,11,0.4), inset 0 1px 0 rgba(255,255,255,0.3)'
                          }}
                        >
                          <CheckCircle className="size-5" />
                          ยืนยันผลและบันทึก
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sessions List - Sidebar */}
          <div className="space-y-4">
            <div className="relative p-6 rounded-2xl backdrop-blur-xl bg-black/50 border border-amber-500/30">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
              
              <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                <Trophy className="size-5 text-amber-400" />
                รอบออกผลวันนี้
              </h3>
              
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-amber-500" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-center text-slate-400 py-8">
                  ยังไม่มีรอบออกผล
                </p>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div 
                      key={session.id}
                      className={cn(
                        "p-4 rounded-xl border cursor-pointer transition-all duration-300",
                        selectedLotteryId === session.lottery_id
                          ? "border-amber-500 bg-amber-500/10 shadow-[0_0_20px_rgba(255,215,0,0.2)]"
                          : "border-slate-700 hover:border-amber-500/50 bg-black/30"
                      )}
                      onClick={() => setSelectedLotteryId(session.lottery_id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-white">{session.lottery?.name}</span>
                        {getStatusBadge(session.status)}
                      </div>
                      {session.status === 'completed' && session.top_result && (
                        <div className="text-sm space-y-1">
                          <p className="font-mono">
                            <span className="text-slate-400">6 หลัก:</span>{' '}
                            <span className="text-amber-400 font-bold">{session.top_result}</span>
                          </p>
                          <p className="font-mono">
                            <span className="text-slate-400">2 ล่าง:</span>{' '}
                            <span className="text-amber-400 font-bold">{session.bottom_result}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
