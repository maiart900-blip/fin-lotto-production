'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  Shield, 
  TrendingUp, 
  Activity, 
  RefreshCw,
  Ban,
  ArrowDown,
  Globe,
  Server,
  Zap,
  Bell,
  Volume2,
  VolumeX,
  Eye,
  Lock,
  Unlock,
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface VolumeData {
  number: string;
  totalAmount: number;
  entryCount: number;
  byBetType: Record<string, number>;
  bySite: Record<string, number>;
  limitPercent?: number;
  status?: 'normal' | 'warning' | 'critical';
}

interface FeedStats {
  totalEntries: number;
  totalVolume: number;
  uniqueNumbers: number;
  overLimitCount: number;
  criticalCount: number;
}

export default function NetworkRiskDashboard() {
  const [timeRange, setTimeRange] = useState('1h');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedNumber, setSelectedNumber] = useState<VolumeData | null>(null);
  const [blocking, setBlocking] = useState<string | null>(null);

  // Real-time data refresh every 5 seconds
  const { data, mutate, isValidating } = useSWR<{
    stats: FeedStats;
    overLimitNumbers: VolumeData[];
    volumeByNumber: VolumeData[];
    recentFeeds: any[];
  }>(`/api/network/feed?range=${timeRange}`, fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  const stats = data?.stats || {
    totalEntries: 0,
    totalVolume: 0,
    uniqueNumbers: 0,
    overLimitCount: 0,
    criticalCount: 0,
  };

  // Sound alert for critical numbers
  useEffect(() => {
    if (soundEnabled && stats.criticalCount > 0) {
      const audio = new Audio('/sounds/alert.mp3');
      audio.play().catch(() => {});
    }
  }, [stats.criticalCount, soundEnabled]);

  const handleBlockNumber = async (number: string, action: 'block' | 'reduce_rate') => {
    setBlocking(number);
    try {
      const res = await fetch('/api/risk-management/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number,
          action,
          broadcastToNetwork: true, // Push to all child sites
        }),
      });

      if (!res.ok) throw new Error('Failed to apply action');

      const result = await res.json();
      toast.success(
        action === 'block' 
          ? `อั้นเลข ${number} แล้ว - Sync ไป ${result.syncedSites} เว็บลูก`
          : `ลดเรทเลข ${number} แล้ว - Sync ไป ${result.syncedSites} เว็บลูก`
      );
      mutate();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setBlocking(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-gradient-to-r from-[#EF4444] to-[#DC2626] text-white';
      case 'warning': return 'bg-gradient-to-r from-[#EAB308] to-[#B8860B] text-white';
      default: return 'bg-[#10B981]/20 text-[#10B981]';
    }
  };

  return (
    <div className="space-y-6 bg-[#F8FAFC] min-h-screen p-6 -m-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] shadow-lg shadow-[rgba(234,179,8,0.3)]">
              <Shield className="size-6 text-white" />
            </div>
            Network Risk Dashboard
          </h1>
          <p className="text-[#64748B] mt-1">ศูนย์ควบคุมความเสี่ยงเครือข่ายหวย - Real-time</p>
        </div>
        <div className="flex items-center gap-2">
          {stats.criticalCount > 0 && (
            <Badge className="bg-[#EF4444] text-white animate-pulse">
              <AlertTriangle className="size-3 mr-1" />
              {stats.criticalCount} Critical
            </Badge>
          )}
          <Badge variant="outline" className="border-[#EAB308] text-[#EAB308]">
            <Activity className="size-3 mr-1 animate-pulse" />
            Live
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={soundEnabled ? 'text-[#EAB308]' : 'text-[#94A3B8]'}
          >
            {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isValidating}
            className="border-[#EAB308] text-[#B8860B] hover:bg-[rgba(234,179,8,0.1)]"
          >
            <RefreshCw className={`size-4 mr-1 ${isValidating ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card className="glass-card-gold hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] shadow-lg">
                <Globe className="size-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-[#64748B]">รายการทั้งหมด</p>
                <p className="text-2xl font-bold text-[#0F172A]">{stats.totalEntries.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-gold hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] shadow-lg">
                <TrendingUp className="size-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-[#64748B]">ยอดรวม</p>
                <p className="text-2xl font-bold text-[#B8860B]">{stats.totalVolume.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-gold hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] shadow-lg">
                <Zap className="size-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-[#64748B]">เลขที่มียอด</p>
                <p className="text-2xl font-bold text-[#0F172A]">{stats.uniqueNumbers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-gold hover-lift border-[#EAB308]/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#F59E0B] shadow-lg">
                <AlertTriangle className="size-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-[#64748B]">เลขเกินลิมิต</p>
                <p className="text-2xl font-bold text-[#B8860B]">{stats.overLimitCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-gold hover-lift border-[#EF4444]/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#EF4444] to-[#DC2626] shadow-lg">
                <Ban className="size-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-[#64748B]">Critical</p>
                <p className="text-2xl font-bold text-[#EF4444]">{stats.criticalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Range Tabs */}
      <Tabs value={timeRange} onValueChange={setTimeRange}>
        <TabsList className="bg-white border border-[rgba(234,179,8,0.2)]">
          <TabsTrigger value="1h" className="data-[state=active]:bg-[#EAB308] data-[state=active]:text-white">1 ชม.</TabsTrigger>
          <TabsTrigger value="6h" className="data-[state=active]:bg-[#EAB308] data-[state=active]:text-white">6 ชม.</TabsTrigger>
          <TabsTrigger value="24h" className="data-[state=active]:bg-[#EAB308] data-[state=active]:text-white">24 ชม.</TabsTrigger>
          <TabsTrigger value="today" className="data-[state=active]:bg-[#EAB308] data-[state=active]:text-white">วันนี้</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Critical Numbers Alert */}
      {data?.overLimitNumbers && data.overLimitNumbers.length > 0 && (
        <Card className="midnight-section">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="size-5 text-[#EAB308]" />
              เลขที่ต้องจับตา (Over-Limit)
            </CardTitle>
            <CardDescription className="text-[#94A3B8]">
              เลขที่มียอดแทงเกินลิมิตที่กำหนด - สามารถอั้นหรือลดเรทได้ทันที
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {data.overLimitNumbers.map((num) => (
                <div 
                  key={num.number}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    num.status === 'critical' 
                      ? 'bg-[#EF4444]/10 border-[#EF4444]/30 hover:border-[#EF4444]' 
                      : 'bg-[#EAB308]/10 border-[#EAB308]/30 hover:border-[#EAB308]'
                  }`}
                  onClick={() => setSelectedNumber(num)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-2xl font-bold font-mono ${
                      num.status === 'critical' ? 'text-[#EF4444]' : 'text-[#EAB308]'
                    }`}>
                      {num.number}
                    </span>
                    <Badge className={getStatusColor(num.status || 'normal')}>
                      {num.status === 'critical' ? 'Critical' : 'Warning'}
                    </Badge>
                  </div>
                  <p className="text-white text-lg font-bold mb-1">
                    {num.totalAmount.toLocaleString()} บาท
                  </p>
                  <div className="flex items-center gap-2 mb-3">
                    <Progress 
                      value={Math.min(num.limitPercent || 0, 200)} 
                      className="h-2 bg-white/20"
                    />
                    <span className="text-xs text-[#94A3B8]">{num.limitPercent}%</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(e) => { e.stopPropagation(); handleBlockNumber(num.number, 'block'); }}
                      disabled={blocking === num.number}
                      className="flex-1 bg-[#EF4444] hover:bg-[#DC2626]"
                    >
                      <Ban className="size-3 mr-1" />
                      อั้น
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleBlockNumber(num.number, 'reduce_rate'); }}
                      disabled={blocking === num.number}
                      className="flex-1 bg-[#EAB308] hover:bg-[#B8860B] text-[#0F172A]"
                    >
                      <ArrowDown className="size-3 mr-1" />
                      ลดเรท
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Volume Heatmap */}
      <Card className="glass-card-gold">
        <CardHeader>
          <CardTitle className="text-[#0F172A] flex items-center gap-2">
            <Eye className="size-5 text-[#EAB308]" />
            ยอดแทงรวมทุกเลข (Top 50)
          </CardTitle>
          <CardDescription>
            แสดงยอดแทงรวมจากเว็บลูกทั้งหมด เรียงจากมากไปน้อย
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 grid-cols-5 md:grid-cols-10">
            {data?.volumeByNumber?.slice(0, 50).map((num, idx) => {
              const maxVolume = data.volumeByNumber[0]?.totalAmount || 1;
              const intensity = Math.round((num.totalAmount / maxVolume) * 100);
              
              return (
                <div
                  key={num.number}
                  className="relative p-3 rounded-lg text-center cursor-pointer transition-all hover:scale-105"
                  style={{
                    background: `linear-gradient(135deg, 
                      rgba(234, 179, 8, ${intensity / 100 * 0.8}) 0%, 
                      rgba(184, 134, 11, ${intensity / 100 * 0.6}) 100%)`,
                  }}
                  onClick={() => setSelectedNumber(num)}
                >
                  <span className={`font-mono font-bold ${intensity > 50 ? 'text-white' : 'text-[#0F172A]'}`}>
                    {num.number}
                  </span>
                  <p className={`text-xs mt-1 ${intensity > 50 ? 'text-white/80' : 'text-[#64748B]'}`}>
                    {num.totalAmount >= 1000 ? `${(num.totalAmount / 1000).toFixed(0)}K` : num.totalAmount}
                  </p>
                  {idx < 3 && (
                    <Badge className="absolute -top-2 -right-2 size-5 p-0 flex items-center justify-center bg-[#EF4444] text-white text-[10px]">
                      {idx + 1}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Feed */}
      <Card className="glass-card-gold">
        <CardHeader>
          <CardTitle className="text-[#0F172A] flex items-center gap-2">
            <Activity className="size-5 text-[#EAB308]" />
            รายการล่าสุดจากเครือข่าย
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {data?.recentFeeds?.map((feed, idx) => (
              <div 
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-white border border-[rgba(234,179,8,0.1)] hover:border-[#EAB308]/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-[#EAB308] text-[#B8860B]">
                    <Server className="size-3 mr-1" />
                    {feed.child_sites?.name || feed.child_site_id}
                  </Badge>
                  <span className="font-mono font-bold text-[#0F172A]">{feed.number}</span>
                  <Badge className="bg-[#EAB308]/20 text-[#B8860B]">
                    {feed.bet_type}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-[#B8860B]">
                    {Number(feed.amount).toLocaleString()} ฿
                  </span>
                  <span className="text-xs text-[#94A3B8]">
                    {new Date(feed.created_at).toLocaleTimeString('th-TH')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
