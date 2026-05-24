import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Test entire system flow
export async function POST() {
  const results: Record<string, { status: string; message: string; data?: unknown }> = {};
  
  try {
    const supabase = await createClient();
    
    // 1. Test Database Connection
    const { data: dbTest, error: dbError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    results['database'] = dbError 
      ? { status: 'error', message: dbError.message }
      : { status: 'ok', message: 'Database connected' };

    // 2. Test Customers Table
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, name, credit_balance')
      .limit(5);
    results['customers'] = customersError
      ? { status: 'error', message: customersError.message }
      : { status: 'ok', message: `Found ${customers?.length || 0} customers`, data: customers };

    // 3. Test Lotteries Table
    const { data: lotteries, error: lotteriesError } = await supabase
      .from('lotteries')
      .select('id, name, is_active')
      .eq('is_active', true)
      .limit(5);
    results['lotteries'] = lotteriesError
      ? { status: 'error', message: lotteriesError.message }
      : { status: 'ok', message: `Found ${lotteries?.length || 0} active lotteries`, data: lotteries };

    // 4. Test Entries Table
    const { data: entries, error: entriesError } = await supabase
      .from('entries')
      .select('id, number, amount, status')
      .limit(5);
    results['entries'] = entriesError
      ? { status: 'error', message: entriesError.message }
      : { status: 'ok', message: `Found ${entries?.length || 0} entries` };

    // 5. Test Topup Requests
    const { data: topups, error: topupsError } = await supabase
      .from('topup_requests')
      .select('id, amount, status')
      .limit(5);
    results['topup_requests'] = topupsError
      ? { status: 'error', message: topupsError.message }
      : { status: 'ok', message: `Found ${topups?.length || 0} topup requests` };

    // 6. Test Withdraw Requests
    const { data: withdraws, error: withdrawsError } = await supabase
      .from('withdraw_requests')
      .select('id, amount, status')
      .limit(5);
    results['withdraw_requests'] = withdrawsError
      ? { status: 'error', message: withdrawsError.message }
      : { status: 'ok', message: `Found ${withdraws?.length || 0} withdraw requests` };

    // 7. Test Payment Accounts
    const { data: payments, error: paymentsError } = await supabase
      .from('payment_accounts')
      .select('id, bank_name, is_active')
      .eq('is_active', true)
      .limit(5);
    results['payment_accounts'] = paymentsError
      ? { status: 'error', message: paymentsError.message }
      : { status: 'ok', message: `Found ${payments?.length || 0} active payment accounts` };

    // 8. Test Promotions
    const { data: promos, error: promosError } = await supabase
      .from('promotions')
      .select('id, name, is_active')
      .eq('is_active', true)
      .limit(5);
    results['promotions'] = promosError
      ? { status: 'error', message: promosError.message }
      : { status: 'ok', message: `Found ${promos?.length || 0} active promotions` };

    // 9. Test Games
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, name, is_active')
      .eq('is_active', true)
      .limit(5);
    results['games'] = gamesError
      ? { status: 'error', message: gamesError.message }
      : { status: 'ok', message: `Found ${games?.length || 0} active games` };

    // 10. Test Credit Transactions
    const { data: credits, error: creditsError } = await supabase
      .from('credit_transactions')
      .select('id, type, amount')
      .limit(5);
    results['credit_transactions'] = creditsError
      ? { status: 'error', message: creditsError.message }
      : { status: 'ok', message: `Found ${credits?.length || 0} credit transactions` };

    // 11. Test Audit Logs
    const { data: audits, error: auditsError } = await supabase
      .from('audit_logs')
      .select('id, action')
      .limit(5);
    results['audit_logs'] = auditsError
      ? { status: 'error', message: auditsError.message }
      : { status: 'ok', message: `Found ${audits?.length || 0} audit logs` };

    // 12. Test Security Events
    const { data: security, error: securityError } = await supabase
      .from('security_events')
      .select('id, event_type, severity')
      .limit(5);
    results['security_events'] = securityError
      ? { status: 'error', message: securityError.message }
      : { status: 'ok', message: `Found ${security?.length || 0} security events` };

    // 13. Test Web Settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('key, value')
      .limit(10);
    results['settings'] = settingsError
      ? { status: 'error', message: settingsError.message }
      : { status: 'ok', message: `Found ${settings?.length || 0} settings` };

    // Summary
    const total = Object.keys(results).length;
    const passed = Object.values(results).filter(r => r.status === 'ok').length;
    const failed = total - passed;

    return NextResponse.json({
      success: failed === 0,
      summary: {
        total,
        passed,
        failed,
        percentage: Math.round((passed / total) * 100),
      },
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      results,
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to run system test flow',
    endpoints: [
      'POST /api/test-flow - Run full system test',
    ],
  });
}
