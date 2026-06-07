import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAgentOrHigher } from '@/lib/api-auth';

// GET - ดึงการตั้งค่าหวยของเอเย่น
export async function GET(request: NextRequest) {
  try {
    // Auth guard - require agent or higher
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');

    if (!agentId) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }

    // ดึงข้อมูลเอเย่น
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name, share_percent')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // ดึงรายการหวยทั้งหมด (ใช้ * เหมือน lotteries API หลัก)
    const { data: lotteries, error: lotteriesError } = await supabase
      .from('lotteries')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (lotteriesError) {
      console.error('lottery query error:', lotteriesError);
      return NextResponse.json({ error: lotteriesError.message, agent }, { status: 500 });
    }

    // ดึงการตั้งค่าหวยของเอเย่น
    const { data: agentSettings } = await supabase
      .from('agent_lottery_settings')
      .select('*')
      .eq('agent_id', agentId);

    // รวมข้อมูล - ถ้าไม่มีการตั้งค่าก็ใช้ค่า default
    const settings = (lotteries || []).map(lottery => {
      const setting = agentSettings?.find(s => s.lottery_id === lottery.id);
      return {
        lottery_id: lottery.id,
        lottery_name: lottery.name,
        master_status: lottery.is_active ? 'active' : 'closed', // สถานะจากเว็บแม่
        master_close_time: lottery.close_time,
        // การตั้งค่าของเอเย่น
        agent_status: setting?.status || 'active', // active, paused, closed
        agent_close_time: setting?.close_time || lottery.close_time,
        custom_payout_rate: setting?.custom_payout_rate || null,
        max_per_number: setting?.max_per_number || null, // จำกัดยอดต่อเลข
        created_at: setting?.created_at,
        updated_at: setting?.updated_at,
      };
    });

    return NextResponse.json({
      agent,
      settings,
      total: settings.length,
    });
  } catch (error: any) {
    console.error('Error fetching agent lottery settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST/PATCH - อัพเดทการตั้งค่าหวยของเอเย่น - AGENT OR HIGHER
export async function POST(request: NextRequest) {
  try {
    // Auth guard - require agent or higher for updating settings
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const body = await request.json();
    const { agent_id, lottery_id, status, close_time, custom_payout_rate, max_per_number } = body;

    if (!agent_id || !lottery_id) {
      return NextResponse.json({ error: 'agent_id and lottery_id are required' }, { status: 400 });
    }

    // ตรวจสอบว่าหวยจากเว็บแม่เปิดอยู่หรือไม่
    const { data: lottery } = await supabase
      .from('lotteries')
      .select('id, is_active')
      .eq('id', lottery_id)
      .single();

    if (!lottery) {
      return NextResponse.json({ error: 'Lottery not found' }, { status: 404 });
    }

    // ถ้าเว็บแม่ปิดหวยนี้ เอเย่นจะเปิดไม่ได้
    if (!lottery.is_active && status === 'active') {
      return NextResponse.json({ 
        error: 'ไม่สามารถเปิดหวยนี้ได้ เว็บแม่ปิดรับแล้ว' 
      }, { status: 400 });
    }

    // Upsert การตั้งค่า
    const { data, error } = await supabase
      .from('agent_lottery_settings')
      .upsert({
        agent_id,
        lottery_id,
        status: status || 'active',
        close_time: close_time || null,
        custom_payout_rate: custom_payout_rate || null,
        max_per_number: max_per_number || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'agent_id,lottery_id',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      setting: data,
      message: 'อัพเดทการตั้งค่าหวยสำเร็จ',
    });
  } catch (error: any) {
    console.error('Error updating agent lottery settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
