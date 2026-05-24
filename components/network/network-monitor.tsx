'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import useSWR from 'swr';
import { 
  Activity, ArrowDownRight, ArrowUpRight, Globe, 
  Radio, Server, Wifi, WifiOff, Zap, AlertTriangle,
  TrendingUp, Users, Clock
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface BetFeedItem {
  id: string;
  agentCode: string;
  customerName: string;
  lotteryName: string;
  number: string;
  betType: string;
  amount: number;
  timestamp: string;
  currentVolume: number;
  limit: number;
}

export function NetworkMonitor() {
  const [feed, setFeed] = useState<BetFeedItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch network summary
  const { data: summary } = useSWR('/api/network/summary', fetcher, { refreshInterval: 3000 });

  // SSE connection for real-time feed
  useEffect(() => {
    const eventSource = new EventSource('/api/network/feed/stream');

    eventSource.onopen = () => setIsConnected(true);
    eventSource.onerror = () => setIsConnected(false);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_bet') {
          setFeed(prev => [data.bet, ...prev].slice(0, 50));
        } else if (data.type === 'initial') {
          setFeed(data.bets || []);
        }
      } catch (error) {
        console.error('SSE parse error:', error);
      }
    };

    return () => eventSource.close();
  }, []);

  const BET_TYPE_LABELS: Record<string, string> = {
    'top_three': '3บน',
    'bottom_three': '3ล่าง',
    'top_two': '2บน',
    'bottom_two': '2ล่าง',
    'run_top': 'วิ่งบน',
    'run_bottom': 'วิ่งล่าง',
  };

  return (
    <div className="space-y-6">
      {/* Connection Status Bar */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-[#0F172A] border border-[#1E293B]">
        <div className="flex items-center gap-3">
          <div className={`size-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[#94A3B8]">
            {isConnected ? 'Connected to Data Pipe' : 'Connecting...'}
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Server className="size-4 text-[#EAB308]" />
            <span className="text-white font-mono">{summary?.totalAgents || 0}</span>
            <span className="text-[#64748B] text-sm">Total</span>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="size-4 text-green-500" />
            <span className="text-green-500 font-mono">{summary?.onlineAgents || 0}</span>
            <span className="text-[#64748B] text-sm">Online</span>
          </div>
          <div className="flex items-center gap-2">
            <WifiOff className="size-4 text-red-500" />
            <span className="text-red-500 font-mono">{summary?.offlineAgents || 0}</span>
            <span className="text-[#64748B] text-sm">Offline</span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="gold-stats-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#64748B]">Bets Today</p>
                <p className="text-2xl font-bold text-[#EAB308]">
                  {(summary?.todayTotalBets || 0).toLocaleString()}
                </p>
              </div>
              <Activity className="size-8 text-[#EAB308]/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="gold-stats-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#64748B]">Volume</p>
                <p className="text-2xl font-bold text-[#F5E1A4]">
                  {(summary?.todayTotalVolume || 0).toLocaleString()}
                </p>
              </div>
              <TrendingUp className="size-8 text-[#F5E1A4]/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="gold-stats-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#64748B]">Pending Cmds</p>
                <p className="text-2xl font-bold text-[#3B82F6]">
                  {summary?.pendingCommands || 0}
                </p>
              </div>
              <Radio className="size-8 text-[#3B82F6]/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="gold-stats-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#64748B]">Alerts</p>
                <p className="text-2xl font-bold text-[#EF4444]">
                  {summary?.criticalAlerts || 0}
                </p>
              </div>
              <AlertTriangle className="size-8 text-[#EF4444]/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Feed */}
      <Card className="midnight-section">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="size-5 text-[#EAB308]" />
            Real-time Data Pipe
            <Badge variant="outline" className="border-[#EAB308] text-[#EAB308] ml-2">
              Agents to Master
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {feed.length === 0 ? (
              <div className="text-center py-12 text-[#64748B]">
                <Radio className="size-12 mx-auto mb-4 opacity-50" />
                <p>Waiting for incoming bets...</p>
              </div>
            ) : (
              feed.map((item, idx) => {
                const volumePercent = (item.currentVolume / item.limit) * 100;
                const isWarning = volumePercent >= 80;
                const isCritical = volumePercent >= 95;

                return (
                  <div
                    key={`${item.id}-${idx}`}
                    className={`p-3 rounded-lg border transition-all ${
                      isCritical 
                        ? 'bg-red-500/10 border-red-500/50 animate-pulse' 
                        : isWarning 
                        ? 'bg-yellow-500/10 border-yellow-500/30' 
                        : 'bg-[#0F172A] border-[#1E293B]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="border-[#EAB308] text-[#EAB308]">
                          {item.agentCode}
                        </Badge>
                        <span className="text-[#94A3B8]">{item.customerName}</span>
                        <span className="text-[#475569]">|</span>
                        <span className="text-[#64748B]">{item.lotteryName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="size-3 text-[#475569]" />
                        <span className="text-xs text-[#475569]">
                          {new Date(item.timestamp).toLocaleTimeString('th-TH')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-xl font-bold text-[#FDE047]">{item.number}</span>
                        <Badge className="bg-[#1E293B] text-[#94A3B8]">
                          {BET_TYPE_LABELS[item.betType] || item.betType}
                        </Badge>
                        <span className="text-white font-semibold">
                          {item.amount.toLocaleString()} <span className="text-[#64748B] text-sm">บาท</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-32">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-[#64748B]">Volume</span>
                            <span className={isCritical ? 'text-red-500' : isWarning ? 'text-yellow-500' : 'text-[#94A3B8]'}>
                              {volumePercent.toFixed(0)}%
                            </span>
                          </div>
                          <Progress 
                            value={volumePercent} 
                            className={`h-1.5 ${isCritical ? '[&>div]:bg-red-500' : isWarning ? '[&>div]:bg-yellow-500' : '[&>div]:bg-[#EAB308]'}`}
                          />
                        </div>
                        {isCritical && (
                          <AlertTriangle className="size-5 text-red-500 animate-pulse" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
