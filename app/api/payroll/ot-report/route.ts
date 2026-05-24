import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const OT_RATE_PER_HOUR = 45;
const REGULAR_HOURS_PER_DAY = 8;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const type = searchParams.get('type') || 'all';

  try {
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];

    let query = supabase
      .from('admin_attendance')
      .select('*')
      .gte('shift_date', startDate)
      .lte('shift_date', endDate)
      .eq('status', 'off_duty');

    if (type !== 'all') {
      query = query.eq('admin_type', type);
    }

    const { data: attendanceData } = await query;

    // รวมข้อมูลตาม admin_id
    const adminMap = new Map<string, {
      admin_id: string;
      admin_name: string;
      admin_type: string;
      work_days: number;
      total_hours: number;
      ot_hours: number;
      ot_pay: number;
    }>();

    (attendanceData || []).forEach((record: Record<string, unknown>) => {
      const adminId = record.admin_id as string;
      const existing = adminMap.get(adminId) || {
        admin_id: adminId,
        admin_name: `Admin ${String(adminId).slice(0, 8)}`,
        admin_type: (record.admin_type as string) || 'manual_key',
        work_days: 0,
        total_hours: 0,
        ot_hours: 0,
        ot_pay: 0,
      };

      existing.work_days += 1;
      const workedHours = Number(record.worked_hours) || 0;
      existing.total_hours += workedHours;
      
      const otHours = Number(record.ot_hours) || 0;
      existing.ot_hours += otHours;
      existing.ot_pay += Number(record.ot_pay) || (otHours * OT_RATE_PER_HOUR);

      adminMap.set(adminId, existing);
    });

    const admins = Array.from(adminMap.values())
      .filter(admin => admin.ot_hours > 0)
      .map(admin => ({
        ...admin,
        regular_hours: admin.work_days * REGULAR_HOURS_PER_DAY,
      }))
      .sort((a, b) => b.ot_hours - a.ot_hours);

    // Summary
    const summary = {
      totalAdmins: admins.length,
      totalOTHours: admins.reduce((sum, a) => sum + a.ot_hours, 0),
      totalOTPay: admins.reduce((sum, a) => sum + a.ot_pay, 0),
      avgOTHours: admins.length > 0 
        ? admins.reduce((sum, a) => sum + a.ot_hours, 0) / admins.length 
        : 0,
    };

    return NextResponse.json({ admins, summary });
  } catch (error) {
    console.error('Error in OT report API:', error);
    return NextResponse.json({
      admins: [],
      summary: {
        totalAdmins: 0,
        totalOTHours: 0,
        totalOTPay: 0,
        avgOTHours: 0,
      },
    });
  }
}
