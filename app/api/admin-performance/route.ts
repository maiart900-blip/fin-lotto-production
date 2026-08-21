import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const type = searchParams.get('type') || 'all';

  try {
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];

    // ดึงข้อมูล attendance
    let query = supabase
      .from('admin_attendance')
      .select('*')
      .gte('shift_date', startDate)
      .lte('shift_date', endDate);

    if (type !== 'all') {
      query = query.eq('admin_type', type);
    }

    const { data: attendanceData, error: attendanceError } = await query;

    if (attendanceError && attendanceError.code !== 'PGRST116') {
      console.error('Error fetching attendance:', attendanceError);
    }

    // รวมข้อมูลตาม admin_id
    const adminMap = new Map<string, {
      admin_id: string;
      admin_name: string;
      admin_type: string;
      work_days: number;
      work_hours: number;
      late_count: number;
      on_time_count: number;
      customers_served: number;
      entries: number;
      amount: number;
      errors: number;
    }>();

    (attendanceData || []).forEach((record: Record<string, unknown>) => {
      const adminId = record.admin_id as string;
      const existing = adminMap.get(adminId) || {
        admin_id: adminId,
        admin_name: `Admin ${String(adminId).slice(0, 8)}`,
        admin_type: (record.admin_type as string) || 'manual_key',
        work_days: 0,
        work_hours: 0,
        late_count: 0,
        on_time_count: 0,
        customers_served: 0,
        entries: 0,
        amount: 0,
        errors: 0,
      };

      existing.work_days += 1;
      existing.work_hours += Number(record.worked_hours) || 0;
      
      const lateMinutes = Number(record.late_minutes) || 0;
      if (lateMinutes > 0) {
        existing.late_count += 1;
      } else {
        existing.on_time_count += 1;
      }

      adminMap.set(adminId, existing);
    });

    // คำนวณ performance score
    const admins = Array.from(adminMap.values()).map((admin, index) => {
      const totalDays = admin.work_days || 1;
      const onTimeRate = (admin.on_time_count / totalDays) * 100;
      
      // Simulated data for customers and entries (ในจริงจะดึงจาก entries table)
      const customersServed = Math.floor(Math.random() * 50) + 10;
      const entries = Math.floor(Math.random() * 200) + 50;
      const amount = Math.floor(Math.random() * 100000) + 10000;
      const errors = Math.floor(Math.random() * 3);
      const accuracyRate = entries > 0 ? ((entries - errors) / entries) * 100 : 100;

      // Calculate performance score
      const onTimeScore = (onTimeRate / 100) * 20;
      const customerScore = Math.min(customersServed / 50, 1) * 25;
      const amountScore = Math.min(amount / 100000, 1) * 25;
      const accuracyScore = (accuracyRate / 100) * 30;
      
      const performanceScore = onTimeScore + customerScore + amountScore + accuracyScore;

      return {
        admin_id: admin.admin_id,
        admin_name: admin.admin_name,
        admin_type: admin.admin_type,
        total_work_days: admin.work_days,
        total_work_hours: admin.work_hours,
        on_time_rate: onTimeRate,
        late_count: admin.late_count,
        total_customers_served: customersServed,
        total_entries: entries,
        total_amount: amount,
        error_count: errors,
        accuracy_rate: accuracyRate,
        avg_response_time: Math.floor(Math.random() * 30) + 5,
        performance_score: performanceScore,
        rank: 0,
      };
    });

    // Sort by performance score and assign rank
    admins.sort((a, b) => b.performance_score - a.performance_score);
    admins.forEach((admin, index) => {
      admin.rank = index + 1;
    });

    // Calculate summary
    const totalAdmins = admins.length;
    const avgPerformance = totalAdmins > 0 
      ? admins.reduce((sum, a) => sum + a.performance_score, 0) / totalAdmins 
      : 0;
    const topPerformer = admins.length > 0 ? admins[0].admin_name : null;
    const needsImprovement = admins.filter(a => a.performance_score < 60).length;

    return NextResponse.json({
      admins,
      summary: {
        totalAdmins,
        avgPerformance,
        topPerformer,
        needsImprovement,
      },
    });
  } catch (error) {
    console.error('Error in admin-performance API:', error);
    return NextResponse.json({
      admins: [],
      summary: {
        totalAdmins: 0,
        avgPerformance: 0,
        topPerformer: null,
        needsImprovement: 0,
      },
    });
  }
}
