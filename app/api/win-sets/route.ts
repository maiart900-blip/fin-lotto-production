import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Generate all permutations of a number string
function getPermutations(str: string): string[] {
  if (str.length <= 1) return [str];
  
  const result: Set<string> = new Set();
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const remaining = str.slice(0, i) + str.slice(i + 1);
    const perms = getPermutations(remaining);
    for (const perm of perms) {
      result.add(char + perm);
    }
  }
  
  return Array.from(result);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const lotteryId = searchParams.get('lottery_id');
  
  let query = supabase
    .from('win_sets')
    .select(`
      *,
      lottery:lotteries(id, name),
      customer:customers(id, name)
    `)
    .order('created_at', { ascending: false });
  
  if (lotteryId) {
    query = query.eq('lottery_id', lotteryId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('[v0] Win-sets GET error:', error.message);
    return NextResponse.json([]);
  }
  
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  
  const { original_number, win_type, lottery_id, customer_id, amount_per_number, created_by } = body;
  
  // Validate input
  if (!original_number || !win_type || !amount_per_number) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  
  const expectedLength = win_type === 'win2' ? 2 : 3;
  if (original_number.length !== expectedLength) {
    return NextResponse.json({ 
      error: `เลข ${win_type === 'win2' ? 'วิน 2' : 'วิน 3'} ต้องมี ${expectedLength} หลัก` 
    }, { status: 400 });
  }
  
  // Generate all permutations
  const permutations = getPermutations(original_number);
  const total_amount = permutations.length * amount_per_number;
  
  // Create win set record
  const { data: winSet, error: winSetError } = await supabase
    .from('win_sets')
    .insert({
      original_number,
      win_type,
      lottery_id: lottery_id || null,
      customer_id: customer_id || null,
      amount_per_number,
      total_amount,
      created_by: created_by || null,
    })
    .select()
    .single();
  
  if (winSetError) {
    return NextResponse.json({ error: winSetError.message }, { status: 500 });
  }
  
  // Create entries for each permutation
  const betType = win_type === 'win2' ? '2top' : '3top';
  const entries = permutations.map(num => ({
    number: num,
    bet_type: betType,
    amount: amount_per_number,
    lottery_id: lottery_id || null,
    customer_id: customer_id || null,
    created_by: created_by || null,
    win_set_id: winSet.id,
  }));
  
  const { error: entriesError } = await supabase
    .from('entries')
    .insert(entries);
  
  if (entriesError) {
    // Rollback win set if entries fail
    await supabase.from('win_sets').delete().eq('id', winSet.id);
    return NextResponse.json({ error: entriesError.message }, { status: 500 });
  }
  
  return NextResponse.json({
    ...winSet,
    permutations,
    entries_count: permutations.length,
  });
}
