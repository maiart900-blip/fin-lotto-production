import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const digitType = searchParams.get('digit_type') || '2';
  const limit = parseInt(searchParams.get('limit') || '10');

  try {
    // Get lottery results from last 30 draws
    // Database columns: six_top, three_top, two_top, two_bot
    const { data: results, error } = await supabase
      .from('lottery_results')
      .select('six_top, three_top, two_top, two_bot')
      .order('draw_date', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Error fetching results:', error);
      return NextResponse.json({ hot: [], cold: [] });
    }

    // Count occurrences
    const countMap: Record<string, number> = {};

    results?.forEach(result => {
      if (digitType === '2') {
        // 2 ตัวบน - two_top (2 ตัวท้ายของรางวัลที่ 1)
        if (result.two_top) {
          const num = String(result.two_top).padStart(2, '0');
          countMap[num] = (countMap[num] || 0) + 1;
        }
        // 2 ตัวล่าง - two_bot
        if (result.two_bot) {
          const num = String(result.two_bot).padStart(2, '0');
          countMap[num] = (countMap[num] || 0) + 1;
        }
      } else {
        // 3 ตัวบน - three_top
        if (result.three_top) {
          const num = String(result.three_top).padStart(3, '0');
          countMap[num] = (countMap[num] || 0) + 1;
        }
        // 3 ตัวล่าง - 3 ตัวท้ายของ six_top
        if (result.six_top && String(result.six_top).length >= 3) {
          const num = String(result.six_top).slice(-3);
          countMap[num] = (countMap[num] || 0) + 1;
        }
      }
    });

    // Convert to array and sort
    const totalDraws = results?.length || 1;
    const allNumbers = Object.entries(countMap).map(([number, count]) => ({
      number,
      count,
      percentage: parseFloat(((count / totalDraws) * 100).toFixed(2)),
    }));

    // Sort for hot (most frequent)
    const hot = [...allNumbers]
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    // Sort for cold (least frequent) - also include zeros
    const maxNum = digitType === '2' ? 100 : 1000;
    const coldNumbers: typeof hot = [];
    
    // Find numbers that never appeared
    for (let i = 0; i < maxNum && coldNumbers.length < limit; i++) {
      const num = digitType === '2' 
        ? String(i).padStart(2, '0') 
        : String(i).padStart(3, '0');
      if (!countMap[num]) {
        coldNumbers.push({ number: num, count: 0, percentage: 0 });
      }
    }

    // If we need more cold numbers, add the least frequent ones
    if (coldNumbers.length < limit) {
      const remaining = [...allNumbers]
        .sort((a, b) => a.count - b.count)
        .slice(0, limit - coldNumbers.length);
      coldNumbers.push(...remaining);
    }

    return NextResponse.json({ 
      hot, 
      cold: coldNumbers.slice(0, limit),
      totalDraws,
    });
  } catch (error) {
    console.error('Error in hot-cold analysis:', error);
    return NextResponse.json({ hot: [], cold: [], totalDraws: 0 });
  }
}
