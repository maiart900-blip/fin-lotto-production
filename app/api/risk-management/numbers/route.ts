import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Risk Management API
 * วิเคราะห์เลขที่มียอดแทงสูงผิดปกติ (เลขอั้น/เลขเต็ม)
 * 
 * Risk Levels:
 * - critical: ยอดแทง > 100,000 บาท
 * - high: ยอดแทง > 50,000 บาท
 * - medium: ยอดแทง > 20,000 บาท
 * - low: ยอดแทง < 20,000 บาท
 */

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const lotteryId = searchParams.get('lottery_id');

    // Get today's entries grouped by number
    const today = new Date().toISOString().split('T')[0];
    
    let query = supabase
      .from('entries')
      .select('number, amount, bet_type')
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${today}T23:59:59`);
    
    if (lotteryId) {
      query = query.eq('lottery_id', lotteryId);
    }

    const { data: entries, error } = await query;

    if (error) throw error;

    // Aggregate by number
    const numberStats: Record<string, { totalBets: number; betTypes: Set<string> }> = {};
    
    entries?.forEach(entry => {
      if (!numberStats[entry.number]) {
        numberStats[entry.number] = { totalBets: 0, betTypes: new Set() };
      }
      numberStats[entry.number].totalBets += Number(entry.amount) || 0;
      numberStats[entry.number].betTypes.add(entry.bet_type);
    });

    // Get blocked numbers from system_settings
    const { data: settings } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'blocked_numbers')
      .single();

    const blockedNumbers = settings?.setting_value?.numbers || [];

    // Get reduced rate numbers from system_settings
    const { data: reducedSettings } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'reduced_rate_numbers')
      .single();

    const reducedRateNumbers = reducedSettings?.setting_value?.numbers || {};

    // Calculate risk level and potential payout
    const riskNumbers = Object.entries(numberStats)
      .map(([number, stats]) => {
        const totalBets = stats.totalBets;
        
        // Calculate potential payout (assume 2-digit top rate = 85x)
        const potentialPayout = totalBets * 85;
        
        // Determine risk level
        let riskLevel: 'critical' | 'high' | 'medium' | 'low';
        if (totalBets > 100000) riskLevel = 'critical';
        else if (totalBets > 50000) riskLevel = 'high';
        else if (totalBets > 20000) riskLevel = 'medium';
        else riskLevel = 'low';

        // Determine action
        let action: 'normal' | 'reduced' | 'blocked' = 'normal';
        let adjustedRate: number | undefined;
        
        if (blockedNumbers.includes(number)) {
          action = 'blocked';
        } else if (reducedRateNumbers[number]) {
          action = 'reduced';
          adjustedRate = reducedRateNumbers[number];
        }

        return {
          number,
          totalBets,
          potentialPayout,
          riskLevel,
          action,
          adjustedRate,
          betTypes: Array.from(stats.betTypes),
        };
      })
      .sort((a, b) => b.totalBets - a.totalBets)
      .slice(0, 20); // Top 20 risky numbers

    return NextResponse.json({
      success: true,
      numbers: riskNumbers,
      summary: {
        criticalCount: riskNumbers.filter(n => n.riskLevel === 'critical').length,
        highCount: riskNumbers.filter(n => n.riskLevel === 'high').length,
        blockedCount: riskNumbers.filter(n => n.action === 'blocked').length,
        totalExposure: riskNumbers.reduce((sum, n) => sum + n.potentialPayout, 0),
      },
    });
  } catch (error: any) {
    console.error('Risk management error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Helper function to sync to child sites
async function syncToNetwork(supabase: any, type: string, data: Record<string, any>) {
  try {
    // Get active child sites
    const { data: childSites } = await supabase
      .from('child_sites')
      .select('id, api_url, api_key')
      .eq('status', 'active');

    if (!childSites?.length) return { synced: 0, total: 0 };

    // Push to all child sites in parallel
    const results = await Promise.allSettled(
      childSites.map(async (site: any) => {
        const response = await fetch(`${site.api_url}/api/network/receive`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': site.api_key,
          },
          body: JSON.stringify({ type, data, timestamp: new Date().toISOString() }),
          signal: AbortSignal.timeout(5000),
        });
        return response.ok;
      })
    );

    const synced = results.filter(r => r.status === 'fulfilled' && r.value).length;
    return { synced, total: childSites.length };
  } catch (error) {
    console.error('Network sync error:', error);
    return { synced: 0, total: 0 };
  }
}

// POST - Block/Unblock numbers or adjust rates (with Network Sync)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { action, number, rate, broadcastToNetwork = false } = body;
    
    let syncResult = { synced: 0, total: 0 };

    if (action === 'block') {
      // Get current blocked numbers
      const { data: settings } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'blocked_numbers')
        .single();

      const blockedNumbers = settings?.setting_value?.numbers || [];
      
      if (!blockedNumbers.includes(number)) {
        blockedNumbers.push(number);
      }

      await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'blocked_numbers',
          setting_value: { numbers: blockedNumbers },
          updated_at: new Date().toISOString(),
        });

      // Sync to network if requested
      if (broadcastToNetwork) {
        syncResult = await syncToNetwork(supabase, 'blocked_numbers', { 
          action: 'add', 
          number,
          blockedNumbers 
        });
      }

      return NextResponse.json({ 
        success: true, 
        message: `บล็อคเลข ${number} แล้ว`, 
        syncedSites: syncResult.synced 
      });
    }

    if (action === 'unblock') {
      const { data: settings } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'blocked_numbers')
        .single();

      let blockedNumbers = settings?.setting_value?.numbers || [];
      blockedNumbers = blockedNumbers.filter((n: string) => n !== number);

      await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'blocked_numbers',
          setting_value: { numbers: blockedNumbers },
          updated_at: new Date().toISOString(),
        });

      // Sync to network if requested
      if (broadcastToNetwork) {
        syncResult = await syncToNetwork(supabase, 'blocked_numbers', { 
          action: 'remove', 
          number,
          blockedNumbers 
        });
      }

      return NextResponse.json({ 
        success: true, 
        message: `ปลดบล็อคเลข ${number} แล้ว`,
        syncedSites: syncResult.synced 
      });
    }

    if (action === 'reduce_rate') {
      // Default rate reduction to 50% if not specified
      const newRate = rate || 50;
      
      const { data: settings } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'reduced_rate_numbers')
        .single();

      const reducedRates = settings?.setting_value?.numbers || {};
      reducedRates[number] = newRate;

      await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'reduced_rate_numbers',
          setting_value: { numbers: reducedRates },
          updated_at: new Date().toISOString(),
        });

      // Sync to network if requested
      if (broadcastToNetwork) {
        syncResult = await syncToNetwork(supabase, 'payout_rates', { 
          action: 'reduce', 
          number,
          rate: newRate,
          reducedRates 
        });
      }

      return NextResponse.json({ 
        success: true, 
        message: `ลดเรทเลข ${number} เป็น ${newRate}%`,
        syncedSites: syncResult.synced 
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Risk management error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
