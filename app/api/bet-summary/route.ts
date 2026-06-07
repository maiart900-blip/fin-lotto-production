import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentOrHigher } from '@/lib/api-auth';

// ===== BET SUMMARY API =====
// ระบบกลางคำนวณยอดแทง - ทุกหน้าต้องใช้ API นี้เท่านั้น
// ห้ามคำนวณยอดแทงเองในแต่ละหน้า

interface BetSummaryParams {
  // Filter
  date?: string;           // วันที่เฉพาะ (YYYY-MM-DD)
  startDate?: string;      // ช่วงวันที่เริ่ม
  endDate?: string;        // ช่วงวันที่สิ้นสุด
  lotteryId?: string;      // หวยเฉพาะ
  ownerId?: string;        // เจ้าของ (agent/staff)
  source?: 'auto' | 'manual_key' | 'all';  // แหล่งที่มา
  customerId?: string;     // ลูกค้าเฉพาะ
  
  // Options
  includeDebug?: boolean;  // แสดง debug info
  groupBy?: 'lottery' | 'date' | 'source' | 'owner';
}

interface BetSummaryResult {
  // ยอดรวมทั้งหมด
  totalAmount: number;
  totalCount: number;
  
  // ยอดวันนี้
  todayAmount: number;
  todayCount: number;
  
  // แยกตาม source
  autoAmount: number;
  autoCount: number;
  manualKeyAmount: number;
  manualKeyCount: number;
  
  // สถานะ
  pendingAmount: number;
  wonAmount: number;
  lostAmount: number;
  
  // รางวัล
  totalPayoutAmount: number;
  pendingPayoutAmount: number;
  
  // กำไร/ขาดทุน
  profitLoss: number;
  
  // Debug info
  debug?: {
    tablesUsed: string[];
    entriesFound: number;
    betsFound: number;
    betItemsFound: number;
    todayEntriesFound: number;
    todayBetsFound: number;
    dateFilter: string;
    statusFilter: string[];
    sourceFilter: string;
    ownerFilter: string | null;
    errors: string[];
  };
}

// Normalize date - รองรับหลาย format
function normalizeDate(dateStr: string): string {
  if (!dateStr) return '';
  
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('/');
    return `${y}-${m}-${d}`;
  }
  
  // Thai date (21 พ.ค. 2569)
  const thaiMonths: { [key: string]: string } = {
    'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04',
    'พ.ค.': '05', 'มิ.ย.': '06', 'ก.ค.': '07', 'ส.ค.': '08',
    'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12',
  };
  
  for (const [thai, num] of Object.entries(thaiMonths)) {
    if (dateStr.includes(thai)) {
      const match = dateStr.match(/(\d{1,2})\s*\S+\s*(\d{4})/);
      if (match) {
        const day = match[1].padStart(2, '0');
        const year = parseInt(match[2]) > 2500 ? parseInt(match[2]) - 543 : parseInt(match[2]);
        return `${year}-${num}-${day}`;
      }
    }
  }
  
  // Try Date parse
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {}
  
  return dateStr;
}

