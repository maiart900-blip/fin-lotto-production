import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// ฟังก์ชันแปลงเวลาเป็นเวลาไทย (UTC+7)
function getThaiTime(): Date {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (7 * 60 * 60 * 1000));
}

function getThaiDateString(): string {
  const thaiTime = getThaiTime();
  return thaiTime.toISOString().split('T')[0];
}

function getThaiTimeString(): string {
  return getThaiTime().toISOString();
}

// ตั้งค่าเวลาเข้างานปกติ (08:00 - 09:00)
const WORK_START_HOUR = 9; // เวลาเข้างานปกติ 09:00
const LATE_PENALTY_PER_MINUTE = 5; // หักนาทีละ 5 บาท
const OT_RATE_PER_HOUR = 45; // โอทีชั่วโมงละ 45 บาท
const WORK_HOURS_PER_DAY = 8; // ชั่วโมงทำงานปกติ
const REST_DAYS_PER_WEEK = 1; // วันหยุด 1 วันต่อสัปดาห์

// GET - ดึงข้อมูลการเข้างานของแอดมิน
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const adminId = searchParams.get('admin_id');
  const date = searchParams.get('date');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  let query = supabase
    .from('admin_attendance')
    .select('*')
    .order('shift_date', { ascending: false })
    .order('clock_in_at', { ascending: false });

  if (adminId) {
    query = query.eq('admin_id', adminId);
  }
  
  if (date) {
    query = query.eq('shift_date', date);
  }
  
  if (startDate && endDate) {
    query = query.gte('shift_date', startDate).lte('shift_date', endDate);
  }

  const { data, error } = await query.limit(100);

  if (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST - บันทึกเข้างาน (Clock In) - ใช้เวลาไทยเท่านั้น
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { admin_id, admin_type = 'manual_key', note } = body;

  if (!admin_id) {
    return NextResponse.json({ error: 'admin_id is required' }, { status: 400 });
  }

  // ใช้เวลาไทยเท่านั้น - ห้ามใส่เวลาเอง
  const thaiTime = getThaiTime();
  const today = getThaiDateString();
  const now = getThaiTimeString();
  
  // คำนวณว่าเข้างานสายหรือไม่
  const clockInHour = thaiTime.getHours();
  const clockInMinute = thaiTime.getMinutes();
  let lateMinutes = 0;
  
  if (clockInHour > WORK_START_HOUR || (clockInHour === WORK_START_HOUR && clockInMinute > 0)) {
    lateMinutes = ((clockInHour - WORK_START_HOUR) * 60) + clockInMinute;
  }
  
  const latePenalty = lateMinutes * LATE_PENALTY_PER_MINUTE;

  // ตรวจสอบว่าวันนี้มีบันทึกแล้วหรือยัง
  const { data: existing } = await supabase
    .from('admin_attendance')
    .select('*')
    .eq('admin_id', admin_id)
    .eq('shift_date', today)
    .single();

  if (existing) {
    // ถ้ามีแล้วและยังไม่ได้ออกงาน ไม่อนุญาตให้เข้างานซ้ำ
    if (existing.status === 'on_duty') {
      return NextResponse.json({ 
        error: 'คุณได้เข้างานวันนี้แล้ว กรุณาออกงานก่อน',
        attendance: existing 
      }, { status: 400 });
    }
    
    // ถ้าออกงานแล้ว อัปเดตเป็นเข้างานใหม่
    const { data, error } = await supabase
      .from('admin_attendance')
      .update({
        clock_in_at: now,
        clock_out_at: null,
        status: 'on_duty',
        note: note || null,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'เข้างานสำเร็จ',
      attendance: data 
    });
  }

  // สร้างบันทึกใหม่
  const { data, error } = await supabase
    .from('admin_attendance')
    .insert({
      admin_id,
      admin_type,
      shift_date: today,
      clock_in_at: now,
      status: 'on_duty',
      late_minutes: lateMinutes,
      late_penalty: latePenalty,
      note: lateMinutes > 0 ? `[${admin_type === 'manual_key' ? 'คีย์หวย' : 'ออโต้'}] เข้างานสาย ${lateMinutes} นาที หัก ${latePenalty} บาท${note ? ' | ' + note : ''}` : `[${admin_type === 'manual_key' ? 'คีย์หวย' : 'ออโต้'}] ${note || ''}`.trim(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error clock in:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ 
    message: 'เข้างานสำเร็จ',
    attendance: data 
  });
}

// PUT - บันทึกออกงาน (Clock Out) - ใช้เวลาไทยเท่านั้น พร้อมคำนวณ OT
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { admin_id, note, verification_passed } = body;

  if (!admin_id) {
    return NextResponse.json({ error: 'admin_id is required' }, { status: 400 });
  }

  // ใช้เวลาไทยเท่านั้น
  const today = getThaiDateString();
  const now = getThaiTimeString();

  // หาบันทึกที่กำลังเข้างานอยู่
  const { data: existing } = await supabase
    .from('admin_attendance')
    .select('*')
    .eq('admin_id', admin_id)
    .eq('shift_date', today)
    .eq('status', 'on_duty')
    .single();

  if (!existing) {
    return NextResponse.json({ 
      error: 'ไม่พบบันทึกเข้างาน กรุณาเข้างานก่อน' 
    }, { status: 400 });
  }

  // คำนวณชั่วโมงทำงานและ OT
  const clockIn = new Date(existing.clock_in_at);
  const clockOut = getThaiTime();
  const workedMs = clockOut.getTime() - clockIn.getTime();
  const workedHours = workedMs / (1000 * 60 * 60);
  const workedMinutes = Math.floor((workedMs / (1000 * 60)) % 60);
  
  // คำนวณ OT (เกิน 8 ชั่วโมง)
  let otHours = 0;
  let otPay = 0;
  if (workedHours > WORK_HOURS_PER_DAY) {
    otHours = workedHours - WORK_HOURS_PER_DAY;
    otPay = Math.floor(otHours * OT_RATE_PER_HOUR);
  }

  // อัปเดตเป็นออกงาน พร้อมข้อมูล payroll
  const { data, error } = await supabase
    .from('admin_attendance')
    .update({
      clock_out_at: now,
      status: 'off_duty',
      worked_hours: Math.floor(workedHours),
      worked_minutes: workedMinutes,
      ot_hours: otHours,
      ot_pay: otPay,
      verification_passed: verification_passed ?? true,
      note: note ? `${existing.note || ''} | ออกงาน: ${note}`.trim() : existing.note,
      updated_at: now,
    })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) {
    console.error('Error clock out:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ 
    message: 'ออกงานสำเร็จ',
    attendance: data 
  });
}
