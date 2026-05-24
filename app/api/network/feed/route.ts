import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Real-time Feed System
 * 
 * รับข้อมูลจากเว็บลูกทั้งหมด และรวบรวมไว้ที่ Master Risk Dashboard
 * - ทุกรายการแทงจากเว็บลูก
 * - ยอดรวมแยกตามเลข
 * - Alert เมื่อเลขใดมียอดเกินกำหนด
 */

interface FeedEntry {
  child_site_id: string;
  child_site_name: string;
  lottery_id: string;
  number: string;
  bet_type: string;
  amount: number;
  customer_id?: string;
  entry_id?: string;
  timestamp: string;
}

// GET - ดึง Feed รวมจากเว็บลูกทั้งหมด (Real-time Dashboard)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const lotteryId = searchParams.get('lottery_id');
    const timeRange = searchParams.get('range') || '1h'; // 1h, 6h, 24h, today
    
    // คำนวณ time filter
    let fromTime = new Date();
    switch (timeRange) {
      case '1h': fromTime.setHours(fromTime.getHours() - 1); break;
      case '6h': fromTime.setHours(fromTime.getHours() - 6); break;
      case '24h': fromTime.setHours(fromTime.getHours() - 24); break;
      case 'today': fromTime.setHours(0, 0, 0, 0); break;
    }

    // ดึงข้อมูล Feed รวม
    let query = supabase
      .from('network_feed')
      .select(`
        *,
        child_sites(name, status)
      `)
      .gte('created_at', fromTime.toISOString())
      .order('created_at', { ascending: false })
      .limit(500);

    if (lotteryId) {
      query = query.eq('lottery_id', lotteryId);
    }

    const { data: feeds, error } = await query;
    if (error) throw error;

    // คำนวณยอดรวมแยกตามเลข
    const volumeByNumber: Record<string, {
      number: string;
      totalAmount: number;
      entryCount: number;
      byBetType: Record<string, number>;
      bySite: Record<string, number>;
    }> = {};

    feeds?.forEach(feed => {
      if (!volumeByNumber[feed.number]) {
        volumeByNumber[feed.number] = {
          number: feed.number,
          totalAmount: 0,
          entryCount: 0,
          byBetType: {},
          bySite: {},
        };
      }

      const vol = volumeByNumber[feed.number];
      vol.totalAmount += Number(feed.amount);
      vol.entryCount += 1;
      vol.byBetType[feed.bet_type] = (vol.byBetType[feed.bet_type] || 0) + Number(feed.amount);
      
      const siteName = feed.child_sites?.name || feed.child_site_id;
      vol.bySite[siteName] = (vol.bySite[siteName] || 0) + Number(feed.amount);
    });

    // เรียงตามยอดมากไปน้อย
    const volumeList = Object.values(volumeByNumber)
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // ดึง Risk Settings เพื่อเช็ค Over-limit
    const { data: riskSettings } = await supabase
      .from('risk_settings')
      .select('*')
      .single();

    const defaultLimit = riskSettings?.default_limit || 50000;

    // Mark Over-limit numbers
    const overLimitNumbers = volumeList
      .filter(v => v.totalAmount >= defaultLimit)
      .map(v => ({
        ...v,
        limitPercent: Math.round((v.totalAmount / defaultLimit) * 100),
        status: v.totalAmount >= defaultLimit * 1.5 ? 'critical' : 
                v.totalAmount >= defaultLimit ? 'warning' : 'normal',
      }));

    // สรุปสถิติ
    const stats = {
      totalEntries: feeds?.length || 0,
      totalVolume: feeds?.reduce((sum, f) => sum + Number(f.amount), 0) || 0,
      uniqueNumbers: Object.keys(volumeByNumber).length,
      overLimitCount: overLimitNumbers.length,
      criticalCount: overLimitNumbers.filter(n => n.status === 'critical').length,
    };

    return NextResponse.json({
      stats,
      overLimitNumbers: overLimitNumbers.slice(0, 20),
      volumeByNumber: volumeList.slice(0, 100),
      recentFeeds: feeds?.slice(0, 50) || [],
    });
  } catch (error: any) {
    console.error('Error fetching network feed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - รับ Feed จากเว็บลูก
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    // Validate API Key
    const apiKey = request.headers.get('X-API-Key');
    const childSiteId = request.headers.get('X-Child-Site-Id');

    if (!apiKey || !childSiteId) {
      return NextResponse.json({ error: 'Missing authentication' }, { status: 401 });
    }

    // Verify child site
    const { data: childSite } = await supabase
      .from('child_sites')
      .select('*')
      .eq('id', childSiteId)
      .eq('api_key', apiKey)
      .single();

    if (!childSite) {
      return NextResponse.json({ error: 'Invalid child site' }, { status: 403 });
    }

    // Insert feed entries
    const entries: FeedEntry[] = Array.isArray(body.entries) ? body.entries : [body];
    
    const feedInserts = entries.map(entry => ({
      child_site_id: childSiteId,
      child_site_name: childSite.name,
      lottery_id: entry.lottery_id,
      number: entry.number,
      bet_type: entry.bet_type,
      amount: entry.amount,
      customer_id: entry.customer_id,
      original_entry_id: entry.entry_id,
      created_at: entry.timestamp || new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('network_feed')
      .insert(feedInserts)
      .select();

    if (error) throw error;

    // Check if any number is now over-limit and trigger alert
    const { data: riskSettings } = await supabase
      .from('risk_settings')
      .select('default_limit')
      .single();

    const limit = riskSettings?.default_limit || 50000;

    // Check volume for submitted numbers
    for (const entry of entries) {
      const { data: volumeCheck } = await supabase
        .from('network_feed')
        .select('amount')
        .eq('number', entry.number)
        .eq('lottery_id', entry.lottery_id);

      const totalVolume = volumeCheck?.reduce((sum, v) => sum + Number(v.amount), 0) || 0;

      if (totalVolume >= limit) {
        // Insert alert
        await supabase.from('risk_alerts').insert({
          type: totalVolume >= limit * 1.5 ? 'critical' : 'warning',
          number: entry.number,
          lottery_id: entry.lottery_id,
          total_volume: totalVolume,
          limit_threshold: limit,
          message: `เลข ${entry.number} มียอดรวม ${totalVolume.toLocaleString()} บาท (เกิน ${Math.round((totalVolume / limit) * 100)}%)`,
          created_at: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      received: data?.length || 0,
    });
  } catch (error: any) {
    console.error('Error receiving feed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
