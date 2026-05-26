/**
 * Operational Alerts API
 * Creates and manages alerts for operational anomalies
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';

export interface OperationalAlert {
  id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  created_at: string;
}

// GET - Fetch active alerts
export async function GET() {
  const authResult = await requireSuperAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const supabase = await createClient();
    
    const { data: alerts, error } = await supabase
      .from('operational_alerts')
      .select('*')
      .eq('is_acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      // Table might not exist yet - return empty
      return NextResponse.json({ success: true, alerts: [] });
    }

    return NextResponse.json({ success: true, alerts: alerts || [] });
  } catch (error) {
    console.error('[Alerts] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

// POST - Acknowledge an alert or trigger alert check
export async function POST(request: NextRequest) {
  const authResult = await requireSuperAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await request.json();
    const { action, alert_id } = body;
    const supabase = await createClient();

    if (action === 'acknowledge' && alert_id) {
      const { error } = await supabase
        .from('operational_alerts')
        .update({
          is_acknowledged: true,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alert_id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'check') {
      // Run alert checks and create new alerts if needed
      const alerts = await runAlertChecks(supabase);
      return NextResponse.json({ success: true, newAlerts: alerts.length, alerts });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[Alerts] Error:', error);
    return NextResponse.json({ error: 'Failed to process alert action' }, { status: 500 });
  }
}

// Alert check functions
async function runAlertChecks(supabase: Awaited<ReturnType<typeof createClient>>) {
  const alerts: Partial<OperationalAlert>[] = [];
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  // Check 1: Payout spike (more than 50,000 in last 5 min)
  const { data: recentPayouts } = await supabase
    .from('entries')
    .select('payout_amount')
    .eq('status', 'won')
    .gte('updated_at', fiveMinAgo);

  const recentPayoutTotal = (recentPayouts || []).reduce((s, e) => s + Number(e.payout_amount || 0), 0);
  if (recentPayoutTotal > 50000) {
    alerts.push({
      alert_type: 'payout_spike',
      severity: 'warning',
      title: 'Payout Spike Detected',
      message: `${recentPayoutTotal.toLocaleString()} THB paid out in last 5 minutes`,
      data: { amount: recentPayoutTotal },
    });
  }

  // Check 2: High exposure on single number (>10,000)
  const { data: exposureData } = await supabase
    .from('entries')
    .select('number, amount')
    .gte('created_at', todayStart)
    .in('status', ['pending', 'confirmed', 'active']);

  const numberExposure: Record<string, number> = {};
  (exposureData || []).forEach(e => {
    numberExposure[e.number] = (numberExposure[e.number] || 0) + Number(e.amount || 0);
  });

  for (const [number, exposure] of Object.entries(numberExposure)) {
    if (exposure > 10000) {
      alerts.push({
        alert_type: 'high_exposure',
        severity: exposure > 20000 ? 'critical' : 'warning',
        title: `High Exposure on Number ${number}`,
        message: `${exposure.toLocaleString()} THB exposure on ${number}`,
        data: { number, exposure },
      });
    }
  }

  // Check 3: Failed payouts
  const { count: failedPayouts } = await supabase
    .from('entries')
    .select('id', { count: 'exact', head: true })
    .eq('payout_status', 'failed');

  if ((failedPayouts || 0) > 0) {
    alerts.push({
      alert_type: 'failed_payouts',
      severity: 'critical',
      title: 'Failed Payouts Detected',
      message: `${failedPayouts} entries have failed payout status`,
      data: { count: failedPayouts },
    });
  }

  // Check 4: Failed deposits (today)
  const { count: failedDeposits } = await supabase
    .from('deposit_requests')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', todayStart)
    .in('status', ['failed', 'rejected']);

  if ((failedDeposits || 0) > 5) {
    alerts.push({
      alert_type: 'failed_deposits',
      severity: 'warning',
      title: 'Multiple Failed Deposits',
      message: `${failedDeposits} failed deposits today`,
      data: { count: failedDeposits },
    });
  }

  // Check 5: Failed withdrawals (today)
  const { count: failedWithdraws } = await supabase
    .from('withdraw_requests')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', todayStart)
    .in('status', ['failed', 'rejected']);

  if ((failedWithdraws || 0) > 3) {
    alerts.push({
      alert_type: 'failed_withdrawals',
      severity: 'warning',
      title: 'Multiple Failed Withdrawals',
      message: `${failedWithdraws} failed withdrawals today`,
      data: { count: failedWithdraws },
    });
  }

  // Check 6: Rapid betting spike (>20 bets in 5 min from same customer)
  const { data: rapidBets } = await supabase
    .from('entries')
    .select('customer_id')
    .gte('created_at', fiveMinAgo)
    .not('customer_id', 'is', null);

  const customerBetCount: Record<string, number> = {};
  (rapidBets || []).forEach(e => {
    customerBetCount[e.customer_id] = (customerBetCount[e.customer_id] || 0) + 1;
  });

  for (const [customerId, count] of Object.entries(customerBetCount)) {
    if (count > 20) {
      alerts.push({
        alert_type: 'rapid_betting',
        severity: 'warning',
        title: 'Rapid Betting Activity',
        message: `Customer placed ${count} bets in 5 minutes`,
        data: { customer_id: customerId, count },
      });
    }
  }

  // Insert new alerts if any
  if (alerts.length > 0) {
    const alertsToInsert = alerts.map(a => ({
      ...a,
      is_acknowledged: false,
      created_at: now.toISOString(),
    }));

    await supabase.from('operational_alerts').insert(alertsToInsert);
  }

  return alerts;
}
