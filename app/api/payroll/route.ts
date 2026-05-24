import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// ฟังก์ชันแปลงเวลาเป็นเวลาไทย (UTC+7)
function getThaiTime(): Date {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (7 * 60 * 60 * 1000));
}

// GET - ดึงข้อมูล payroll summary
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const month = parseInt(searchParams.get('month') || String(getThaiTime().getMonth() + 1));
  const year = parseInt(searchParams.get('year') || String(getThaiTime().getFullYear()));
  const adminId = searchParams.get('admin_id');

  try {
    // ดึงข้อมูล payroll settings
    const { data: settings } = await supabase
      .from('payroll_settings')
      .select('*')
      .single();

    // ดึงข้อมูล payroll ของเดือนที่เลือก
    let query = supabase
      .from('admin_payroll')
      .select('*')
      .eq('month', month)
      .eq('year', year);

    if (adminId) {
      query = query.eq('admin_id', adminId);
    }

    const { data: payrolls, error } = await query.order('net_salary', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      settings: settings || {},
      payrolls: payrolls || [],
      month,
      year,
    });
  } catch (error) {
    console.error('Error fetching payroll:', error);
    return NextResponse.json({ error: 'Failed to fetch payroll data' }, { status: 500 });
  }
}

// POST - คำนวณเงินเดือนรายเดือน
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { month, year } = body;

  if (!month || !year) {
    return NextResponse.json({ error: 'month and year are required' }, { status: 400 });
  }

  try {
    // ดึงข้อมูล settings
    const { data: settings } = await supabase
      .from('payroll_settings')
      .select('*')
      .single();

    const baseSalary = settings?.base_salary || 15000;
    const bonusPerCustomer = settings?.bonus_per_customer || 10;
    const bonusNoError = settings?.bonus_no_error || 500;
    const bonusTopPerformer = settings?.bonus_top_performer || 1000;

    // ดึงข้อมูลการเข้างานทั้งหมดของเดือน
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const { data: attendances, error: attError } = await supabase
      .from('admin_attendance')
      .select('*')
      .gte('shift_date', startDate)
      .lte('shift_date', endDate)
      .eq('status', 'off_duty');

    if (attError) throw attError;

    // จัดกลุ่มตาม admin_id
    const adminStats: Record<string, {
      admin_id: string;
      admin_type: string;
      work_days: number;
      work_hours: number;
      late_minutes: number;
      late_penalty: number;
      ot_hours: number;
      ot_pay: number;
      customers_served: number;
      has_error: boolean;
    }> = {};

    for (const att of (attendances || [])) {
      if (!adminStats[att.admin_id]) {
        adminStats[att.admin_id] = {
          admin_id: att.admin_id,
          admin_type: att.admin_type || 'general',
          work_days: 0,
          work_hours: 0,
          late_minutes: 0,
          late_penalty: 0,
          ot_hours: 0,
          ot_pay: 0,
          customers_served: 0,
          has_error: false,
        };
      }

      adminStats[att.admin_id].work_days += 1;
      adminStats[att.admin_id].work_hours += parseFloat(att.worked_hours || 0);
      adminStats[att.admin_id].late_minutes += parseInt(att.late_minutes || 0);
      adminStats[att.admin_id].late_penalty += parseFloat(att.late_penalty || 0);
      adminStats[att.admin_id].ot_hours += parseFloat(att.ot_hours || 0);
      adminStats[att.admin_id].ot_pay += parseFloat(att.ot_pay || 0);
      
      if (att.verification_passed === false) {
        adminStats[att.admin_id].has_error = true;
      }
    }

    // ดึงข้อมูลลูกค้าที่รับได้ต่อ admin (ถ้ามี)
    // และจำนวนโพย/entries ที่คีย์ได้
    for (const adminId of Object.keys(adminStats)) {
      // นับลูกค้าใหม่ที่สร้าง
      const { count: customerCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', adminId)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59');

      // นับ entries ที่คีย์ได้ (สำหรับแอดมินคีย์หวย)
      const { count: entriesCount } = await supabase
        .from('entries')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', adminId)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59');

      // รวมทั้งลูกค้าและ entries
      adminStats[adminId].customers_served = (customerCount || 0) + (entriesCount || 0);
    }

    // หา top performer (คนที่รับลูกค้าได้เยอะสุด)
    let topPerformerId = '';
    let maxCustomers = 0;
    for (const [adminId, stats] of Object.entries(adminStats)) {
      if (stats.customers_served > maxCustomers) {
        maxCustomers = stats.customers_served;
        topPerformerId = adminId;
      }
    }

    // คำนวณและบันทึก payroll
    const payrollResults = [];
    for (const [adminId, stats] of Object.entries(adminStats)) {
      const customerBonus = stats.customers_served * bonusPerCustomer;
      const noErrorBonus = !stats.has_error ? bonusNoError : 0;
      const topBonus = adminId === topPerformerId && maxCustomers > 0 ? bonusTopPerformer : 0;
      const totalBonus = customerBonus + noErrorBonus + topBonus;
      const totalDeductions = stats.late_penalty;
      const netSalary = baseSalary + stats.ot_pay + totalBonus - totalDeductions;

      const payrollData = {
        admin_id: adminId,
        admin_name: `Admin ${adminId.substring(0, 8)}`,
        admin_type: stats.admin_type,
        month,
        year,
        base_salary: baseSalary,
        total_work_days: stats.work_days,
        total_work_hours: stats.work_hours,
        total_late_minutes: stats.late_minutes,
        total_late_penalty: stats.late_penalty,
        total_ot_hours: stats.ot_hours,
        total_ot_pay: stats.ot_pay,
        total_customers_served: stats.customers_served,
        customer_bonus: customerBonus,
        no_error_bonus: noErrorBonus,
        top_performer_bonus: topBonus,
        total_bonus: totalBonus,
        total_deductions: totalDeductions,
        net_salary: netSalary,
        status: 'calculated',
        calculated_at: new Date().toISOString(),
      };

      // Upsert payroll
      const { data, error } = await supabase
        .from('admin_payroll')
        .upsert(payrollData, { onConflict: 'admin_id,month,year' })
        .select()
        .single();

      if (error) throw error;
      payrollResults.push(data);
    }

    return NextResponse.json({
      message: 'Payroll calculated successfully',
      count: payrollResults.length,
      payrolls: payrollResults,
    });
  } catch (error) {
    console.error('Error calculating payroll:', error);
    return NextResponse.json({ error: 'Failed to calculate payroll' }, { status: 500 });
  }
}

// PUT - อัปเดต payroll settings
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  try {
    const { data, error } = await supabase
      .from('payroll_settings')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      message: 'Settings updated successfully',
      settings: data 
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
