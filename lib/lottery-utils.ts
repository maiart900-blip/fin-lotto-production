'use client';

// NEW STATUS SYSTEM: เปิดรับล่วงหน้า, ใกล้ปิดงวด, ปิดงวด, ออกผลแล้ว
export type LotteryStatus = 'advance_open' | 'closing_soon' | 'round_closed' | 'result_announced';

export interface Lottery {
  id: string;
  name: string;
  icon?: string;
  is_active: boolean;
  is_closed_temp?: boolean;
  draw_type: 'daily' | 'weekdays' | 'weekend' | 'specific';
  draw_days: string[];
  open_time: string;
  close_time: string;
  result_time?: string;
  note: string | null;
  sort_order: number;
  timezone?: string;
  // New fields for advance purchase system
  allow_advance_purchase?: boolean;
  auto_next_round?: boolean;
  super_admin_override?: boolean;
  last_result_date?: string;
}

const DAY_MAP: Record<number, string> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

// Get current time in Bangkok timezone
export function getBangkokTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
}

// Parse time string (HH:MM) to minutes since midnight
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Check if today is a valid draw day for this lottery
export function isValidDrawDay(lottery: Lottery): boolean {
  const now = getBangkokTime();
  const dayOfWeek = now.getDay();
  const dayOfMonth = now.getDate().toString();
  const dayName = DAY_MAP[dayOfWeek];

  switch (lottery.draw_type) {
    case 'daily':
      return true;
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'weekend':
      return dayOfWeek === 0 || dayOfWeek === 6;
    case 'specific':
      return lottery.draw_days?.includes(dayOfMonth) || false;
    default:
      return lottery.draw_days?.includes(dayName) || false;
  }
}

// Get next draw date for this lottery
export function getNextDrawDate(lottery: Lottery): Date {
  const now = getBangkokTime();
  const dayOfWeek = now.getDay();
  
  // For daily lottery, next is always tomorrow if today's round is closed
  if (lottery.draw_type === 'daily') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  
  // For other types, find the next valid draw day
  for (let i = 1; i <= 7; i++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + i);
    const checkDayOfWeek = checkDate.getDay();
    const checkDayName = DAY_MAP[checkDayOfWeek];
    
    if (lottery.draw_type === 'weekdays' && checkDayOfWeek >= 1 && checkDayOfWeek <= 5) {
      return checkDate;
    }
    if (lottery.draw_type === 'weekend' && (checkDayOfWeek === 0 || checkDayOfWeek === 6)) {
      return checkDate;
    }
    if (lottery.draw_days?.includes(checkDayName)) {
      return checkDate;
    }
  }
  
  return now; // Fallback
}

