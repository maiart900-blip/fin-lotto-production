'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, CheckCircle, XCircle, Sparkles, Play } from 'lucide-react';
import { 
  Lottery, 
  getLotteryStatus, 
  formatCountdown, 
  getStatusColor,
  LotteryStatus 
} from '@/lib/lottery-utils';
import { cn } from '@/lib/utils';

interface LotteryStatusBadgeProps {
  lottery: Lottery;
  showCountdown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  isSuperAdmin?: boolean;
}

export function LotteryStatusBadge({ 
  lottery, 
  showCountdown = true,
  size = 'md',
  isSuperAdmin = false
}: LotteryStatusBadgeProps) {
  const [status, setStatus] = useState(() => getLotteryStatus(lottery, isSuperAdmin));
  
  // Refresh status every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(getLotteryStatus(lottery, isSuperAdmin));
    }, 30000);
    
    return () => clearInterval(interval);
  }, [lottery, isSuperAdmin]);

  // Also update when lottery prop changes
  useEffect(() => {
    setStatus(getLotteryStatus(lottery, isSuperAdmin));
  }, [lottery, isSuperAdmin]);

  const statusIconMap: Record<LotteryStatus, typeof CheckCircle> = {
    advance_open: Play,
    closing_soon: AlertTriangle,
    round_closed: XCircle,
    result_announced: Sparkles,
  };
  const StatusIcon = statusIconMap[status.status] || Clock;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(
        getStatusColor(status.status),
        sizeClasses[size],
        'gap-1.5 font-medium'
      )}
    >
      <StatusIcon className={cn(
        size === 'sm' ? 'size-3' : size === 'lg' ? 'size-5' : 'size-4'
      )} />
      <span>{status.statusText}</span>
      {showCountdown && status.countdown !== null && status.canAccept && (
        <span className="font-mono">
          (ปิดใน {formatCountdown(status.countdown)})
        </span>
      )}
    </Badge>
  );
}

interface LotteryCountdownProps {
  lottery: Lottery;
  onClose?: () => void;
  isSuperAdmin?: boolean;
}

export function LotteryCountdown({ lottery, onClose, isSuperAdmin = false }: LotteryCountdownProps) {
  const [status, setStatus] = useState(() => getLotteryStatus(lottery, isSuperAdmin));
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const updateStatus = () => {
      const newStatus = getLotteryStatus(lottery, isSuperAdmin);
      setStatus(newStatus);
      
      // Call onClose callback when lottery closes (but not for super admin)
      if (!newStatus.canAccept && onClose && !isSuperAdmin) {
        onClose();
      }
    };

    // Update every second for accurate countdown
    const interval = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 0) {
          updateStatus();
          return 59;
        }
        return prev - 1;
      });
    }, 1000);

    updateStatus();
    
    return () => clearInterval(interval);
  }, [lottery, onClose, isSuperAdmin]);

  // Show current round info
  const roundLabel = status.currentRound === 'next' 
    ? `งวดถัดไป ${status.nextDrawDate?.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}` 
    : 'งวดวันนี้';

  if (!status.canAccept && !isSuperAdmin) {
    return (
      <div className="flex items-center gap-2 text-red-400">
        <XCircle className="size-5" />
        <span className="font-medium">{status.statusText}</span>
      </div>
    );
  }

  // If result announced, show next round info
  if (status.status === 'result_announced') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-purple-500/10 border-purple-500/30">
        <Sparkles className="size-5 text-purple-400" />
        <div className="flex-1">
          <div className="text-sm text-purple-300">{status.statusText}</div>
          <div className="text-sm font-medium text-purple-400">
            ซื้อล่วงหน้า{roundLabel}ได้แล้ว
          </div>
        </div>
      </div>
    );
  }

  const hours = status.countdown ? Math.floor(status.countdown / 60) : 0;
  const minutes = status.countdown ? status.countdown % 60 : 0;

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border",
      status.status === 'closing_soon' 
        ? "bg-amber-500/10 border-amber-500/30" 
        : "bg-green-500/10 border-green-500/30"
    )}>
      <Clock className={cn(
        "size-5",
        status.status === 'closing_soon' ? "text-amber-400 animate-pulse" : "text-green-400"
      )} />
      <div className="flex-1">
        <div className="text-sm text-muted-foreground">
          {status.status === 'advance_open' ? 'เปิดรับล่วงหน้า' : 'ใกล้ปิดงวด'} • ปิดรับใน
        </div>
        <div className={cn(
          "font-mono text-xl font-bold",
          status.status === 'closing_soon' ? "text-amber-400" : "text-green-400"
        )}>
          {hours > 0 && `${hours.toString().padStart(2, '0')}:`}
          {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
        </div>
      </div>
      {status.status === 'closing_soon' && (
        <AlertTriangle className="size-6 text-amber-400 animate-bounce" />
      )}
    </div>
  );
}

interface LotteryStatusListProps {
  lotteries: Lottery[];
  title?: string;
  isSuperAdmin?: boolean;
}

export function LotteryStatusList({ lotteries, title = "สถานะหวยวันนี้", isSuperAdmin = false }: LotteryStatusListProps) {
  const [statusList, setStatusList] = useState<Array<{lottery: Lottery; status: ReturnType<typeof getLotteryStatus>}>>([]);

  useEffect(() => {
    const updateStatuses = () => {
      const statuses = lotteries
        .filter(l => l.is_active)
        .map(lottery => ({
          lottery,
          status: getLotteryStatus(lottery, isSuperAdmin)
        }))
        .sort((a, b) => {
          // Sort: advance_open first, then closing_soon, then others
          const order: Record<LotteryStatus, number> = { 
            advance_open: 0, 
            closing_soon: 1, 
            result_announced: 2, 
            round_closed: 3 
          };
          return order[a.status.status] - order[b.status.status];
        });
      setStatusList(statuses);
    };

    updateStatuses();
    const interval = setInterval(updateStatuses, 30000);
    
    return () => clearInterval(interval);
  }, [lotteries, isSuperAdmin]);

  const openCount = statusList.filter(s => s.status.canAccept).length;
  const closingSoonCount = statusList.filter(s => s.status.status === 'closing_soon').length;
  const closedCount = statusList.filter(s => !s.status.canAccept).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <div className="flex gap-2 text-xs">
          <span className="text-green-400">{openCount} เปิดรับ</span>
          {closingSoonCount > 0 && (
            <span className="text-amber-400">{closingSoonCount} ใกล้ปิด</span>
          )}
          <span className="text-red-400">{closedCount} ปิด</span>
        </div>
      </div>
      
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {statusList.map(({ lottery, status }) => (
          <div 
            key={lottery.id}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border transition-colors",
              status.canAccept && status.status !== 'closing_soon' && "bg-green-500/5 border-green-500/20",
              status.status === 'closing_soon' && "bg-amber-500/5 border-amber-500/20",
              !status.canAccept && "bg-muted/30 border-border"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "size-2 rounded-full",
                status.canAccept && status.status !== 'closing_soon' && "bg-green-500",
                status.status === 'closing_soon' && "bg-amber-500 animate-pulse",
                !status.canAccept && "bg-red-500"
              )} />
              <div>
                <div className="font-medium">{lottery.name}</div>
                <div className="text-xs text-muted-foreground">
                  ปิดรับ {lottery.close_time?.slice(0, 5)}
                </div>
              </div>
            </div>
            <LotteryStatusBadge lottery={lottery} showCountdown={status.canAccept} size="sm" isSuperAdmin={isSuperAdmin} />
          </div>
        ))}
      </div>
    </div>
  );
}
