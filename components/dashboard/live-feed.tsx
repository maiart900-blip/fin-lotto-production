'use client';

/**
 * Live Feed Component
 * Real-time activity feed for admin dashboard
 */

import { useState, useEffect, useCallback } from 'react';
import { useAdminRealtime, type RealtimeEvent } from '@/hooks/use-realtime';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  Banknote, 
  TrendingUp, 
  AlertTriangle, 
  Radio,
  Clock,
  User,
  Hash,
  CreditCard,
  ArrowDownCircle,
  ArrowUpCircle,
  Bell,
  Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

interface LiveFeedProps {
  className?: string;
  maxItems?: number;
  showHeader?: boolean;
}

const EVENT_CONFIG: Record<string, { 
  icon: any; 
  color: string; 
  label: string;
  bgClass: string;
}> = {
  new_bet: { 
    icon: Hash, 
    color: '#EAB308', 
    label: 'แทงเลข',
    bgClass: 'bg-gradient-to-r from-[#EAB308]/20 to-transparent'
  },
  bet_volume_update: { 
    icon: TrendingUp, 
    color: '#3B82F6', 
    label: 'ยอดอัปเดต',
    bgClass: 'bg-gradient-to-r from-blue-500/20 to-transparent'
  },
  limit_reached: { 
    icon: AlertTriangle, 
    color: '#EF4444', 
    label: 'ถึงวงเงิน!',
    bgClass: 'bg-gradient-to-r from-red-500/20 to-transparent'
  },
  risk_alert: { 
    icon: Bell, 
    color: '#F59E0B', 
    label: 'แจ้งเตือน',
    bgClass: 'bg-gradient-to-r from-orange-500/20 to-transparent'
  },
  deposit_request: { 
    icon: ArrowDownCircle, 
    color: '#10B981', 
    label: 'ฝากเงิน',
    bgClass: 'bg-gradient-to-r from-emerald-500/20 to-transparent'
  },
  withdraw_request: { 
    icon: ArrowUpCircle, 
    color: '#8B5CF6', 
    label: 'ถอนเงิน',
    bgClass: 'bg-gradient-to-r from-violet-500/20 to-transparent'
  },
  credit_update: { 
    icon: CreditCard, 
    color: '#06B6D4', 
    label: 'เครดิต',
    bgClass: 'bg-gradient-to-r from-cyan-500/20 to-transparent'
  },
  market_status: { 
    icon: Radio, 
    color: '#EC4899', 
    label: 'สถานะตลาด',
    bgClass: 'bg-gradient-to-r from-pink-500/20 to-transparent'
  },
  system_broadcast: { 
    icon: Zap, 
    color: '#6366F1', 
    label: 'ประกาศ',
    bgClass: 'bg-gradient-to-r from-indigo-500/20 to-transparent'
  },
};

function formatEventContent(event: RealtimeEvent): string {
  const { type, data } = event;
  
  switch (type) {
    case 'new_bet':
      return `${data.agentName || 'Agent'} - เลข ${data.number} (${data.betType}) ฿${data.amount?.toLocaleString()}`;
    case 'bet_volume_update':
      return `เลข ${data.number} ยอดรวม ฿${data.volume?.toLocaleString()}`;
    case 'limit_reached':
      return `เลข ${data.number} ถึงวงเงิน! (${data.percentage}%)`;
    case 'risk_alert':
      return `เลข ${data.number} เตือน ${data.percentage}% ของวงเงิน`;
    case 'deposit_request':
      return `${data.customerName || 'ลูกค้า'} ขอฝาก ฿${data.amount?.toLocaleString()}`;
    case 'withdraw_request':
      return `${data.customerName || 'ลูกค้า'} ขอถอน ฿${data.amount?.toLocaleString()}`;
    case 'credit_update':
      const changeSign = data.change >= 0 ? '+' : '';
      return `เครดิตเปลี่ยน ${changeSign}฿${data.change?.toLocaleString()}`;
    case 'market_status':
      const statusText = data.status === 'open' ? 'เปิด' : data.status === 'closed' ? 'ปิด' : 'ระงับ';
      return `${data.lotteryName} ${statusText}`;
    case 'system_broadcast':
      return data.message;
    default:
      return JSON.stringify(data);
  }
}

export function LiveFeed({ className, maxItems = 50, showHeader = true }: LiveFeedProps) {
  const [displayEvents, setDisplayEvents] = useState<RealtimeEvent[]>([]);
  const [newEventCount, setNewEventCount] = useState(0);

  const handleEvent = useCallback((event: RealtimeEvent) => {
    setDisplayEvents(prev => [event, ...prev].slice(0, maxItems));
    setNewEventCount(prev => prev + 1);
    
    // Reset count after 3 seconds
    setTimeout(() => setNewEventCount(prev => Math.max(0, prev - 1)), 3000);
  }, [maxItems]);

  const { events, isConnected, error } = useAdminRealtime(handleEvent);

  // Initialize with existing events
  useEffect(() => {
    if (events.length > 0 && displayEvents.length === 0) {
      setDisplayEvents(events.slice(0, maxItems));
    }
  }, [events, displayEvents.length, maxItems]);

  return (
    <Card className={`midnight-section overflow-hidden ${className}`}>
      {showHeader && (
        <CardHeader className="pb-3 border-b border-[rgba(234,179,8,0.2)]">
          <CardTitle className="text-lg flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-[#EAB308] to-[#B8860B]">
                <Activity className="size-4 text-white" />
              </div>
              <span>Live Feed</span>
              {newEventCount > 0 && (
                <Badge className="bg-[#EF4444] text-white animate-pulse">
                  +{newEventCount}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#10B981] animate-pulse' : 'bg-[#EF4444]'}`} />
              <span className="text-xs text-[#94A3B8]">
                {isConnected ? 'Connected' : error || 'Disconnected'}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {displayEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-[#64748B]">
              <Radio className="size-8 mb-2 opacity-50" />
              <p className="text-sm">กำลังรอ events...</p>
            </div>
          ) : (
            <div className="divide-y divide-[rgba(234,179,8,0.1)]">
              {displayEvents.map((event, index) => {
                const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.system_broadcast;
                const Icon = config.icon;
                
                return (
                  <div
                    key={`${event.timestamp}-${index}`}
                    className={`p-3 hover:bg-[rgba(234,179,8,0.05)] transition-colors ${config.bgClass}`}
                  >
                    <div className="flex items-start gap-3">
                      <div 
                        className="p-1.5 rounded-lg shrink-0"
                        style={{ backgroundColor: `${config.color}20` }}
                      >
                        <Icon className="size-4" style={{ color: config.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge 
                            variant="outline" 
                            className="text-[10px] px-1.5 py-0 border-[rgba(234,179,8,0.3)] text-[#EAB308]"
                          >
                            {config.label}
                          </Badge>
                          {event.source && event.source !== 'master' && (
                            <span className="text-[10px] text-[#64748B] flex items-center gap-1">
                              <User className="size-2.5" />
                              {event.source}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[#F8FAFC] truncate">
                          {formatEventContent(event)}
                        </p>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-[#64748B]">
                          <Clock className="size-2.5" />
                          {formatDistanceToNow(new Date(event.timestamp), { 
                            addSuffix: true, 
                            locale: th 
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

/**
 * Compact version for sidebar
 */
export function LiveFeedCompact({ maxItems = 10 }: { maxItems?: number }) {
  return <LiveFeed maxItems={maxItems} showHeader={false} className="border-0 bg-transparent" />;
}
