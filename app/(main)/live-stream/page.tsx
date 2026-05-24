'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Play, 
  Square, 
  CheckCircle, 
  Tv,
  Trophy,
  Loader2,
  Sparkles,
  Crown,
  Zap,
  TrendingUp,
  Users,
  Clock,
  Radio,
  Volume2,
  VolumeX,
  Maximize2,
  Settings,
  RefreshCw,
} from 'lucide-react';
import useSWR, { mutate } from 'swr';
import { WinningTicker, WinningTickerCompact } from '@/components/live/winning-ticker';
import { useRealtimeBets } from '@/hooks/use-realtime-bets';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Lottery {
  id: string;
  name: string;
  icon: string;
  result_time: string;
  stream_url?: string;
  stream_type?: 'youtube' | 'facebook' | 'custom';
}

// Helper function to convert YouTube URL to embed URL
function getEmbedUrl(url: string | undefined, type: string = 'youtube'): string | null {
  if (!url) return null;
  
  if (type === 'youtube') {
    // Handle various YouTube URL formats
    let videoId = '';
    
    // Already an embed URL
    if (url.includes('youtube.com/embed/')) {
      return url;
    }
    
    // Standard watch URL: youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/[?&]v=([^&]+)/);
    if (watchMatch) {
      videoId = watchMatch[1];
    }
    
    // Short URL: youtu.be/VIDEO_ID
    const shortMatch = url.match(/youtu\.be\/([^?]+)/);
    if (shortMatch) {
      videoId = shortMatch[1];
    }
    
    // Live URL: youtube.com/live/VIDEO_ID
    const liveMatch = url.match(/youtube\.com\/live\/([^?]+)/);
    if (liveMatch) {
      videoId = liveMatch[1];
    }
    
    // Just a video ID
    if (!videoId && /^[a-zA-Z0-9_-]{11}$/.test(url)) {
      videoId = url;
    }
    
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0`;
    }
  }
  
  if (type === 'facebook') {
    // Facebook video embed
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true`;
  }
  
  // Custom or direct URL
  return url;
}

interface LiveSession {
  id: string;
  lottery_id: string;
  status: 'pending' | 'spinning' | 'stopped' | 'completed';
  top_result: string | null;
  bottom_result: string | null;
  lottery: Lottery;
}

// Premium Spinning Digit Component
function PremiumSpinningDigit({ 
  finalDigit, 
  isSpinning, 
  delay = 0,
  size = 'large'
}: { 
  finalDigit: string | null; 
  isSpinning: boolean; 
  delay?: number;
  size?: 'large' | 'medium' | 'small';
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
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (finalDigit !== null) setCurrentDigit(finalDigit);
    }
  }, [isSpinning, finalDigit, delay]);

  const sizeClasses = {
    large: 'w-16 h-20 text-4xl md:w-20 md:h-24 md:text-5xl',
    medium: 'w-12 h-16 text-3xl md:w-14 md:h-18 md:text-4xl',
    small: 'w-10 h-12 text-2xl'
  };

  return (
    <div className={`
      ${sizeClasses[size]} 
      flex items-center justify-center 
      font-mono font-bold rounded-xl
      transition-all duration-300
      ${isSpinning 
        ? 'bg-amber-100 border-2 border-amber-400 text-amber-600 animate-pulse shadow-lg shadow-amber-200' 
        : finalDigit !== null 
        ? 'bg-red-600 border-2 border-red-700 text-white shadow-lg' 
        : 'bg-gray-100 border-2 border-gray-300 text-gray-400'
      }
    `}>
      {currentDigit}
    </div>
  );
}

