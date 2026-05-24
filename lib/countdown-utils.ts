'use client';

// Countdown utilities with NaN protection and Bangkok timezone support

/**
 * Parse close time (HH:MM or HH:MM:SS or full ISO date) to Bangkok timezone Date
 * Returns null if invalid
 */
export function parseCloseTime(closeTime: string | null | undefined): Date | null {
  if (!closeTime || typeof closeTime !== 'string') {
    return null;
  }

  try {
    // Get current date in Bangkok timezone
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    
    // If it's just time format (HH:MM or HH:MM:SS)
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(closeTime)) {
      const [hours, minutes] = closeTime.split(':').map(Number);
      
      // Validate hours and minutes
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
      }
      
      const closeDate = new Date(now);
      closeDate.setHours(hours, minutes, 0, 0);
      return closeDate;
    }
    
    // If it's ISO date format
    const parsed = new Date(closeTime);
    if (isNaN(parsed.getTime())) {
      return null;
    }
    
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Calculate time difference in milliseconds
 * Returns 0 if already passed or invalid
 */
export function getTimeDiff(closeTime: string | null | undefined): number {
  const closeDate = parseCloseTime(closeTime);
  if (!closeDate) return 0;
  
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const diff = closeDate.getTime() - now.getTime();
  
  return diff > 0 ? diff : 0;
}

/**
 * Get countdown status
 */
export type CountdownStatus = 'open' | 'closing' | 'closed' | 'unknown';

export function getCountdownStatus(closeTime: string | null | undefined): CountdownStatus {
  if (!closeTime) return 'unknown';
  
  const diff = getTimeDiff(closeTime);
  
  if (diff <= 0) return 'closed';
  if (diff <= 30 * 60 * 1000) return 'closing'; // 30 minutes
  return 'open';
}

/**
 * Parse time diff to hours, minutes, seconds
 * Always returns valid numbers (0 if invalid)
 */
export function parseTimeDiff(diff: number): { hours: number; minutes: number; seconds: number } {
  if (!diff || isNaN(diff) || diff < 0) {
    return { hours: 0, minutes: 0, seconds: 0 };
  }
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return {
    hours: isNaN(hours) ? 0 : hours,
    minutes: isNaN(minutes) ? 0 : minutes,
    seconds: isNaN(seconds) ? 0 : seconds,
  };
}

/**
 * Format countdown display (HH:MM:SS)
 * Returns fallback string if invalid
 */
export function formatCountdownDisplay(
  closeTime: string | null | undefined,
  options?: {
    closedText?: string;
    unknownText?: string;
    showHoursAlways?: boolean;
  }
): string {
  const {
    closedText = 'ปิดรับแล้ว',
    unknownText = '--:--:--',
    showHoursAlways = true,
  } = options || {};

  if (!closeTime) return unknownText;
  
  const diff = getTimeDiff(closeTime);
  if (diff <= 0) return closedText;
  
  const { hours, minutes, seconds } = parseTimeDiff(diff);
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  if (showHoursAlways || hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Get status color based on countdown status
 */
export function getCountdownStatusColor(status: CountdownStatus): {
  bg: string;
  text: string;
  border: string;
  animate?: string;
} {
  switch (status) {
    case 'open':
      return {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
      };
    case 'closing':
      return {
        bg: 'bg-amber-500/20',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        animate: 'animate-pulse',
      };
    case 'closed':
      return {
        bg: 'bg-red-500/20',
        text: 'text-red-400',
        border: 'border-red-500/30',
      };
    default:
      return {
        bg: 'bg-slate-500/20',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
      };
  }
}

/**
 * Hook-safe countdown state
 */
export interface CountdownState {
  hours: number;
  minutes: number;
  seconds: number;
  status: CountdownStatus;
  display: string;
  isValid: boolean;
}

export function calculateCountdownState(closeTime: string | null | undefined): CountdownState {
  if (!closeTime) {
    return {
      hours: 0,
      minutes: 0,
      seconds: 0,
      status: 'unknown',
      display: '--:--:--',
      isValid: false,
    };
  }
  
  const diff = getTimeDiff(closeTime);
  const status = getCountdownStatus(closeTime);
  const { hours, minutes, seconds } = parseTimeDiff(diff);
  
  let display: string;
  if (status === 'closed') {
    display = 'ปิดรับแล้ว';
  } else if (status === 'unknown') {
    display = '--:--:--';
  } else {
    const pad = (n: number) => n.toString().padStart(2, '0');
    display = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  
  return {
    hours,
    minutes,
    seconds,
    status,
    display,
    isValid: status !== 'unknown',
  };
}
