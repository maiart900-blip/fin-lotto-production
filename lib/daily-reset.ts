/**
 * Daily Reset Utility
 * ระบบจะรีเซ็ตยอดวันใหม่หลัง 01:00 น. (Thailand Time)
 * 
 * เช่น:
 * - เวลา 00:30 น. วันที่ 15 พ.ค. -> ยังถือเป็น "วันที่ 14 พ.ค." 
 * - เวลา 01:30 น. วันที่ 15 พ.ค. -> เริ่มนับเป็น "วันที่ 15 พ.ค."
 */

// Thailand timezone offset: UTC+7
const THAILAND_OFFSET_HOURS = 7;

// Daily reset time: 01:00 AM Thailand time
const RESET_HOUR = 1;

/**
 * Get current Thailand time
 */
export function getThailandTime(): Date {
  const now = new Date();
  // Convert to Thailand time by adding 7 hours to UTC
  const thailandTime = new Date(now.getTime() + (THAILAND_OFFSET_HOURS * 60 * 60 * 1000));
  return thailandTime;
}

/**
 * Get the "business day" date string based on Thailand time and 01:00 reset
 * Before 01:00 AM = previous day
 * After 01:00 AM = current day
 */
export function getBusinessDay(date?: Date): string {
  const now = date || new Date();
  
  // Convert to Thailand time
  const thailandTime = new Date(now.getTime() + (THAILAND_OFFSET_HOURS * 60 * 60 * 1000));
  
  // Get current hour in Thailand time
  const currentHour = thailandTime.getUTCHours();
  
  // If before reset hour (01:00), treat as previous day
  if (currentHour < RESET_HOUR) {
    thailandTime.setUTCDate(thailandTime.getUTCDate() - 1);
  }
  
  // Return YYYY-MM-DD format
  return thailandTime.toISOString().split('T')[0];
}

/**
 * Get yesterday's business day
 */
export function getYesterdayBusinessDay(): string {
  const today = getBusinessDay();
  const todayDate = new Date(today);
  todayDate.setDate(todayDate.getDate() - 1);
  return todayDate.toISOString().split('T')[0];
}

/**
 * Get the start datetime of a business day (01:00 Thailand time in UTC)
 */
export function getBusinessDayStart(dateString: string): string {
  // Business day starts at 01:00 Thailand time
  // Which is 01:00 - 7 hours = 18:00 previous day UTC
  const date = new Date(dateString);
  const prevDay = new Date(date);
  prevDay.setDate(prevDay.getDate() - 1);
  
  return `${prevDay.toISOString().split('T')[0]}T18:00:00Z`;
}

/**
 * Get the end datetime of a business day (00:59:59 next day Thailand time in UTC)
 */
export function getBusinessDayEnd(dateString: string): string {
  // Business day ends at 00:59:59 next day Thailand time
  // Which is 00:59:59 - 7 hours = 17:59:59 same day UTC
  return `${dateString}T17:59:59Z`;
}

/**
 * Get today's date range for database queries
 * Returns { start, end } in ISO format for Supabase queries
 */
export function getTodayDateRange(): { start: string; end: string } {
  const businessDay = getBusinessDay();
  return {
    start: getBusinessDayStart(businessDay),
    end: getBusinessDayEnd(businessDay),
  };
}

/**
 * Get yesterday's date range for database queries
 */
export function getYesterdayDateRange(): { start: string; end: string } {
  const yesterday = getYesterdayBusinessDay();
  return {
    start: getBusinessDayStart(yesterday),
    end: getBusinessDayEnd(yesterday),
  };
}

/**
 * Get date range for a specific period
 */
export function getDateRange(period: 'today' | 'yesterday' | '7days' | '30days' | 'this_month'): { start: string; end: string } {
  const today = getBusinessDay();
  const todayRange = getTodayDateRange();
  
  switch (period) {
    case 'today':
      return todayRange;
      
    case 'yesterday':
      return getYesterdayDateRange();
      
    case '7days': {
      const date7 = new Date(today);
      date7.setDate(date7.getDate() - 6);
      return {
        start: getBusinessDayStart(date7.toISOString().split('T')[0]),
        end: todayRange.end,
      };
    }
    
    case '30days': {
      const date30 = new Date(today);
      date30.setDate(date30.getDate() - 29);
      return {
        start: getBusinessDayStart(date30.toISOString().split('T')[0]),
        end: todayRange.end,
      };
    }
    
    case 'this_month': {
      const monthStart = today.slice(0, 7) + '-01';
      return {
        start: getBusinessDayStart(monthStart),
        end: todayRange.end,
      };
    }
    
    default:
      return todayRange;
  }
}

/**
 * Format Thailand time for display
 */
export function formatThailandTime(date?: Date): string {
  const d = date || new Date();
  return d.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format date for display in Thai
 */
export function formatThaiDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Check if current time is before daily reset (before 01:00 AM Thailand)
 */
export function isBeforeDailyReset(): boolean {
  const thailandTime = getThailandTime();
  return thailandTime.getUTCHours() < RESET_HOUR;
}

/**
 * Get time remaining until next reset
 */
export function getTimeUntilReset(): { hours: number; minutes: number; seconds: number } {
  const thailandTime = getThailandTime();
  const currentHour = thailandTime.getUTCHours();
  const currentMinute = thailandTime.getUTCMinutes();
  const currentSecond = thailandTime.getUTCSeconds();
  
  let hoursUntil: number;
  if (currentHour < RESET_HOUR) {
    hoursUntil = RESET_HOUR - currentHour - 1;
  } else {
    hoursUntil = 24 - currentHour + RESET_HOUR - 1;
  }
  
  const minutesUntil = 59 - currentMinute;
  const secondsUntil = 59 - currentSecond;
  
  return {
    hours: hoursUntil,
    minutes: minutesUntil,
    seconds: secondsUntil,
  };
}