// Live Result Display with Glass Cards
function LiveResultDisplay({ 
  session, 
  isSpinning,
  topResult,
  bottomResult,
}: { 
  session: LiveSession | null;
  isSpinning: boolean;
  topResult: string;
  bottomResult: string;
}) {
  const sixDigits = topResult.padEnd(6, '0').split('');
  const twoDigits = bottomResult.padEnd(2, '0').split('');

  return (
    <div className="space-y-6">
      {/* 6 Digits Top Prize */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Crown className="size-5 text-amber-500" />
            <span className="text-lg font-bold text-gray-900">รางวัลที่ 1</span>
            <Crown className="size-5 text-amber-500" />
          </div>
          <p className="text-gray-500 text-sm">6 หลัก</p>
        </div>
        
        <div className="flex justify-center gap-2 md:gap-3">
          {sixDigits.map((digit, i) => (
            <PremiumSpinningDigit 
              key={`top-${i}`}
              finalDigit={!isSpinning ? digit : null}
              isSpinning={isSpinning}
              delay={i * 100}
              size="large"
            />
          ))}
        </div>
        
        {/* Derived results */}
        {!isSpinning && topResult && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <div className="px-4 py-2 flex items-center gap-2 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-gray-600 text-sm">3 ตัวบน:</span>
              <span className="font-mono font-bold text-blue-600 text-lg">{topResult.slice(-3)}</span>
            </div>
            <div className="px-4 py-2 flex items-center gap-2 bg-green-50 rounded-lg border border-green-200">
              <span className="text-gray-600 text-sm">2 ตัวบน:</span>
              <span className="font-mono font-bold text-green-600 text-lg">{topResult.slice(-2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* 2 Digits Bottom Prize */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="size-4 text-amber-500" />
            <span className="text-base font-bold text-gray-900">2 ตัวล่าง</span>
            <Trophy className="size-4 text-amber-500" />
          </div>
        </div>
        
        <div className="flex justify-center gap-3">
          {twoDigits.map((digit, i) => (
            <PremiumSpinningDigit 
              key={`bottom-${i}`}
              finalDigit={!isSpinning ? digit : null}
              isSpinning={isSpinning}
              delay={i * 150 + 600}
              size="medium"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function UltraPremiumLiveStreamPage() {
  const [selectedLotteryId, setSelectedLotteryId] = useState<string>('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [topResult, setTopResult] = useState('');
  const [bottomResult, setBottomResult] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLIFrameElement>(null);

  // Fetch lotteries
  const { data: lotteries = [] } = useSWR<Lottery[]>('/api/lotteries?status=active', fetcher);
  
  // Fetch current session
  const { data: currentSession, mutate: mutateSession } = useSWR<LiveSession>(
    selectedLotteryId ? `/api/live-draw/current?lottery_id=${selectedLotteryId}` : null,
    fetcher,
    { refreshInterval: 2000 }
  );

  // Fetch network stats
  const { data: networkStats } = useSWR('/api/network/stats', fetcher, { refreshInterval: 5000 });

  // Update local state from session
  useEffect(() => {
    if (currentSession) {
      setIsSpinning(currentSession.status === 'spinning');
      if (currentSession.top_result) setTopResult(currentSession.top_result);
      if (currentSession.bottom_result) setBottomResult(currentSession.bottom_result);
    }
  }, [currentSession]);

  // Select first lottery by default
  useEffect(() => {
    if (lotteries.length > 0 && !selectedLotteryId) {
      setSelectedLotteryId(lotteries[0].id);
    }
  }, [lotteries, selectedLotteryId]);

  const selectedLottery = lotteries.find(l => l.id === selectedLotteryId);

  // Control actions
  const handleStartSpin = async () => {
    try {
      await fetch('/api/live-draw/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lottery_id: selectedLotteryId }),
      });
      setIsSpinning(true);
      toast.success('เริ่มหมุนตัวเลขแล้ว');
      mutateSession();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const handleStopSpin = async () => {
    try {
      const res = await fetch('/api/live-draw/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lottery_id: selectedLotteryId,
          top_result: topResult,
          bottom_result: bottomResult,
        }),
      });
      const data = await res.json();
      if (data.top_result) setTopResult(data.top_result);
      if (data.bottom_result) setBottomResult(data.bottom_result);
      setIsSpinning(false);
      toast.success('หยุดหมุนแล้ว');
      mutateSession();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const handleConfirmResult = async () => {
    try {
      await fetch('/api/live-draw/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lottery_id: selectedLotteryId,
          top_result: topResult,
          bottom_result: bottomResult,
        }),
      });
      toast.success('ยืนยันผลรางวัลแล้ว - กำลังจ่ายรางวัลอัตโนมัติ');
      mutateSession();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 -m-6 p-6">
      {/* Winning Ticker */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 mb-6">
        <WinningTicker />
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500 shadow-lg">
                <Tv className="size-6 text-white" />
              </div>
              <span>LIVE DRAW</span>
            </h1>
            <p className="text-gray-600 mt-1">ถ่ายทอดสดผลรางวัล</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Indicator */}
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
              <div className="size-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-600 font-semibold text-sm">LIVE</span>
            </div>

            {/* Lottery Selector */}
            <Select value={selectedLotteryId} onValueChange={setSelectedLotteryId}>
              <SelectTrigger className="w-[200px] bg-white border-gray-300 text-gray-900">
                <SelectValue placeholder="เลือกหวย" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200">
                {lotteries.map((lottery) => (
                  <SelectItem 
                    key={lottery.id} 
                    value={lottery.id}
                    className="text-gray-900 hover:bg-gray-100"
                  >
                    {lottery.icon} {lottery.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Video Player - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Frame */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden aspect-video relative">
              {selectedLottery?.stream_url ? (
                <iframe
                  ref={videoRef}
                  src={getEmbedUrl(selectedLottery.stream_url, selectedLottery.stream_type) || ''}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                  <Tv className="size-16 text-gray-400 mb-4" />
                  <p className="text-gray-600">ไม่มี Stream URL</p>
                  <p className="text-gray-500 text-sm mt-1">กรุณาตั้งค่า URL ในการตั้งค่าหวย</p>
                </div>
              )}

              {/* Video Controls Overlay */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsMuted(!isMuted)}
                    className="bg-black/50 hover:bg-black/70 text-white"
                  >
                    {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="bg-black/50 hover:bg-black/70 text-white"
                >
                  <Maximize2 className="size-4" />
                </Button>
              </div>

              {/* Lottery Badge */}
              <div className="absolute top-4 left-4">
                <Badge className="bg-red-500 text-white font-bold px-3 py-1">
                  {selectedLottery?.icon} {selectedLottery?.name || 'เลือกหวย'}
                </Badge>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex flex-wrap gap-3 justify-center bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              {!isSpinning ? (
                <Button
                  onClick={handleStartSpin}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2 px-8"
                  disabled={!selectedLotteryId}
                >
                  <Play className="size-5" />
                  เริ่มหมุน
                </Button>
              ) : (
                <Button
                  onClick={handleStopSpin}
                  variant="destructive"
                  className="gap-2 px-8"
                >
                  <Square className="size-5" />
                  หยุด
                </Button>
              )}

              <Button
                onClick={handleConfirmResult}
                disabled={isSpinning || !topResult}
                className="bg-green-600 hover:bg-green-700 text-white gap-2 px-8"
              >
                <CheckCircle className="size-5" />
                ยืนยันผล
              </Button>

              <Button
                variant="outline"
                onClick={() => mutateSession()}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>

            {/* Result Display */}
            <LiveResultDisplay
              session={currentSession || null}
              isSpinning={isSpinning}
              topResult={topResult}
              bottomResult={bottomResult}
            />
          </div>

          {/* Sidebar - Stats & Info */}
          <div className="space-y-6">
            {/* Network Stats */}
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-gray-900 flex items-center gap-2">
                  <Zap className="size-4 text-blue-600" />
                  Network Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-blue-600" />
                      <span className="text-gray-600 text-sm">Active Viewers</span>
                    </div>
                    <span className="font-mono font-bold text-gray-900">
                      {networkStats?.activeViewers?.toLocaleString() || '0'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="size-4 text-green-600" />
                      <span className="text-gray-600 text-sm">Total Bets Today</span>
                    </div>
                    <span className="font-mono font-bold text-gray-900">
                      {networkStats?.totalBetsToday?.toLocaleString() || '0'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Radio className="size-4 text-purple-600" />
                      <span className="text-gray-600 text-sm">Connected Sites</span>
                    </div>
                    <span className="font-mono font-bold text-gray-900">
                      {networkStats?.connectedSites || '0'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Winners */}
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-gray-900 flex items-center gap-2">
                  <Trophy className="size-4 text-amber-500" />
                  Recent Winners
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WinningTickerCompact />
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-gray-900 flex items-center gap-2">
                  <Settings className="size-4 text-gray-600" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600"
                >
                  <Clock className="size-4 mr-2" />
                  ตั้งเวลาออกผล
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start border-gray-300 text-gray-700 hover:border-green-400 hover:text-green-600"
                >
                  <Sparkles className="size-4 mr-2" />
                  Instant Payout
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
