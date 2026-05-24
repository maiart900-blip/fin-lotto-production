'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Radio, Trophy, Clock, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json()).then(data => Array.isArray(data) ? data : []);

interface LiveSession {
  id: string;
  lottery_id: string;
  draw_date: string;
  status: 'pending' | 'spinning' | 'stopped' | 'completed';
  top_result: string | null;
  bottom_result: string | null;
  spinning_started_at: string | null;
  stopped_at: string | null;
  lottery?: {
    id: string;
    name: string;
    icon: string;
    result_time: string;
  };
}

// Spinning digit component for customer view
function SpinningDigit({ 
  finalDigit, 
  isSpinning, 
  delay = 0,
  size = 'large'
}: { 
  finalDigit: string | null; 
  isSpinning: boolean; 
  delay?: number;
  size?: 'large' | 'medium';
}) {
  const [currentDigit, setCurrentDigit] = useState('0');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (isSpinning) {
      const startTimeout = setTimeout(() => {
        intervalRef.current = setInterval(() => {
          setCurrentDigit(Math.floor(Math.random() * 10).toString());
        }, 50);
      }, delay);
      
      return () => {
        clearTimeout(startTimeout);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (finalDigit !== null) {
        setCurrentDigit(finalDigit);
      }
    }
  }, [isSpinning, finalDigit, delay]);

  const sizeClasses = size === 'large' 
    ? 'w-12 h-14 text-2xl sm:w-14 sm:h-16 sm:text-3xl'
    : 'w-10 h-12 text-xl sm:w-12 sm:h-14 sm:text-2xl';

  return (
    <div className={`${sizeClasses} flex items-center justify-center font-mono font-bold rounded-lg border-2 ${
      isSpinning 
        ? 'border-amber-500 bg-amber-500/20 text-amber-400 animate-pulse' 
        : finalDigit !== null 
        ? 'border-yellow-500 bg-gradient-to-b from-yellow-500/30 to-yellow-600/30 text-yellow-400 shadow-lg shadow-yellow-500/20' 
        : 'border-white/20 bg-white/5 text-white/40'
    }`}>
      {currentDigit}
    </div>
  );
}

