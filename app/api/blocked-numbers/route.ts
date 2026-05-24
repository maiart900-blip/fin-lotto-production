import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

// Create admin client with service role key to bypass RLS
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createSupabaseClient(supabaseUrl, serviceRoleKey);
}

export async function GET(request: NextRequest) {
  try {
    // Auth guard - require admin for blocked numbers management
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const lotteryId = searchParams.get('lottery_id');

    let query = supabase
      .from('blocked_numbers')
      .select(`
        *,
        lottery:lotteries(id, name)
      `)
      .order('created_at', { ascending: false });

    if (lotteryId) {
      query = query.eq('lottery_id', lotteryId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('GET blocked_numbers error:', error);
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('GET blocked_numbers catch error:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    
    // Validate required fields (lottery_id is optional for global blocked numbers)
    if (!body.number || !body.entry_type) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน (เลข, ประเภท)' }, 
        { status: 400 }
      );
    }

    // Clean number - only digits
    const cleanNumber = body.number.replace(/\D/g, '');
    if (!cleanNumber) {
      return NextResponse.json(
        { error: 'เลขต้องเป็นตัวเลขเท่านั้น' }, 
        { status: 400 }
      );
    }

    // Check for duplicate - handle both global (null lottery_id) and specific lottery
    let duplicateQuery = supabase
      .from('blocked_numbers')
      .select('id')
      .eq('number', cleanNumber)
      .eq('entry_type', body.entry_type);
    
    if (body.lottery_id) {
      duplicateQuery = duplicateQuery.eq('lottery_id', body.lottery_id);
    } else {
      duplicateQuery = duplicateQuery.is('lottery_id', null);
    }

    const { data: existing } = await duplicateQuery.single();

    if (existing) {
      return NextResponse.json(
        { error: 'เลขนี้มีในรายการอั้นแล้ว' }, 
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('blocked_numbers')
      .insert({
        lottery_id: body.lottery_id || null,
        number: cleanNumber,
        entry_type: body.entry_type,
        limit_amount: body.limit_amount || null,
        is_blocked: body.is_blocked || false,
        note: body.note || null,
        current_amount: body.current_amount || 0,
        created_by: body.created_by || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Insert blocked number error:', error);
      return NextResponse.json(
        { error: 'ไม่สามารถบันทึกข้อมูลได้' }, 
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Blocked numbers POST error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' }, 
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ไม่พบ ID ของรายการ' }, 
        { status: 400 }
      );
    }

    // Clean number if provided
    if (updates.number) {
      updates.number = updates.number.replace(/\D/g, '');
    }

    const { data, error } = await supabase
      .from('blocked_numbers')
      .update({ 
        ...updates, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'ไม่สามารถบันทึกการแก้ไขได้' }, 
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' }, 
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'กรุณาระบุ ID ของรายการที่ต้องการลบ' }, 
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('blocked_numbers')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: 'ไม่สามารถลบรายการได้' }, 
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' }, 
      { status: 500 }
    );
  }
}