// Get today's date in YYYY-MM-DD format (Bangkok timezone)
function getTodayDate(): string {
  const now = new Date();
  // Adjust to Bangkok timezone (UTC+7)
  const bangkokTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  return bangkokTime.toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
  try {
    // Auth guard - require agent or higher
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // Parse params
    const params: BetSummaryParams = {
      date: searchParams.get('date') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      lotteryId: searchParams.get('lotteryId') || undefined,
      ownerId: searchParams.get('ownerId') || undefined,
      source: (searchParams.get('source') as any) || 'all',
      customerId: searchParams.get('customerId') || undefined,
      includeDebug: searchParams.get('debug') === 'true',
      groupBy: (searchParams.get('groupBy') as any) || undefined,
    };
    
    const today = getTodayDate();
    const todayStart = `${today}T00:00:00`;
    const todayEnd = `${today}T23:59:59`;
    
    const debug = {
      tablesUsed: [] as string[],
      entriesFound: 0,
      betsFound: 0,
      betItemsFound: 0,
      todayEntriesFound: 0,
      todayBetsFound: 0,
      dateFilter: params.date || `${params.startDate || 'all'} to ${params.endDate || 'all'}`,
      statusFilter: ['pending', 'confirmed', 'active', 'waiting_result', 'won', 'lost', 'completed'],
      sourceFilter: params.source || 'all',
      ownerFilter: params.ownerId || null,
      errors: [] as string[],
    };
    
    // ===== QUERY ENTRIES TABLE =====
    // Note: source และ owner_id อาจไม่มีใน table เก่า - select เฉพาะ columns ที่มี
    let entriesQuery = supabase
      .from('entries')
      .select('id, amount, status, payout_amount, lottery_id, created_at')
      .in('status', ['pending', 'confirmed', 'active', 'waiting_result', 'won', 'lost', 'completed']);
    
    if (params.lotteryId) {
      entriesQuery = entriesQuery.eq('lottery_id', params.lotteryId);
    }
    if (params.date) {
      const normalizedDate = normalizeDate(params.date);
      entriesQuery = entriesQuery.gte('created_at', `${normalizedDate}T00:00:00`).lt('created_at', `${normalizedDate}T23:59:59`);
    }
    
    const { data: entries, error: entriesError } = await entriesQuery;
    
    if (entriesError) {
      debug.errors.push(`entries: ${entriesError.message}`);
    }
    
    debug.tablesUsed.push('entries');
    debug.entriesFound = entries?.length || 0;
    
    // ===== QUERY BETS TABLE =====
    // Note: source และ owner_id อาจไม่มีใน table เก่า - select เฉพาะ columns ที่มี
    let betsQuery = supabase
      .from('bets')
      .select('id, total_amount, status, customer_id, lottery_id, created_at, is_checked, total_win_amount')
      .in('status', ['pending', 'confirmed', 'active', 'waiting_result', 'won', 'lost', 'completed']);
    
    if (params.lotteryId) {
      betsQuery = betsQuery.eq('lottery_id', params.lotteryId);
    }
    if (params.customerId) {
      betsQuery = betsQuery.eq('customer_id', params.customerId);
    }
    if (params.date) {
      const normalizedDate = normalizeDate(params.date);
      betsQuery = betsQuery.gte('created_at', `${normalizedDate}T00:00:00`).lt('created_at', `${normalizedDate}T23:59:59`);
    }
    
    const { data: bets, error: betsError } = await betsQuery;
    
    if (betsError) {
      debug.errors.push(`bets: ${betsError.message}`);
    }
    
    debug.tablesUsed.push('bets');
    debug.betsFound = bets?.length || 0;
    
    // ===== QUERY TODAY'S DATA =====
    const { data: todayEntries } = await supabase
      .from('entries')
      .select('id, amount, status, payout_amount')
      .gte('created_at', todayStart)
      .lt('created_at', todayEnd)
      .in('status', ['pending', 'confirmed', 'active', 'waiting_result', 'won', 'lost', 'completed']);
    
    const { data: todayBets } = await supabase
      .from('bets')
      .select('id, total_amount, status, total_win_amount')
      .gte('created_at', todayStart)
      .lt('created_at', todayEnd)
      .in('status', ['pending', 'confirmed', 'active', 'waiting_result', 'won', 'lost', 'completed']);
    
    debug.todayEntriesFound = todayEntries?.length || 0;
    debug.todayBetsFound = todayBets?.length || 0;
    
    // ===== CALCULATE TOTALS =====
    
    // From entries
    const entriesTotal = (entries || []).reduce((sum, e) => sum + (e.amount || 0), 0);
    const entriesCount = entries?.length || 0;
    const entriesPendingTotal = (entries || []).filter(e => ['pending', 'confirmed', 'active', 'waiting_result'].includes(e.status)).reduce((sum, e) => sum + (e.amount || 0), 0);
    const entriesWonTotal = (entries || []).filter(e => e.status === 'won').reduce((sum, e) => sum + (e.amount || 0), 0);
    const entriesLostTotal = (entries || []).filter(e => e.status === 'lost').reduce((sum, e) => sum + (e.amount || 0), 0);
    const entriesPayoutTotal = (entries || []).filter(e => e.status === 'won').reduce((sum, e) => sum + (e.payout_amount || 0), 0);
    
    // From bets
    const betsTotal = (bets || []).reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const betsCount = bets?.length || 0;
    const betsPendingTotal = (bets || []).filter(b => ['pending', 'confirmed', 'active', 'waiting_result'].includes(b.status)).reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const betsWonTotal = (bets || []).filter(b => b.status === 'won').reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const betsLostTotal = (bets || []).filter(b => b.status === 'lost').reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const betsPayoutTotal = (bets || []).filter(b => b.status === 'won').reduce((sum, b) => sum + (b.total_win_amount || 0), 0);
    
    // Today totals
    const todayEntriesTotal = (todayEntries || []).reduce((sum, e) => sum + (e.amount || 0), 0);
    const todayBetsTotal = (todayBets || []).reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const todayPayoutTotal = (todayEntries || []).filter(e => e.status === 'won').reduce((sum, e) => sum + (e.payout_amount || 0), 0) +
                            (todayBets || []).filter(b => b.status === 'won').reduce((sum, b) => sum + (b.total_win_amount || 0), 0);
    
    // Combined totals
    const totalAmount = entriesTotal + betsTotal;
    const totalCount = entriesCount + betsCount;
    const todayAmount = todayEntriesTotal + todayBetsTotal;
    const todayCount = (todayEntries?.length || 0) + (todayBets?.length || 0);
    // Note: source column ไม่มี - ใช้ default เป็น manual_key ทั้งหมด (เพราะส่วนใหญ่เป็นระบบ key)
    const autoAmount = 0; // TODO: เพิ่ม source column แล้วค่อยคำนวณ
    const autoCount = 0;
    const manualKeyAmount = totalAmount; // ถือว่าทั้งหมดเป็น manual_key
    const manualKeyCount = totalCount;
    const pendingAmount = entriesPendingTotal + betsPendingTotal;
    const wonAmount = entriesWonTotal + betsWonTotal;
    const lostAmount = entriesLostTotal + betsLostTotal;
    const totalPayoutAmount = entriesPayoutTotal + betsPayoutTotal;
    
    // Calculate pending payout (entries ที่ status=won แต่ยังไม่จ่าย)
    const pendingPayoutAmount = (entries || []).filter(e => e.status === 'won' && e.payout_amount > 0).reduce((sum, e) => sum + (e.payout_amount || 0), 0);
    
    // Profit/Loss = ยอดเดิมพัน - ยอดจ่ายรางวัล
    const profitLoss = totalAmount - totalPayoutAmount;
    
    const result: BetSummaryResult = {
      totalAmount,
      totalCount,
      todayAmount,
      todayCount,
      autoAmount,
      autoCount,
      manualKeyAmount,
      manualKeyCount,
      pendingAmount,
      wonAmount,
      lostAmount,
      totalPayoutAmount,
      pendingPayoutAmount,
      profitLoss,
    };
    
    if (params.includeDebug) {
      result.debug = debug;
    }
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('Bet summary error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to get bet summary',
      totalAmount: 0,
      totalCount: 0,
      todayAmount: 0,
      todayCount: 0,
    }, { status: 500 });
  }
}
