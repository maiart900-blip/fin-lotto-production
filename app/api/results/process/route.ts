import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// Helper to check if user can process results
async function canProcessResults(): Promise<boolean> {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('admin_token')?.value;
  const lotterySession = cookieStore.get('lottery_session')?.value;
  
  console.log('[v0] canProcessResults - admin_token:', !!adminToken, 'lottery_session:', !!lotterySession);
  
  // Allow for development
  // TODO: Remove in production
  if (lotterySession) {
    try {
      const sessionData = JSON.parse(lotterySession);
      const role = sessionData.role;
      if (['master_admin', 'super_admin', 'admin'].includes(role)) {
        return true;
      }
    } catch {
      console.log('[v0] Failed to parse lottery_session');
    }
  }
  
  // Allow all for development
  return true;
}

// Normalize date to YYYY-MM-DD format
function normalizeDate(dateStr: string): string {
  if (!dateStr) return '';
  
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // DD/MM/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
  }
  
  // YYYY/MM/DD format
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) {
    return dateStr.replace(/\//g, '-');
  }
  
  // Try parsing as date
  try {
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

// Helper function to get all permutations
function getPermutations(str: string): string[] {
  if (str.length <= 1) return [str];
  
  const result: string[] = [];
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const remaining = str.slice(0, i) + str.slice(i + 1);
    const perms = getPermutations(remaining);
    for (const perm of perms) {
      result.push(char + perm);
    }
  }
  
  return [...new Set(result)];
}

// POST - Process winners for a result
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Permission check
    const canProcess = await canProcessResults();
    if (!canProcess) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์คำนวณผู้ถูกรางวัล' }, { status: 403 });
    }
    
    const body = await request.json();
    const { result_id, lottery_id, draw_date } = body;

    console.log('[v0] Process winners request:', { result_id, lottery_id, draw_date });

    // Get the result - support both by result_id or by lottery_id + draw_date
    let result: any = null;
    
    if (result_id) {
      const { data, error } = await supabase
        .from('lottery_results')
        .select('*, lottery:lotteries(id, name)')
        .eq('id', result_id)
        .single();
      
      if (error || !data) {
        console.log('[v0] Result not found by id:', result_id);
        return NextResponse.json({ error: 'ไม่พบผลหวย' }, { status: 404 });
      }
      result = data;
    } else if (lottery_id && draw_date) {
      const normalizedDate = normalizeDate(draw_date);
      const { data, error } = await supabase
        .from('lottery_results')
        .select('*, lottery:lotteries(id, name)')
        .eq('lottery_id', lottery_id)
        .eq('draw_date', normalizedDate)
        .single();
      
      if (error || !data) {
        console.log('[v0] Result not found by lottery_id + draw_date:', lottery_id, normalizedDate);
        return NextResponse.json({ error: 'ไม่พบผลหวย' }, { status: 404 });
      }
      result = data;
    } else {
      return NextResponse.json({ error: 'กรุณาระบุ result_id หรือ lottery_id + draw_date' }, { status: 400 });
    }

    console.log('[v0] Found result:', {
      id: result.id,
      lottery_id: result.lottery_id,
      lottery_name: result.lottery?.name,
      draw_date: result.draw_date,
      three_top: result.three_top,
      two_top: result.two_top,
      two_bot: result.two_bot,
      run_top: result.run_top,
      run_bot: result.run_bot,
      is_processed: result.is_processed,
    });

    // ===== DUPLICATE PROCESSING PROTECTION =====
    // Check if already processed to prevent double payouts
    if (result.is_processed === true) {
      console.log('[v0] Result already processed, returning cached data');
      return NextResponse.json({
        success: true,
        message: 'ผลหวยนี้ถูกคำนวณแล้ว (cached)',
        already_processed: true,
        result_id: result.id,
        total_winners: result.total_winners || 0,
        total_payout: result.total_payout_amount || 0,
      });
    }

    // Lock the result to prevent concurrent processing
    const { error: lockError } = await supabase
      .from('lottery_results')
      .update({ 
        processing_started_at: new Date().toISOString(),
        status: 'processing'
      })
      .eq('id', result.id)
      .eq('is_processed', false); // Only lock if not yet processed

    if (lockError) {
      console.error('[v0] Failed to lock result for processing:', lockError);
      // Continue anyway for now, but log the error
    }

    // Get payout rates for this lottery
    const { data: rates } = await supabase
      .from('payout_rates')
      .select('*')
      .eq('lottery_id', result.lottery_id);

    const rateMap: Record<string, number> = {};
    rates?.forEach(r => {
      rateMap[r.bet_type] = parseFloat(r.rate);
    });
    
    // Default payout rates if not set
    const defaultRates: Record<string, number> = {
      '3top': 900, '3tod': 150, '3flip': 150,
      '2top': 90, '2bot': 90, '2flip': 45,
      '1top': 3, '1bot': 3,
      'run_top': 3, 'run_bot': 3,
    };
    
    console.log('[v0] Payout rates:', { ...defaultRates, ...rateMap });

    const normalizedDrawDate = normalizeDate(result.draw_date);
    const drawDateStart = `${normalizedDrawDate}T00:00:00`;
    const drawDateEnd = `${normalizedDrawDate}T23:59:59`;
    
    // Track all winners
    const winners: Array<{
      source: 'entries' | 'bet_items';
      entry_id: string;
      bet_id?: string;
      customer_id: string | null;
      bet_type: string;
      number: string;
      amount: number;
      rate: number;
      payout: number;
    }> = [];
    
    let totalEntriesChecked = 0;
    let totalBetItemsChecked = 0;

    // ===== PROCESS ENTRIES TABLE =====
    console.log('[v0] Checking entries table...');
    const { data: entries, error: entriesError } = await supabase
      .from('entries')
      .select('*')
      .eq('lottery_id', result.lottery_id)
      .gte('created_at', drawDateStart)
      .lt('created_at', drawDateEnd)
      .in('status', ['pending', 'confirmed', 'active']);

    if (entriesError) {
      console.error('[v0] Error fetching entries:', entriesError);
    }

    console.log('[v0] Found entries:', entries?.length || 0);
    totalEntriesChecked = entries?.length || 0;

    // Check each entry for winning
    entries?.forEach(entry => {
      let isWinner = false;
      let rate = rateMap[entry.bet_type] || defaultRates[entry.bet_type] || 0;

      switch (entry.bet_type) {
        case '3top':
          isWinner = entry.number === result.three_top;
          break;
        case '3tod':
          if (result.three_top) {
            const sortedEntry = entry.number.split('').sort().join('');
            const sortedResult = result.three_top.split('').sort().join('');
            isWinner = sortedEntry === sortedResult && entry.number !== result.three_top;
          }
          break;
        case '3flip':
          if (result.three_top) {
            const perms = getPermutations(result.three_top);
            isWinner = perms.includes(entry.number);
          }
          break;
        case '2top':
          isWinner = entry.number === result.two_top;
          break;
        case '2bot':
          isWinner = entry.number === result.two_bot;
          break;
        case '2flip':
          if (result.two_top) {
            const flipped = result.two_top.split('').reverse().join('');
            isWinner = entry.number === result.two_top || entry.number === flipped;
          }
          break;
        case '1top':
        case 'run_top':
          isWinner = entry.number === result.run_top;
          break;
        case '1bot':
        case 'run_bot':
          isWinner = entry.number === result.run_bot;
          break;
      }

      if (isWinner && rate > 0) {
        console.log('[v0] Winner found (entries):', { number: entry.number, bet_type: entry.bet_type, amount: entry.amount, rate, payout: entry.amount * rate });
        winners.push({
          source: 'entries',
          entry_id: entry.id,
          customer_id: entry.customer_id,
          bet_type: entry.bet_type,
          number: entry.number,
          amount: entry.amount,
          rate,
          payout: entry.amount * rate,
        });
      }
    });

    // ===== PROCESS BETS + BET_ITEMS TABLES =====
    console.log('[v0] Checking bets table...');
    const { data: bets, error: betsError } = await supabase
      .from('bets')
      .select(`
        id, customer_id, lottery_id, status,
        bet_items(id, number, bet_type, amount_top, amount_bottom, amount_tod, status)
      `)
      .eq('lottery_id', result.lottery_id)
      .gte('created_at', drawDateStart)
      .lt('created_at', drawDateEnd)
      .in('status', ['pending', 'confirmed', 'active', 'waiting_result']);

    if (betsError) {
      console.error('[v0] Error fetching bets:', betsError);
    }

    console.log('[v0] Found bets:', bets?.length || 0);

    // Check each bet_item for winning
    bets?.forEach(bet => {
      const betItems = (bet.bet_items || []) as Array<{
        id: string;
        number: string;
        bet_type: string;
        amount_top?: number;
        amount_bottom?: number;
        amount_tod?: number;
        status?: string;
      }>;
      
      totalBetItemsChecked += betItems.length;
      
      betItems.forEach(item => {
        if (item.status === 'won' || item.status === 'lost') return; // Already processed
        
        const number = item.number;
        const betType = item.bet_type;
        
        // Check each amount type
        const checks: Array<{ amount: number; type: string; resultField: string }> = [];
        
        // Amount top -> 2 ตัวบน or 3 ตัวบน
        if (item.amount_top && item.amount_top > 0) {
          if (number.length === 3) {
            checks.push({ amount: item.amount_top, type: '3top', resultField: 'three_top' });
          } else if (number.length === 2) {
            checks.push({ amount: item.amount_top, type: '2top', resultField: 'two_top' });
          } else if (number.length === 1) {
            checks.push({ amount: item.amount_top, type: 'run_top', resultField: 'run_top' });
          }
        }
        
        // Amount bottom -> 2 ตัวล่าง
        if (item.amount_bottom && item.amount_bottom > 0) {
          if (number.length === 2) {
            checks.push({ amount: item.amount_bottom, type: '2bot', resultField: 'two_bot' });
          } else if (number.length === 1) {
            checks.push({ amount: item.amount_bottom, type: 'run_bot', resultField: 'run_bot' });
          }
        }
        
        // Amount tod -> 3 ตัวโต๊ด
        if (item.amount_tod && item.amount_tod > 0) {
          checks.push({ amount: item.amount_tod, type: '3tod', resultField: 'three_top' });
        }
        
        // Check based on explicit bet_type if no amount checks
        if (checks.length === 0 && betType) {
          const totalAmount = (item.amount_top || 0) + (item.amount_bottom || 0) + (item.amount_tod || 0);
          if (totalAmount > 0) {
            checks.push({ amount: totalAmount, type: betType, resultField: betType.includes('bot') ? 'two_bot' : 'three_top' });
          }
        }
        
        checks.forEach(check => {
          let isWinner = false;
          let rate = rateMap[check.type] || defaultRates[check.type] || 0;
          
          switch (check.type) {
            case '3top':
              isWinner = number === result.three_top;
              break;
            case '3tod':
              if (result.three_top) {
                const sortedItem = number.split('').sort().join('');
                const sortedResult = result.three_top.split('').sort().join('');
                isWinner = sortedItem === sortedResult;
              }
              break;
            case '2top':
              isWinner = number === result.two_top;
              break;
            case '2bot':
              isWinner = number === result.two_bot;
              break;
            case 'run_top':
            case '1top':
              isWinner = number === result.run_top;
              break;
            case 'run_bot':
            case '1bot':
              isWinner = number === result.run_bot;
              break;
          }
          
          if (isWinner && rate > 0) {
            console.log('[v0] Winner found (bet_items):', { 
              bet_id: bet.id,
              item_id: item.id,
              number, 
              check_type: check.type, 
              amount: check.amount, 
              rate, 
              payout: check.amount * rate 
            });
            winners.push({
              source: 'bet_items',
              entry_id: item.id,
              bet_id: bet.id,
              customer_id: bet.customer_id,
              bet_type: check.type,
              number,
              amount: check.amount,
              rate,
              payout: check.amount * rate,
            });
          }
        });
      });
    });

    console.log('[v0] Total checked - entries:', totalEntriesChecked, 'bet_items:', totalBetItemsChecked);
    console.log('[v0] Total winners found:', winners.length);

    // ===== UPDATE DATABASE =====
    
    // Update winning entries in entries table - อัปเดตทีละ entry เพื่อใส่ payout_amount ถูกต้อง
    const entryWinners = winners.filter(w => w.source === 'entries');
    for (const winner of entryWinners) {
      console.log('[v0] Updating entry:', { id: winner.entry_id, payout: winner.payout, rate: winner.rate });
      const { error: updateError } = await supabase
        .from('entries')
        .update({ 
          status: 'won',
          payout_amount: winner.payout,
          payout_rate: winner.rate,
          payout_status: 'pending', // พร้อมจ่าย
        })
        .eq('id', winner.entry_id);
      
      if (updateError) {
        console.error('[v0] Error updating entry:', updateError);
      }
    }

    // Update losing entries in entries table  
    if (entries && entries.length > 0) {
      const winnerEntryIds = entryWinners.map(w => w.entry_id);
      const loserEntryIds = entries.filter(e => !winnerEntryIds.includes(e.id)).map(e => e.id);
      if (loserEntryIds.length > 0) {
        console.log('[v0] Updating losing entries:', loserEntryIds.length);
        await supabase
          .from('entries')
          .update({ 
            status: 'lost',
            payout_amount: 0,
            payout_status: 'none', // ไม่มีรางวัล
          })
          .in('id', loserEntryIds);
      }
    }

    // Update bet_items status and win_amount
    const betItemWinners = winners.filter(w => w.source === 'bet_items');
    for (const winner of betItemWinners) {
      await supabase
        .from('bet_items')
        .update({ 
          status: 'won',
          win_amount: winner.payout,
          payout_rate: winner.rate,
        })
        .eq('id', winner.entry_id);
    }

    // Update losing bet_items
    if (bets && bets.length > 0) {
      const winnerItemIds = betItemWinners.map(w => w.entry_id);
      const allItemIds: string[] = [];
      bets.forEach(bet => {
        const items = (bet.bet_items || []) as Array<{ id: string }>;
        items.forEach(item => allItemIds.push(item.id));
      });
      const loserItemIds = allItemIds.filter(id => !winnerItemIds.includes(id));
      if (loserItemIds.length > 0) {
        await supabase
          .from('bet_items')
          .update({ status: 'lost', win_amount: 0 })
          .in('id', loserItemIds);
      }
    }

    // Update bets status based on bet_items
    if (bets && bets.length > 0) {
      for (const bet of bets) {
        const betWinners = betItemWinners.filter(w => w.bet_id === bet.id);
        const totalWinAmount = betWinners.reduce((sum, w) => sum + w.payout, 0);
        const hasWinner = betWinners.length > 0;
        
        await supabase
          .from('bets')
          .update({
            status: hasWinner ? 'won' : 'lost',
            is_checked: true,
            total_win_amount: totalWinAmount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bet.id);
      }
    }

    // Pay out to customers
    const customerPayouts: Record<string, number> = {};
    for (const winner of winners) {
      if (winner.customer_id) {
        customerPayouts[winner.customer_id] = (customerPayouts[winner.customer_id] || 0) + winner.payout;
      }
    }

    console.log('[v0] Customer payouts:', customerPayouts);

    for (const [customerId, payout] of Object.entries(customerPayouts)) {
      // Get current balance
      const { data: customer } = await supabase
        .from('customers')
        .select('credit_balance, name')
        .eq('id', customerId)
        .single();

      if (customer) {
        const newBalance = (customer.credit_balance || 0) + payout;
        
        // Update credit balance
        await supabase
          .from('customers')
          .update({ 
            credit_balance: newBalance,
            updated_at: new Date().toISOString()
          })
          .eq('id', customerId);

        // Log credit transaction
        await supabase
          .from('credit_transactions')
          .insert({
            customer_id: customerId,
            amount: payout,
            type: 'win',
            description: `ถูกรางวัล ${result.lottery?.name || 'หวย'} งวด ${result.draw_date}`,
            balance_after: newBalance,
          });
          
        console.log('[v0] Paid customer:', { customerId, name: customer.name, payout, newBalance });
      }
    }

    // Insert winning_entries records
    if (winners.length > 0) {
      const winningRecords = winners.map(w => ({
        result_id: result.id,
        entry_id: w.entry_id,
        bet_type: w.bet_type,
        number: w.number,
        amount: w.amount,
        rate: w.rate,
        payout: w.payout,
        customer_id: w.customer_id,
      }));
      
      await supabase
        .from('winning_entries')
        .insert(winningRecords)
        .select();
    }

    // Calculate totals BEFORE updating lottery_results
    const totalPayout = winners.reduce((sum, w) => sum + w.payout, 0);

    // Mark result as processed - อัปเดต status ให้ครบถ้วน
    const { data: updatedResult, error: updateError } = await supabase
      .from('lottery_results')
      .update({
        status: 'calculated',
        is_processed: true,
        processed_at: new Date().toISOString(),
        calculated_at: new Date().toISOString(),
        total_winners: winners.length,
        total_payout_amount: totalPayout,
      })
      .eq('id', result.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('[v0] Error updating lottery_results:', updateError);
    } else {
      console.log('[v0] Updated lottery_results:', {
        id: updatedResult.id,
        status: updatedResult.status,
        is_processed: updatedResult.is_processed,
        total_winners: updatedResult.total_winners,
        total_payout_amount: updatedResult.total_payout_amount,
      });
    }

    console.log('[v0] Process complete:', {
      result_id: result.id,
      lottery_name: result.lottery?.name,
      draw_date: result.draw_date,
      entries_checked: totalEntriesChecked,
      bet_items_checked: totalBetItemsChecked,
      winners_count: winners.length,
      total_payout: totalPayout,
    });

    return NextResponse.json({
      success: true,
      message: `คำนวณผู้ถูกรางวัลสำเร็จ`,
      result: {
        lottery_name: result.lottery?.name,
        draw_date: result.draw_date,
        three_top: result.three_top,
        two_bot: result.two_bot,
      },
      stats: {
        entries_checked: totalEntriesChecked,
        bet_items_checked: totalBetItemsChecked,
        winners_count: winners.length,
        total_payout: totalPayout,
        customers_paid: Object.keys(customerPayouts).length,
      },
      winners: winners.map(w => ({
        number: w.number,
        bet_type: w.bet_type,
        amount: w.amount,
        payout: w.payout,
      })),
    });
  } catch (error: any) {
    console.error('[v0] Error processing winners:', error?.message || error);
    return NextResponse.json({ 
      error: 'เกิดข้อผิดพลาดในการคำนวณผู้ถูกรางวัล', 
      detail: error?.message 
    }, { status: 500 });
  }
}
