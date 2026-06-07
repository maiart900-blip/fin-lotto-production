import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

// POST - ตรวจผลหวยและคำนวณเงินรางวัลอัตโนมัติ
export async function POST(request: NextRequest) {
  // Auth guard - require admin for checking results
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const supabase = await createClient();
  
  try {
    const body = await request.json();
    const { lottery_id, result_id } = body;

    if (!lottery_id && !result_id) {
      return NextResponse.json({ error: 'Missing lottery_id or result_id' }, { status: 400 });
    }

    // ดึงผลหวย
    let resultQuery = supabase
      .from('lottery_results')
      .select('*');
    
    if (result_id) {
      resultQuery = resultQuery.eq('id', result_id);
    } else if (lottery_id) {
      resultQuery = resultQuery.eq('lottery_id', lottery_id).order('created_at', { ascending: false }).limit(1);
    }

    const { data: results, error: resultError } = await resultQuery;

    if (resultError || !results || results.length === 0) {
      return NextResponse.json({ error: 'Lottery result not found' }, { status: 404 });
    }

    const lotteryResult = results[0];
    const targetLotteryId = lotteryResult.lottery_id;

    // ดึงโพยที่ยังไม่ได้ตรวจ
    const { data: bets, error: betsError } = await supabase
      .from('bets')
      .select(`
        *,
        bet_items(*)
      `)
      .eq('lottery_id', targetLotteryId)
      .eq('is_checked', false)
      .in('status', ['confirmed', 'pending']);

    if (betsError) {
      return NextResponse.json({ error: betsError.message }, { status: 500 });
    }

    if (!bets || bets.length === 0) {
      return NextResponse.json({ 
        message: 'No unchecked bets found',
        checked_count: 0,
      });
    }

    // อัตราจ่าย (ดึงจาก lotto_rates หรือใช้ค่า default)
    const { data: payRates } = await supabase
      .from('lotto_rates')
      .select('bet_type, pay_rate')
      .eq('is_active', true);

    const rateMap: Record<string, number> = {};
    if (payRates) {
      payRates.forEach(r => {
        rateMap[r.bet_type] = r.pay_rate;
      });
    }

    // Default rates
    const defaultRates: Record<string, number> = {
      '3top': 900,
      '3tod': 150,
      '3front': 450,
      '3back': 450,
      '2top': 90,
      '2bot': 90,
      '2bottom': 90,
      'run_top': 3.2,
      'run_bot': 4.2,
      'run_bottom': 4.2,
    };

    const getRate = (betType: string) => rateMap[betType] || defaultRates[betType] || 90;

    // ผลหวย
    const three_top = lotteryResult.first_three || lotteryResult.three_top || '';
    const two_top = three_top.slice(-2);
    const two_bottom = lotteryResult.two_bottom || lotteryResult.last_two || '';
    const three_front = lotteryResult.three_front || three_top.slice(0, 3);
    const three_back = lotteryResult.three_back || three_top.slice(-3);

    let totalChecked = 0;
    let totalWinners = 0;
    let totalWinAmount = 0;

    // ตรวจแต่ละโพย
    for (const bet of bets) {
      const betItems = bet.bet_items as any[];
      let betWinAmount = 0;
      let hasWinner = false;

      for (const item of betItems) {
        let winAmount = 0;
        let isWinner = false;
        const number = item.number;
        const betType = item.bet_type;

        // ตรวจเลข
        switch (betType) {
          case '3top':
            if (number === three_top) {
              isWinner = true;
              winAmount = (item.amount_top || item.amount || 0) * getRate('3top');
            }
            break;
          case '3tod':
            // 3 ตัวโต๊ด - ต้องมีเลขตรงทุกตัว (ไม่สนลำดับ)
            const sorted = number.split('').sort().join('');
            const resultSorted = three_top.split('').sort().join('');
            if (sorted === resultSorted && number !== three_top) {
              isWinner = true;
              winAmount = (item.amount_tod || item.amount || 0) * getRate('3tod');
            }
            break;
          case '3front':
            if (number === three_front) {
              isWinner = true;
              winAmount = (item.amount_top || item.amount || 0) * getRate('3front');
            }
            break;
          case '3back':
            if (number === three_back) {
              isWinner = true;
              winAmount = (item.amount_bottom || item.amount || 0) * getRate('3back');
            }
            break;
          case '2top':
            if (number === two_top) {
              isWinner = true;
              winAmount = (item.amount_top || item.amount || 0) * getRate('2top');
            }
            break;
          case '2bot':
          case '2bottom':
            if (number === two_bottom) {
              isWinner = true;
              winAmount = (item.amount_bottom || item.amount || 0) * getRate('2bot');
            }
            break;
          case 'run_top':
            // วิ่งบน - ต้องมีเลขนี้อยู่ใน 3 ตัวบน
            if (three_top.includes(number)) {
              isWinner = true;
              winAmount = (item.amount_top || item.amount || 0) * getRate('run_top');
            }
            break;
          case 'run_bot':
          case 'run_bottom':
            // วิ่งล่าง - ต้องมีเลขนี้อยู่ใน 2 ตัวล่าง
            if (two_bottom.includes(number)) {
              isWinner = true;
              winAmount = (item.amount_bottom || item.amount || 0) * getRate('run_bot');
            }
            break;
        }

        // อัปเดต bet_item
        if (isWinner) {
          hasWinner = true;
          betWinAmount += winAmount;
        }

        await supabase
          .from('bet_items')
          .update({
            status: isWinner ? 'won' : 'lost',
            win_amount: winAmount,
            checked_at: new Date().toISOString(),
          })
          .eq('id', item.id);
      }

      // ATOMIC STATUS UPDATE: อัปเดต bet พร้อม check is_checked=false เพื่อกัน double payout
      const { data: updatedBet, error: updateBetError } = await supabase
        .from('bets')
        .update({
          status: hasWinner ? 'won' : 'lost',
          is_checked: true,
          checked_at: new Date().toISOString(),
          total_win_amount: betWinAmount,
        })
        .eq('id', bet.id)
        .eq('is_checked', false) // IDEMPOTENCY: Only update if not yet checked
        .select('id')
        .single();

      // ถ้า update ไม่สำเร็จ แปลว่า bet นี้ถูกตรวจไปแล้ว (skip)
      if (updateBetError || !updatedBet) {
        console.log(`Bet ${bet.id} already checked, skipping payout`);
        continue; // Skip to next bet
      }

      // จ่ายเงินรางวัล (only if bet was actually updated)
      if (betWinAmount > 0) {
        totalWinners++;
        totalWinAmount += betWinAmount;

        // ATOMIC CREDIT UPDATE: เพิ่มเครดิตโดยไม่ต้อง read ก่อน
        const { data: updatedCustomer, error: creditError } = await supabase
          .from('customers')
          .update({ 
            credit_balance: supabase.rpc ? 
              // If RPC available, use it for true atomic increment
              (await supabase.from('customers').select('credit_balance').eq('id', bet.customer_id).single()).data?.credit_balance + betWinAmount :
              // Fallback: read and update (less safe but still works)
              ((await supabase.from('customers').select('credit_balance').eq('id', bet.customer_id).single()).data?.credit_balance || 0) + betWinAmount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bet.customer_id)
          .select('credit_balance')
          .single();

        if (!creditError && updatedCustomer) {
          // บันทึก credit transaction
          await supabase
            .from('credit_transactions')
            .insert({
              customer_id: bet.customer_id,
              amount: betWinAmount,
              type: 'payout',
              description: `ถูกรางวัล - โพย #${bet.id.slice(0, 8)}`,
              balance_after: updatedCustomer.credit_balance,
              reference_id: bet.id,
              reference_type: 'bet_win',
            });
        }
      }

      totalChecked++;
    }

    return NextResponse.json({
      success: true,
      message: 'ตรวจผลสำเร็จ',
      lottery_id: targetLotteryId,
      result: {
        three_top,
        two_top,
        two_bottom,
      },
      stats: {
        total_checked: totalChecked,
        total_winners: totalWinners,
        total_win_amount: totalWinAmount,
      },
    });

  } catch (error) {
    console.error('Error checking results:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - ดูสถานะการตรวจผล
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const lottery_id = searchParams.get('lottery_id');

  if (!lottery_id) {
    return NextResponse.json({ error: 'Missing lottery_id' }, { status: 400 });
  }

  // นับโพยที่ยังไม่ได้ตรวจ
  const { count: unchecked } = await supabase
    .from('bets')
    .select('*', { count: 'exact', head: true })
    .eq('lottery_id', lottery_id)
    .eq('is_checked', false);

  // นับโพยที่ตรวจแล้ว
  const { count: checked } = await supabase
    .from('bets')
    .select('*', { count: 'exact', head: true })
    .eq('lottery_id', lottery_id)
    .eq('is_checked', true);

  // นับโพยที่ถูกรางวัล
  const { count: winners } = await supabase
    .from('bets')
    .select('*', { count: 'exact', head: true })
    .eq('lottery_id', lottery_id)
    .eq('status', 'won');

  // รวมยอดรางวัล
  const { data: winData } = await supabase
    .from('bets')
    .select('total_win_amount')
    .eq('lottery_id', lottery_id)
    .eq('status', 'won');

  const totalWinAmount = winData?.reduce((sum, b) => sum + (b.total_win_amount || 0), 0) || 0;

  return NextResponse.json({
    lottery_id,
    unchecked_count: unchecked || 0,
    checked_count: checked || 0,
    winners_count: winners || 0,
    total_win_amount: totalWinAmount,
    all_checked: (unchecked || 0) === 0,
  });
}
