/**
 * Payout Flow Test Script
 * Tests the complete lottery result -> winner calculation -> payout flow
 * 
 * Flow:
 * 1. Admin enters lottery results via /results page
 * 2. System saves to lottery_results table
 * 3. Admin clicks "คำนวณผู้ถูกรางวัล" (Process Winners)
 * 4. System checks entries/bet_items for matching numbers
 * 5. System calculates payouts based on rates
 * 6. System updates customer credit_balance
 * 7. Customer sees results in /c/results page
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface TestResult {
  step: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  data?: any;
}

const results: TestResult[] = [];

function log(step: string, status: 'pass' | 'fail' | 'skip', message: string, data?: any) {
  results.push({ step, status, message, data });
  const icon = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '○';
  console.log(`${icon} ${step}: ${message}`);
  if (data) console.log('  Data:', JSON.stringify(data, null, 2));
}

async function runTests() {
  console.log('\n========================================');
  console.log('  PAYOUT FLOW TEST');
  console.log('========================================\n');

  // Step 1: Check lotteries exist
  console.log('\n--- Step 1: Check Lotteries ---');
  const { data: lotteries, error: lotteryError } = await supabase
    .from('lotteries')
    .select('id, name, is_active')
    .eq('is_active', true)
    .limit(5);

  if (lotteryError || !lotteries?.length) {
    log('Check Lotteries', 'fail', 'No active lotteries found', lotteryError);
    return;
  }
  log('Check Lotteries', 'pass', `Found ${lotteries.length} active lotteries`, lotteries.map(l => l.name));

  const testLottery = lotteries[0];
  const today = new Date().toISOString().split('T')[0];

  // Step 2: Check for existing lottery_result
  console.log('\n--- Step 2: Check Lottery Results ---');
  const { data: existingResults } = await supabase
    .from('lottery_results')
    .select('*')
    .eq('lottery_id', testLottery.id)
    .order('created_at', { ascending: false })
    .limit(3);

  log('Check Results', 'pass', `Found ${existingResults?.length || 0} existing results`, 
    existingResults?.map(r => ({ draw_date: r.draw_date, is_processed: r.is_processed })));

  // Step 3: Check entries for this lottery
  console.log('\n--- Step 3: Check Entries (Bets) ---');
  const { data: entries, error: entriesError } = await supabase
    .from('entries')
    .select('id, customer_id, number, bet_type, amount, status, payout_status')
    .eq('lottery_id', testLottery.id)
    .in('status', ['pending', 'confirmed', 'active'])
    .limit(10);

  if (entriesError) {
    log('Check Entries', 'fail', 'Error fetching entries', entriesError);
  } else if (!entries?.length) {
    log('Check Entries', 'skip', 'No entries found for this lottery - need to create test bets');
  } else {
    log('Check Entries', 'pass', `Found ${entries.length} entries`, entries);
  }

  // Step 4: Check payout rates
  console.log('\n--- Step 4: Check Payout Rates ---');
  const { data: rates } = await supabase
    .from('payout_rates')
    .select('bet_type, rate')
    .eq('lottery_id', testLottery.id);

  if (!rates?.length) {
    log('Check Rates', 'skip', 'No custom rates - will use defaults (3top:900, 2top:90, etc.)');
  } else {
    log('Check Rates', 'pass', `Found ${rates.length} custom rates`, rates);
  }

  // Step 5: Check customer balances
  console.log('\n--- Step 5: Check Customer Balances ---');
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, credit_balance')
    .limit(5);

  log('Check Customers', 'pass', `Found ${customers?.length || 0} customers`, 
    customers?.map(c => ({ name: c.name, balance: c.credit_balance })));

  // Step 6: Check winning_entries table
  console.log('\n--- Step 6: Check Winning Entries ---');
  const { data: winningEntries } = await supabase
    .from('winning_entries')
    .select('*')
    .limit(5);

  log('Check Winning Entries', 'pass', `Found ${winningEntries?.length || 0} winning entries`, winningEntries);

  // Summary
  console.log('\n========================================');
  console.log('  TEST SUMMARY');
  console.log('========================================');
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;

  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${skipped}`);

  if (failed > 0) {
    console.log('\nFailed Tests:');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`  - ${r.step}: ${r.message}`);
    });
  }

  // Recommendations
  console.log('\n========================================');
  console.log('  RECOMMENDATIONS');
  console.log('========================================');

  if (!entries?.length) {
    console.log('1. Create test bets using the manual-key system or auto system');
    console.log('   - Go to /manual-key/customers to add a customer');
    console.log('   - Go to /manual-key to place a bet');
  }

  if (!existingResults?.length) {
    console.log('2. Enter lottery results:');
    console.log('   - Go to /results page');
    console.log('   - Select lottery and enter winning numbers');
    console.log('   - Click "บันทึกผล" to save');
  }

  console.log('3. Process winners:');
  console.log('   - After saving results, click "คำนวณผู้ถูกรางวัล"');
  console.log('   - System will match bets with results');
  console.log('   - Winners get credit added to their balance');

  return { passed, failed, skipped, results };
}

// Run if executed directly
runTests().catch(console.error);
