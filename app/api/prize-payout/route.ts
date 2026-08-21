import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/api-auth';

// GET - ดึงรายการผู้ถูกรางวัลที่รอจ่าย
export async function GET(request: Request) {
  try {
    // Auth guard - require admin for prize payout
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending'; // pending, paid, all
    const date =
      searchParams.get('date') ||
      new Date().toISOString().split('T')[0];
    const source = searchParams.get('source') || 'all'; // all, manual, auto, tenant

    const supabase = await createClient();

    // ดึง entries ที่ถูกรางวัล (status = 'won') พร้อมข้อมูลลูกค้าและหวย
    let query = supabase
      .from('entries')
      .select(`
        id,
        number,
        bet_type,
        amount,
        payout_amount,
        status,
        payout_status,
        payout_slip_url,
        payout_note,
        payout_at,
        created_at,
        lottery_id,
        lottery:lotteries(id, name),
        customer_id,
        customer:customers(
          id,
          name,
          phone,
          bank_code,
          bank_account_number,
          bank_account_name
        )
      `)
      .eq('status', 'won')
      .gte('created_at', `${date}T00:00:00`)
      .lte('created_at', `${date}T23:59:59`)
      .order('created_at', { ascending: false });

    // Filter by payout status
    if (status === 'pending') {
      query = query.or(
        'payout_status.is.null,payout_status.eq.pending'
      );
    } else if (status === 'paid') {
      query = query.eq('payout_status', 'paid');
    }

    // Filter by source type (คีย์/ออโต้/เว็บลูก)
    if (source !== 'all') {
      query = query.eq('source_type', source);
    }

    const { data: entries, error } = await query;

    if (error) {
      console.error('Error fetching prize entries:', error);

      return NextResponse.json(
        {
          entries: [],
          error: error.message,
        },
        { status: 500 }
      );
    }

    // ดึง payout_rates เพื่อคำนวณยอดจ่าย
    const { data: payoutRates } = await supabase
      .from('payout_rates')
      .select('lottery_id, bet_type, rate');

    // สร้าง map สำหรับค้นหา rate ได้เร็ว
    const rateMap = new Map<string, number>();

    payoutRates?.forEach((rateRow) => {
      rateMap.set(
        `${rateRow.lottery_id}-${rateRow.bet_type}`,
        Number(rateRow.rate) || 0
      );
    });

    // เพิ่มข้อมูล payout_amount ที่คำนวณจาก rate (ถ้ายังไม่มี)
    const enrichedEntries = (entries || []).map((entry) => {
      let calculatedPayout =
        Number(entry.payout_amount) || 0;

      // ถ้า payout_amount เป็น 0 ให้คำนวณจาก rate
      if (
        calculatedPayout === 0 &&
        entry.lottery_id &&
        entry.bet_type
      ) {
        const rate =
          rateMap.get(
            `${entry.lottery_id}-${entry.bet_type}`
          ) || 0;

        calculatedPayout =
          (Number(entry.amount) || 0) * rate;
      }

      // Supabase อาจ infer relation customer เป็น array
      const customer = Array.isArray(entry.customer)
        ? entry.customer[0] ?? null
        : entry.customer;

      return {
        ...entry,
        customer,
        payout_amount: calculatedPayout,
        customer_name: customer?.name || null,
      };
    });

    // สรุปสถิติ
    const stats = {
      total_winners: enrichedEntries.length,

      total_payout: enrichedEntries.reduce(
        (sum, entry) =>
          sum + (Number(entry.payout_amount) || 0),
        0
      ),

      pending_count: enrichedEntries.filter(
        (entry) =>
          !entry.payout_status ||
          entry.payout_status === 'pending'
      ).length,

      paid_count: enrichedEntries.filter(
        (entry) => entry.payout_status === 'paid'
      ).length,
    };

    return NextResponse.json({
      entries: enrichedEntries,
      stats,
    });
  } catch (error) {
    console.error('Error in prize-payout GET:', error);

    return NextResponse.json(
      {
        entries: [],
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}