// NEW: Get lottery status with advance purchase logic
// Customers can ALWAYS buy in advance, only blocked when round is closed or result announced for that round
export function getLotteryStatus(lottery: Lottery, isSuperAdmin: boolean = false): {
  status: LotteryStatus;
  statusText: string;
  countdown: number | null; // minutes until close
  canAccept: boolean;
  isClosingSoon?: boolean;
  currentRound: 'today' | 'next';
  nextDrawDate?: Date;
} {
  // If lottery is not active or temporarily closed
  if (!lottery.is_active || lottery.is_closed_temp) {
    // Super admin can override
    if (isSuperAdmin && lottery.super_admin_override !== false) {
      return {
        status: 'round_closed',
        statusText: lottery.is_closed_temp ? 'ปิดชั่วคราว (Super Admin ยังคีย์ได้)' : 'ปิดใช้งาน',
        countdown: null,
        canAccept: isSuperAdmin,
        currentRound: 'today',
      };
    }
    return {
      status: 'round_closed',
      statusText: lottery.is_closed_temp ? 'ปิดรับชั่วคราว' : 'ปิดใช้งาน',
      countdown: null,
      canAccept: false,
      currentRound: 'today',
    };
  }

  const now = getBangkokTime();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayStr = now.toISOString().split('T')[0];
  
  const closeMinutes = timeToMinutes(lottery.close_time?.slice(0, 5) || '14:00');
  const resultMinutes = lottery.result_time ? timeToMinutes(lottery.result_time.slice(0, 5)) : closeMinutes + 30;
  
  // Handle overnight lottery
  const openMinutes = timeToMinutes(lottery.open_time?.slice(0, 5) || '06:00');
  const isOvernight = closeMinutes < openMinutes;
  
  // Check if today is a valid draw day
  const isDrawDay = isValidDrawDay(lottery);
  
  // Calculate minutes until close
  let minutesUntilClose = 0;
  if (isOvernight) {
    if (currentMinutes >= openMinutes) {
      minutesUntilClose = (24 * 60 - currentMinutes) + closeMinutes;
    } else if (currentMinutes < closeMinutes) {
      minutesUntilClose = closeMinutes - currentMinutes;
    }
  } else {
    minutesUntilClose = closeMinutes - currentMinutes;
  }

  // LOGIC: ถ้าผ่าน result_time แล้ว = ออกผลแล้ว → เปิดรับงวดถัดไป
  if (isDrawDay && currentMinutes >= resultMinutes && !isOvernight) {
    const nextDrawDate = getNextDrawDate(lottery);
    return {
      status: 'result_announced',
      statusText: 'ออกผลแล้ว / เปิดงวดถัดไป',
      countdown: null,
      canAccept: true, // Can buy for next round
      currentRound: 'next',
      nextDrawDate,
    };
  }

  // LOGIC: ถ้าผ่าน close_time แล้ว แต่ยังไม่ถึง result_time = ปิดงวด
  if (isDrawDay && currentMinutes >= closeMinutes && currentMinutes < resultMinutes && !isOvernight) {
    // Super admin can still accept
    if (isSuperAdmin && lottery.super_admin_override !== false) {
      return {
        status: 'round_closed',
        statusText: 'ปิดงวด (Super Admin ยังคีย์ได้)',
        countdown: null,
        canAccept: true,
        currentRound: 'today',
      };
    }
    return {
      status: 'round_closed',
      statusText: 'ปิดงวด',
      countdown: null,
      canAccept: false,
      currentRound: 'today',
    };
  }

  // LOGIC: ใกล้ปิดงวด (ภายใน 5 นาที)
  if (isDrawDay && minutesUntilClose <= 5 && minutesUntilClose > 0) {
    return {
      status: 'closing_soon',
      statusText: `ใกล้ปิดงวด (${minutesUntilClose} นาที)`,
      countdown: minutesUntilClose,
      canAccept: true,
      isClosingSoon: true,
      currentRound: 'today',
    };
  }

  // LOGIC: เปิดรับล่วงหน้า - DEFAULT STATE
  // ลูกค้าซื้อได้ตลอดเวลา ไม่ต้องรอเวลาเปิด
  return {
    status: 'advance_open',
    statusText: 'เปิดรับล่วงหน้า',
    countdown: minutesUntilClose > 0 ? minutesUntilClose : null,
    canAccept: true,
    isClosingSoon: false,
    currentRound: isDrawDay && minutesUntilClose > 0 ? 'today' : 'next',
    nextDrawDate: !isDrawDay ? getNextDrawDate(lottery) : undefined,
  };
}

// Calculate which round an entry should belong to
export function getEntryRound(lottery: Lottery): {
  roundDate: Date;
  roundLabel: string;
} {
  const now = getBangkokTime();
  const status = getLotteryStatus(lottery);
  
  if (status.currentRound === 'next' && status.nextDrawDate) {
    return {
      roundDate: status.nextDrawDate,
      roundLabel: `งวด ${status.nextDrawDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    };
  }
  
  return {
    roundDate: now,
    roundLabel: `งวดวันนี้ ${now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`,
  };
}

// Format countdown display
export function formatTimeRemaining(minutes: number): string {
  if (minutes <= 0) return '00:00';
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  const secs = Math.floor((minutes % 1) * 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatCountdown(minutes: number | null): string {
  if (minutes === null) return '';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours} ชม. ${mins} น.`;
  }
  return `${mins} นาที`;
}

// Get status badge color - Updated for new statuses
export function getStatusColor(status: LotteryStatus): string {
  switch (status) {
    case 'advance_open':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'closing_soon':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse';
    case 'round_closed':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'result_announced':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

// Status labels for display
export const LOTTERY_STATUS_LABELS: Record<LotteryStatus, string> = {
  'advance_open': 'เปิดรับล่วงหน้า',
  'closing_soon': 'ใกล้ปิดงวด',
  'round_closed': 'ปิดงวด',
  'result_announced': 'ออกผลแล้ว',
};