// Live result display for customer
function LiveResultDisplay({ 
  session,
}: { 
  session: LiveSession;
}) {
  const isSpinning = session.status === 'spinning';
  const topResult = session.top_result || '';
  const bottomResult = session.bottom_result || '';
  
  const sixDigits = (topResult || '000000').padEnd(6, '0').split('');
  const twoDigits = (bottomResult || '00').padEnd(2, '0').split('');

  return (
    <div className="space-y-6">
      {/* 6 ตัวบน */}
      <div className="text-center">
        <p className="text-white/60 text-sm mb-3">รางวัลที่ 1 (6 หลัก)</p>
        <div className="flex justify-center gap-1.5 sm:gap-2">
          {sixDigits.map((digit, i) => (
            <SpinningDigit 
              key={`top-${i}`}
              finalDigit={!isSpinning && topResult ? digit : null}
              isSpinning={isSpinning}
              delay={i * 100}
              size="large"
            />
          ))}
        </div>
        {!isSpinning && topResult && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
              3 ตัวบน: <span className="font-mono font-bold ml-1">{topResult.slice(-3)}</span>
            </Badge>
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
              2 ตัวบน: <span className="font-mono font-bold ml-1">{topResult.slice(-2)}</span>
            </Badge>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-white/10" />

      {/* 2 ตัวล่าง */}
      <div className="text-center">
        <p className="text-white/60 text-sm mb-3">2 ตัวล่าง</p>
        <div className="flex justify-center gap-2">
          {twoDigits.map((digit, i) => (
            <SpinningDigit 
              key={`bot-${i}`}
              finalDigit={!isSpinning && bottomResult ? digit : null}
              isSpinning={isSpinning}
              delay={i * 100 + 600}
              size="medium"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LivePage() {
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];
  
  // Fetch live sessions with auto-refresh
  const { data: sessions = [], isLoading, mutate } = useSWR<LiveSession[]>(
    `/api/live-draw?date=${today}`,
    fetcher,
    { 
      refreshInterval: 2000, // Refresh every 2 seconds for realtime feel
      revalidateOnFocus: true,
    }
  );

  // Filter sessions by status
  const activeSessions = sessions.filter(s => s.status === 'spinning' || s.status === 'stopped');
  const pendingSessions = sessions.filter(s => s.status === 'pending');
  const completedSessions = sessions.filter(s => s.status === 'completed');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">รอออกผล</Badge>;
      case 'spinning':
        return <Badge className="bg-red-500 text-white animate-pulse">LIVE</Badge>;
      case 'stopped':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">รอยืนยัน</Badge>;
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">ออกผลแล้ว</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0F1C]">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#1a1f35] to-[#0A0F1C] border-b border-white/10 sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => router.back()}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <h1 className="text-lg font-semibold text-white">ถ่ายทอดสด</h1>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => mutate()}
            className="text-white hover:bg-white/10"
          >
            <RefreshCw className="size-5" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-24">
        {/* Banner */}
        <div className="bg-gradient-to-r from-red-600 to-pink-600 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Radio className="size-10" />
              {activeSessions.length > 0 && (
                <span className="absolute -top-1 -right-1 size-3 bg-white rounded-full animate-pulse" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold">ถ่ายทอดสดผลหวย</h2>
              <p className="text-white/80 text-sm">
                {activeSessions.length > 0 
                  ? `กำลังออกผล ${activeSessions.length} รายการ`
                  : 'รับชมการออกรางวัลแบบเรียลไทม์'}
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-amber-400 mb-4" />
            <p className="text-white/60">กำลังโหลด...</p>
          </div>
        ) : (
          <>
            {/* Active / Spinning Sessions */}
            {activeSessions.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <span className="size-2 bg-red-500 rounded-full animate-pulse" />
                  กำลังออกผลสด
                </h3>
                {activeSessions.map((session) => (
                  <Card key={session.id} className="bg-[#0D1321] border-red-500/30 overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="size-5 text-amber-400" />
                          <span className="font-bold text-white">{session.lottery?.name || 'หวย'}</span>
                        </div>
                        {getStatusBadge(session.status)}
                      </div>
                      <LiveResultDisplay session={session} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Pending Sessions */}
            {pendingSessions.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Clock className="size-4 text-blue-400" />
                  รอออกผล
                </h3>
                {pendingSessions.map((session) => (
                  <Card key={session.id} className="bg-[#0D1321] border-white/10">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-white">{session.lottery?.name || 'หวย'}</p>
                          <p className="text-sm text-white/60">
                            วันที่ {new Date(session.draw_date).toLocaleDateString('th-TH')}
                          </p>
                        </div>
                        {getStatusBadge(session.status)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Completed Sessions */}
            {completedSessions.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Trophy className="size-4 text-green-400" />
                  ผลรางวัลวันนี้
                </h3>
                {completedSessions.map((session) => (
                  <Card key={session.id} className="bg-[#0D1321] border-green-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-white">{session.lottery?.name || 'หวย'}</span>
                        {getStatusBadge(session.status)}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 rounded-lg p-3 text-center">
                          <p className="text-xs text-white/60 mb-1">รางวัลที่ 1</p>
                          <p className="text-xl font-mono font-bold text-amber-400">
                            {session.top_result || '-'}
                          </p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3 text-center">
                          <p className="text-xs text-white/60 mb-1">2 ตัวล่าง</p>
                          <p className="text-xl font-mono font-bold text-amber-400">
                            {session.bottom_result || '-'}
                          </p>
                        </div>
                      </div>
                      {session.top_result && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline" className="border-white/20 text-white/80">
                            3 ตัวบน: <span className="font-mono ml-1">{session.top_result.slice(-3)}</span>
                          </Badge>
                          <Badge variant="outline" className="border-white/20 text-white/80">
                            2 ตัวบน: <span className="font-mono ml-1">{session.top_result.slice(-2)}</span>
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Empty State */}
            {sessions.length === 0 && (
              <Card className="bg-[#0D1321] border-white/10">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Radio className="size-16 text-white/20 mb-4" />
                  <p className="text-white/60">ไม่มีการถ่ายทอดสดในขณะนี้</p>
                  <p className="text-xs text-white/40 mt-1">กรุณาตรวจสอบกำหนดการออกรางวัล</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
