'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  targetDate: Date | string;
  onExpire?: () => void;
  compact?: boolean;
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function calculateTimeLeft(targetDate: Date): TimeLeft {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    expired: false,
  };
}

export function CountdownTimer({
  targetDate,
  onExpire,
  compact = false,
  className,
}: CountdownTimerProps) {
  const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(target));

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(target);
      setTimeLeft(newTimeLeft);

      if (newTimeLeft.expired) {
        clearInterval(timer);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [target, onExpire]);

  if (timeLeft.expired) {
    return (
      <span className={cn('text-red-400 font-medium', className)}>
        ปิดรับแล้ว
      </span>
    );
  }

  if (compact) {
    // Compact format: "1d 2h 30m" or "2:30:15"
    if (timeLeft.days > 0) {
      return (
        <span className={cn('text-yellow-400 font-mono text-sm', className)}>
          {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m
        </span>
      );
    }
    return (
      <span className={cn('text-yellow-400 font-mono text-sm', className)}>
        {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
      </span>
    );
  }

  // Full format with boxes
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {timeLeft.days > 0 && (
        <>
          <TimeBox value={timeLeft.days} label="วัน" />
          <span className="text-gray-400">:</span>
        </>
      )}
      <TimeBox value={timeLeft.hours} label="ชม." />
      <span className="text-gray-400">:</span>
      <TimeBox value={timeLeft.minutes} label="นาที" />
      <span className="text-gray-400">:</span>
      <TimeBox value={timeLeft.seconds} label="วิ" />
    </div>
  );
}

function TimeBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-white/10 rounded px-2 py-1 min-w-[36px] text-center">
        <span className="text-white font-mono font-bold">
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span className="text-[10px] text-gray-400 mt-0.5">{label}</span>
    </div>
  );
}
