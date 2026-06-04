/**
 * API: Aggregated Risk Volume - SUPER_ADMIN ONLY
 * 
 * ดึงยอดแทงรวมจากทุก tenant_id และทุก agent_id มาคำนวณเลขเต็ม
 * ใช้สำหรับ Risk Management ของเว็บแม่เท่านั้น
 * 
 * ตามกฎเหล็กข้อ 2: SUPER_ADMIN เห็นข้อมูลทั้งหมด (db.fetchAllData)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

interface NumberVolume {
  number: string;
  entry_type: string;
  total_amount: number;
  bet_count: number;
  potential_payout: number;
  profit_loss: number;
  risk_level: 'normal' | 'warning' | 'danger' | 'critical';
  sources: {
    manual_key_amount: number;
    auto_amount: number;
    agent_count: number;
    tenant_count: number;
  };
}

interface AggregatedSummary {
  total_bets: number;
  total_amount: number;
  potential_payout: number;
  net_exposure: number;
  high_risk_numbers: number;
  critical_numbers: number;
  by_source: {
    manual_key: { count: number; amount: number };
    auto: { count: number; amount: number };
  };
  by_entry_type: Record<string, { count: number; amount: number }>;
}

// อัตราจ่ายตามประเภท
const PAYOUT_RATES: Record<string, number> = {
  'three_top': 800,
  'three_tod': 120,
  'two_top': 90,
  'two_bottom': 90,
  'run_top': 3.2,
  'run_bottom': 4.2,
};

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient();
    
    // ตรวจสอบ session และ role
    const sessionCookie = cookieStore.get('user_role')?.value;
    const userIdCookie = cookieStore.get('user_id')?.value;
    
    // กฎเหล็ก: เฉพาะ SUPER_ADMIN เท่านั้น
    if (sessionCookie !== 'super_admin' && sessionCookie !== 'admin') {
      return NextResponse.json(
        { error: 'ACCESS_DENIED', message: 'เฉพาะ Super Admin เท่านั้นที่เข้าถึงได้' },
        { status: 403 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const lotteryId = searchParams.get('lottery_id');
    const entryType = searchParams.get('entry_type');
    const dateFrom = searchParams.get('date_from') || new Date().toISOString().split('T')[0];
    const dateTo = searchParams.get('date_to') || new Date().toISOString().split('T')[0];
    const limit = parseInt(searchParams.get('limit') || '100');
    
    // Query 1: ดึงข้อมูลจาก entries table (ทุก tenant, ทุก agent)
    let entriesQuery = supabase
      .from('entries')
      .select(`
        id,
        numbers,
        bet_type,
        amount,
        lottery_id,
        agent_id,
        tenant_id,
        source_type,
        created_at
      `)
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`)
      .in('status', ['pending', 'active']);
    
    if (lotteryId) {
      entriesQuery = entriesQuery.eq('lottery_id', lotteryId);
    }
    
    if (entryType && entryType !== 'all') {
      entriesQuery = entriesQuery.eq('bet_type', entryType);
    }
    
    const { data: entries, error: entriesError } = await entriesQuery;
    
    if (entriesError) {
      console.error('[Risk Aggregated] Entries query error:', entriesError);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }
    
    // Aggregate ข้อมูลตามเลข
    const numberMap = new Map<string, NumberVolume>();
    const summary: AggregatedSummary = {
      total_bets: 0,
      total_amount: 0,
      potential_payout: 0,
      net_exposure: 0,
      high_risk_numbers: 0,
      critical_numbers: 0,
      by_source: {
        manual_key: { count: 0, amount: 0 },
        auto: { count: 0, amount: 0 },
      },
      by_entry_type: {},
    };
    
    const uniqueAgents = new Set<string>();
    const uniqueTenants = new Set<string>();
    
    for (const entry of entries || []) {
      const number = entry.numbers || '';
      const entryType = entry.bet_type || 'unknown';
      const amount = Number(entry.amount) || 0;
      const sourceType = entry.source_type || 'manual_key';
      const rate = PAYOUT_RATES[entryType] || 1;
      const payout = amount * rate;
      
      // Track unique sources
      if (entry.agent_id) uniqueAgents.add(entry.agent_id);
      if (entry.tenant_id) uniqueTenants.add(entry.tenant_id);
      
      // Update summary
      summary.total_bets++;
      summary.total_amount += amount;
      summary.potential_payout += payout;
      
      // By source type
      if (sourceType === 'manual_key' || sourceType === 'keyin') {
        summary.by_source.manual_key.count++;
        summary.by_source.manual_key.amount += amount;
      } else {
        summary.by_source.auto.count++;
        summary.by_source.auto.amount += amount;
      }
      
      // By entry type
      if (!summary.by_entry_type[entryType]) {
        summary.by_entry_type[entryType] = { count: 0, amount: 0 };
      }
      summary.by_entry_type[entryType].count++;
      summary.by_entry_type[entryType].amount += amount;
      
      // Aggregate by number
      const key = `${number}-${entryType}`;
      const existing = numberMap.get(key);
      
      if (existing) {
        existing.total_amount += amount;
        existing.bet_count++;
        existing.potential_payout += payout;
        existing.profit_loss = existing.total_amount - existing.potential_payout;
        
        // Track sources
        if (sourceType === 'manual_key' || sourceType === 'keyin') {
          existing.sources.manual_key_amount += amount;
        } else {
          existing.sources.auto_amount += amount;
        }
        if (entry.agent_id) existing.sources.agent_count++;
        if (entry.tenant_id) existing.sources.tenant_count++;
      } else {
        numberMap.set(key, {
          number,
          entry_type: entryType,
          total_amount: amount,
          bet_count: 1,
          potential_payout: payout,
          profit_loss: amount - payout,
          risk_level: 'normal',
          sources: {
            manual_key_amount: (sourceType === 'manual_key' || sourceType === 'keyin') ? amount : 0,
            auto_amount: (sourceType !== 'manual_key' && sourceType !== 'keyin') ? amount : 0,
            agent_count: entry.agent_id ? 1 : 0,
            tenant_count: entry.tenant_id ? 1 : 0,
          },
        });
      }
    }
    
    // Calculate risk levels and sort
    const numbers = Array.from(numberMap.values()).map(n => {
      // Risk level based on potential loss
      if (n.profit_loss < -50000) n.risk_level = 'critical';
      else if (n.profit_loss < -20000) n.risk_level = 'danger';
      else if (n.profit_loss < -10000) n.risk_level = 'warning';
      
      if (n.risk_level === 'critical') summary.critical_numbers++;
      if (n.risk_level === 'danger' || n.risk_level === 'warning') summary.high_risk_numbers++;
      
      return n;
    });
    
    // Sort by profit_loss (most negative first = highest risk)
    numbers.sort((a, b) => a.profit_loss - b.profit_loss);
    
    // Calculate net exposure
    summary.net_exposure = summary.total_amount - summary.potential_payout;
    
    return NextResponse.json({
      success: true,
      data: {
        numbers: numbers.slice(0, limit),
        summary,
        meta: {
          total_unique_agents: uniqueAgents.size,
          total_unique_tenants: uniqueTenants.size,
          date_from: dateFrom,
          date_to: dateTo,
          lottery_id: lotteryId || 'all',
          generated_at: new Date().toISOString(),
        },
      },
    });
    
  } catch (error) {
    console.error('[Risk Aggregated] Error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
