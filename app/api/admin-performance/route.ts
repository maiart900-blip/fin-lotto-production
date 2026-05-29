import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

// Commission tier logic based on slip count
function getCommissionTier(slipCount: number): { rate: number; tier: string } {
  if (slipCount >= 100) return { rate: 0.25, tier: 'Gold' };
  if (slipCount >= 50) return { rate: 0.20, tier: 'Silver' };
  return { rate: 0.15, tier: 'Bronze' };
}

export async function GET(request: NextRequest) {
  // Auth guard - require admin
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const type = searchParams.get('type') || 'all';
  const viewType = searchParams.get('view') || 'monthly'; // 'daily' or 'monthly'

  try {
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];
    
    // For daily view, use today's date
    const today = new Date().toISOString().split('T')[0];
    const queryStartDate = viewType === 'daily' ? today : startDate;
    const queryEndDate = viewType === 'daily' ? today : endDate;

    // Get attendance data
    let attendanceQuery = supabase
      .from('admin_attendance')
      .select('*')
      .gte('shift_date', queryStartDate)
      .lte('shift_date', queryEndDate);

    if (type !== 'all') {
      attendanceQuery = attendanceQuery.eq('admin_type', type);
    }

    const { data: attendanceData, error: attendanceError } = await attendanceQuery;

    if (attendanceError && attendanceError.code !== 'PGRST116') {
      console.error('Error fetching attendance:', attendanceError);
    }

    // Get admin users for names
    const { data: adminUsers } = await supabase
      .from('admin_users')
      .select('id, username, display_name, role');

    const adminNameMap = new Map<string, { name: string; role: string }>();
    (adminUsers || []).forEach((admin: { id: string; username: string; display_name?: string; role: string }) => {
      adminNameMap.set(admin.id, {
        name: admin.display_name || admin.username,
        role: admin.role,
      });
    });

    // Build admin performance map
    const adminMap = new Map<string, {
      admin_id: string;
      admin_name: string;
      admin_type: string;
      admin_role: string;
      work_days: number;
      work_hours: number;
      late_count: number;
      on_time_count: number;
      shift_status: 'on_duty' | 'off_duty' | 'no_shift';
      current_shift_start: string | null;
    }>();

    (attendanceData || []).forEach((record: Record<string, unknown>) => {
      const adminId = record.admin_id as string;
      const adminInfo = adminNameMap.get(adminId);
      const existing = adminMap.get(adminId) || {
        admin_id: adminId,
        admin_name: adminInfo?.name || `Admin ${String(adminId).slice(0, 8)}`,
        admin_type: (record.admin_type as string) || 'manual_key',
        admin_role: adminInfo?.role || 'agent',
        work_days: 0,
        work_hours: 0,
        late_count: 0,
        on_time_count: 0,
        shift_status: 'no_shift' as const,
        current_shift_start: null,
      };

      existing.work_days += 1;
      existing.work_hours += Number(record.worked_hours) || 0;
      
      const lateMinutes = Number(record.late_minutes) || 0;
      if (lateMinutes > 0) {
        existing.late_count += 1;
      } else {
        existing.on_time_count += 1;
      }

      // Check current shift status
      const shiftDate = record.shift_date as string;
      if (shiftDate === today) {
        existing.shift_status = (record.status as 'on_duty' | 'off_duty') || 'on_duty';
        existing.current_shift_start = record.clock_in as string | null;
      }

      adminMap.set(adminId, existing);
    });

    // Get REAL entries data for each admin
    const adminIds = Array.from(adminMap.keys());
    
    // Query entries table for real slip/entries data
    const { data: entriesData, error: entriesError } = await supabase
      .from('entries')
      .select('created_by, amount, total_amount, created_at')
      .in('created_by', adminIds.length > 0 ? adminIds : ['none'])
      .gte('created_at', queryStartDate)
      .lte('created_at', queryEndDate + 'T23:59:59');

    if (entriesError && entriesError.code !== 'PGRST116') {
      console.error('Error fetching entries:', entriesError);
    }

    // Aggregate entries by admin
    const entriesMap = new Map<string, { count: number; amount: number }>();
    (entriesData || []).forEach((entry: { created_by: string; amount?: number; total_amount?: number }) => {
      const adminId = entry.created_by;
      const existing = entriesMap.get(adminId) || { count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += entry.amount || entry.total_amount || 0;
      entriesMap.set(adminId, existing);
    });

    // Also check for admins with entries but no attendance (just in case)
    const uniqueEntryAdmins = new Set((entriesData || []).map((e: { created_by: string }) => e.created_by));
    uniqueEntryAdmins.forEach(adminId => {
      if (!adminMap.has(adminId)) {
        const adminInfo = adminNameMap.get(adminId);
        adminMap.set(adminId, {
          admin_id: adminId,
          admin_name: adminInfo?.name || `Admin ${adminId.slice(0, 8)}`,
          admin_type: 'manual_key',
          admin_role: adminInfo?.role || 'agent',
          work_days: 0,
          work_hours: 0,
          late_count: 0,
          on_time_count: 0,
          shift_status: 'no_shift',
          current_shift_start: null,
        });
      }
    });

    // Build final admin performance data with REAL numbers
    const admins = Array.from(adminMap.values()).map((admin) => {
      const totalDays = admin.work_days || 1;
      const onTimeRate = (admin.on_time_count / totalDays) * 100;
      
      // REAL data from entries table
      const entriesInfo = entriesMap.get(admin.admin_id) || { count: 0, amount: 0 };
      const totalSlips = entriesInfo.count;
      const totalVolume = entriesInfo.amount;
      
      // Commission tier based on slip count
      const { rate: commissionRate, tier: commissionTier } = getCommissionTier(totalSlips);
      const dailyPayout = totalVolume * commissionRate;

      // Calculate performance score based on real metrics
      const onTimeScore = (onTimeRate / 100) * 20;
      const slipScore = Math.min(totalSlips / 100, 1) * 30;
      const volumeScore = Math.min(totalVolume / 50000, 1) * 30;
      const attendanceScore = Math.min(admin.work_days / 26, 1) * 20;
      
      const performanceScore = onTimeScore + slipScore + volumeScore + attendanceScore;

      return {
        admin_id: admin.admin_id,
        admin_name: admin.admin_name,
        admin_type: admin.admin_type,
        admin_role: admin.admin_role,
        shift_status: admin.shift_status,
        current_shift_start: admin.current_shift_start,
        total_work_days: admin.work_days,
        total_work_hours: admin.work_hours,
        on_time_rate: onTimeRate,
        late_count: admin.late_count,
        // REAL metrics
        total_slips: totalSlips,
        total_volume: totalVolume,
        commission_rate: commissionRate,
        commission_tier: commissionTier,
        daily_payout: dailyPayout,
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
    const totalSlipsAll = admins.reduce((sum, a) => sum + a.total_slips, 0);
    const totalVolumeAll = admins.reduce((sum, a) => sum + a.total_volume, 0);
    const onDutyCount = admins.filter(a => a.shift_status === 'on_duty').length;

    return NextResponse.json({
      admins,
      summary: {
        totalAdmins,
        avgPerformance,
        topPerformer,
        needsImprovement,
        totalSlips: totalSlipsAll,
        totalVolume: totalVolumeAll,
        onDutyCount,
      },
      commissionTiers: [
        { tier: 'Bronze', minSlips: 0, maxSlips: 49, rate: 0.15 },
        { tier: 'Silver', minSlips: 50, maxSlips: 99, rate: 0.20 },
        { tier: 'Gold', minSlips: 100, maxSlips: null, rate: 0.25 },
      ],
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
        totalSlips: 0,
        totalVolume: 0,
        onDutyCount: 0,
      },
      commissionTiers: [],
    });
  }
}
