'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Radio, Trophy, Clock, Loader2, RefreshCw, Sparkles, Crown, Tv } from 'lucide-react';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
};

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

interface LiveStreamSettings {
  is_live: boolean;
  stream_url?: string;
  stream_type?: 'youtube' | 'facebook' | 'embed' | 'custom';
}

// Luxury Spinning digit component
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
    ? 'w-12 h-16 text-2xl sm:w-14 sm:h-18 sm:text-3xl'
    : 'w-10 h-14 text-xl sm:w-12 sm:h-16 sm:text-2xl';

  return (
    <div className={`${sizeClasses} flex items-center justify-center font-mono font-bold rounded-xl border-2 transition-all duration-300 ${
      isSpinning 
        ? 'border-amber-500 bg-amber-500/20 text-amber-400 animate-pulse glow-pulse' 
        : finalDigit !== null 
        ? 'border-amber-500/50 bg-gradient-to-b from-amber-500/20 to-amber-600/10 text-amber-400 shadow-lg shadow-amber-500/20' 
        : 'border-neutral-700 bg-neutral-800/50 text-neutral-500'
    }`}>
      {currentDigit}
    </div>
  );
}

// Luxury Live result display
function LiveResultDisplay({ session }: { session: LiveSession }) {
  const isSpinning = session.status === 'spinning';
  const topResult = session.top_result || '';
  const bottomResult = session.bottom_result || '';
  
  const sixDigits = (topResult || '000000').padEnd(6, '0').split('');
  const twoDigits = (bottomResult || '00').padEnd(2, '0').split('');

  return (
    <div className="space-y-6">
      {/* 6 ตัวบน */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Crown className="w-4 h-4 text-amber-400" />
          <p className="text-amber-400/80 text-sm font-medium">รางวัลที่ 1 (6 หลัก)</p>
          <Crown className="w-4 h-4 text-amber-400" />
        </div>
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
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 px-3 py-1">
              3 ตัวบน: <span className="font-mono font-bold ml-1">{topResult.slice(-3)}</span>
            </Badge>
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 px-3 py-1">
              2 ตัวบน: <span className="font-mono font-bold ml-1">{topResult.slice(-2)}</span>
            </Badge>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-amber-500/20" />

      {/* 2 ตัวล่าง */}
      <div className="text-center">
        <p className="text-amber-400/80 text-sm mb-3 font-medium">2 ตัวล่าง</p>
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
      refreshInterval: 2000,
      revalidateOnFocus: true,
    }
  );

  // Fetch live stream settings
  const { data: streamSettings } = useSWR<LiveStreamSettings>(
    '/api/live-stream/settings',
    fetcher,
    { refreshInterval: 10000 }
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

  // Get stream embed URL
  const getStreamEmbedUrl = () => {
    if (!streamSettings?.stream_url) return null;
    
    const url = streamSettings.stream_url;
    
    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.includes('youtu.be') 
        ? url.split('/').pop() 
        : new URL(url).searchParams.get('v');
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
    }
    
    // Facebook
    if (url.includes('facebook.com')) {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true`;
    }
    
    return url;
  };

  return (
    <div className="min-h-screen bg-black premium-bg-pattern">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-red-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-40 right-0 w-[300px] h-[300px] bg-amber-600/3 rounded-full blur-[80px]" />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-amber-500/20">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Link href="/c">
              <Button variant="ghost" size="icon" className="text-amber-400 hover:bg-amber-500/10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-semibold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-red-500" />
              ถ่ายทอดสด
            </h1>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => mutate()}
            className="text-amber-400 hover:bg-amber-500/10"
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-24 relative z-10">
        {/* Live Stream Banner */}
        <div className="glass-card-gold overflow-hidden glow-pulse">
          <div className="bg-gradient-to-r from-red-600/30 to-pink-600/20 p-5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center">
                  <Tv className="w-6 h-6 text-white" />
                </div>
                {(activeSessions.length > 0 || streamSettings?.is_live) && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-black" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">ถ่ายทอดสดผลหวย</h2>
                <p className="text-neutral-400 text-sm">
                  {activeSessions.length > 0 
                    ? `กำลังออกผล ${activeSessions.length} รายการ`
                    : streamSettings?.is_live 
                    ? 'กำลังถ่ายทอดสด'
                    : 'รับชมการออกรางวัลแบบเรียลไทม์'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Stream Player */}
        {streamSettings?.is_live && streamSettings?.stream_url && (
          <div className="glass-card overflow-hidden">
            <div className="p-3 border-b border-amber-500/20 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium text-white">LIVE STREAM</span>
            </div>
            <div className="aspect-video bg-black">
              <iframe
                src={getStreamEmbedUrl() || ''}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400 mb-4" />
            <p className="text-neutral-400">กำลังโหลด...</p>
          </div>
        ) : (
          <>
            {/* Active / Spinning Sessions */}
            {activeSessions.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  กำลังออกผลสด
                </h3>
                {activeSessions.map((session) => (
                  <div key={session.id} className="glass-card-gold overflow-hidden border-red-500/30">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-amber-400" />
                          <span className="font-bold text-white">{session.lottery?.name || 'หวย'}</span>
                        </div>
                        {getStatusBadge(session.status)}
                      </div>
                      <LiveResultDisplay session={session} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pending Sessions */}
            {pendingSessions.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  รอออกผล
                </h3>
                {pendingSessions.map((session) => (
                  <div key={session.id} className="glass-card p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-white">{session.lottery?.name || 'หวย'}</p>
                        <p className="text-sm text-neutral-500">
                          วันที่ {new Date(session.draw_date).toLocaleDateString('th-TH')}
                        </p>
                      </div>
                      {getStatusBadge(session.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Completed Sessions */}
            {completedSessions.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-green-400" />
                  ผลรางวัลวันนี้
                </h3>
                {completedSessions.map((session) => (
                  <div key={session.id} className="glass-card overflow-hidden border-green-500/20">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-white">{session.lottery?.name || 'หวย'}</span>
                        {getStatusBadge(session.status)}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-neutral-900/80 rounded-xl p-3 text-center border border-amber-500/20">
                          <p className="text-xs text-neutral-500 mb-1">รางวัลที่ 1</p>
                          <p className="text-xl font-mono font-bold gold-amount">
                            {session.top_result || '-'}
                          </p>
                        </div>
                        <div className="bg-neutral-900/80 rounded-xl p-3 text-center border border-amber-500/20">
                          <p className="text-xs text-neutral-500 mb-1">2 ตัวล่าง</p>
                          <p className="text-xl font-mono font-bold gold-amount">
                            {session.bottom_result || '-'}
                          </p>
                        </div>
                      </div>
                      {session.top_result && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                            3 ตัวบน: <span className="font-mono ml-1">{session.top_result.slice(-3)}</span>
                          </Badge>
                          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                            2 ตัวบน: <span className="font-mono ml-1">{session.top_result.slice(-2)}</span>
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {sessions.length === 0 && !streamSettings?.is_live && (
              <div className="glass-card p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                  <Radio className="w-8 h-8 text-neutral-600" />
                </div>
                <p className="text-white font-medium">ไม่มีการถ่ายทอดสดในขณะนี้</p>
                <p className="text-xs text-neutral-500 mt-1">กรุณาตรวจสอบกำหนดการออกรางวัล</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
