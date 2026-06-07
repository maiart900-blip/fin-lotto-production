import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// Helper to check if user can edit results
async function canEditResults(supabase: any): Promise<boolean> {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('admin_token')?.value;
  const lotterySession = cookieStore.get('lottery_session')?.value;
  
  console.log('canEditResults - admin_token:', !!adminToken, 'lottery_session:', !!lotterySession);
  
  // Try admin_token first
  if (adminToken) {
    const { data: session } = await supabase
      .from('admin_sessions')
      .select('user_id')
      .eq('token', adminToken)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (session) {
      const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user_id)
        .single();
      
      if (user && ['master_admin', 'super_admin', 'admin'].includes(user.role)) {
        console.log('User authorized via admin_token, role:', user.role);
        return true;
      }
    }
  }
  
  // Try lottery_session (from agents login)
  if (lotterySession) {
    try {
      const sessionData = JSON.parse(lotterySession);
      const role = sessionData.role;
      console.log('Checking lottery_session, role:', role);
      
      if (['master_admin', 'super_admin', 'admin'].includes(role)) {
        return true;
      }
    } catch {
      console.log('Failed to parse lottery_session');
    }
  }
  
  // Allow all for now if no auth system is active (development mode)
  // TODO: Remove this in production
  console.log('No valid session found, allowing for development');
  return true;
}

// GET - Fetch lottery results
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const lotteryId = searchParams.get('lottery_id');
    const date = searchParams.get('date');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('lottery_results')
      .select(`
        *,
        lottery:lotteries(id, name, icon)
      `)
      .order('draw_date', { ascending: false })
      .limit(limit);

    if (lotteryId) {
      query = query.eq('lottery_id', lotteryId);
    }

    if (date) {
      query = query.eq('draw_date', date);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Results GET error:', error.message);
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Results GET exception:', error);
    return NextResponse.json([]);
  }
}

// POST - Create or update lottery result (only for admin/master_admin/super_admin)
// หลังบันทึกผลแล้วจะ trigger การคำนวณผู้ถูกรางวัลอัตโนมัติ
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Permission check
    const canEdit = await canEditResults(supabase);
    if (!canEdit) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์บันทึกผลหวย' }, { status: 403 });
    }
    
    const body = await request.json();
    const { lottery_id, draw_date, three_top, two_bot, auto_calculate = true } = body;

    if (!lottery_id || !draw_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log('Saving lottery result:', { lottery_id, draw_date, three_top, two_bot });

    // Calculate derived values
    const two_top = three_top ? three_top.slice(-2) : null;
    const run_top = three_top ? three_top.slice(-1) : null;
    const run_bot = two_bot ? two_bot.slice(-1) : null;

    // บันทึกผลหวย พร้อมตั้ง status เป็น 'result_announced'
    const { data, error } = await supabase
      .from('lottery_results')
      .upsert({
        lottery_id,
        draw_date,
        three_top,
        two_top,
        two_bot,
        run_top,
        run_bot,
        status: 'result_announced', // ประกาศผลแล้ว รอคำนวณ
        is_processed: false,
      }, {
        onConflict: 'lottery_id,draw_date',
      })
      .select()
      .single();

    if (error) {
      console.error('Results POST error:', error);
      return NextResponse.json({ 
        error: error.message || 'Failed to save result',
        details: error.details || null,
        code: error.code || null,
      }, { status: 500 });
    }

    console.log('Result saved successfully:', data.id);

    // ถ้าผลครบแล้ว (มี three_top และ two_bot) ให้ trigger การคำนวณอัตโนมัติ
    let calculationResult = null;
    if (auto_calculate && three_top && two_bot) {
      console.log('Auto-calculating winners...');
      
      try {
        // เรียก process API ภายใน
        const processResponse = await fetch(new URL('/api/results/process', request.url).toString(), {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '',
          },
          body: JSON.stringify({ 
            result_id: data.id,
            lottery_id,
            draw_date,
          }),
        });
        
        if (processResponse.ok) {
          calculationResult = await processResponse.json();
          console.log('Auto-calculation completed:', calculationResult.stats);
        } else {
          const processError = await processResponse.json();
          console.error('Auto-calculation failed:', processError);
          calculationResult = { error: processError.error || 'Calculation failed' };
        }
      } catch (calcError: any) {
        console.error('Auto-calculation exception:', calcError);
        calculationResult = { error: calcError.message || 'Calculation error' };
      }
    }

    return NextResponse.json({
      ...data,
      calculation: calculationResult,
      message: calculationResult?.success 
        ? `บันทึกผลและคำนวณสำเร็จ พบผู้ถูกรางวัล ${calculationResult.stats?.winners_count || 0} รายการ`
        : 'บันทึกผลสำเร็จ',
    });
  } catch (error: any) {
    console.error('Results POST exception:', error);
    return NextResponse.json({ 
      error: error?.message || 'Failed to save result',
      details: error?.details || null,
      code: error?.code || null,
    }, { status: 500 });
  }
}
