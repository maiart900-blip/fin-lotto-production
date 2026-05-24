import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const type = searchParams.get('type') || 'all';
  const mode = searchParams.get('mode') || 'daily';

  try {
    let startDate: string;
    let endDate: string;

    if (mode === 'daily') {
      startDate = date;
      endDate = date;
    } else {
      const [year, month] = date.split('-').map(Number);
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      endDate = new Date(year, month, 0).toISOString().split('T')[0];
    }

    // ดึงข้อมูล attendance เพื่อรู้ว่าแอดมินไหนทำงานวันนั้น
    let query = supabase
      .from('admin_attendance')
      .select('admin_id, admin_type')
      .gte('shift_date', startDate)
      .lte('shift_date', endDate);

    if (type !== 'all') {
      query = query.eq('admin_type', type);
    }

    const { data: attendanceData } = await query;

    // รวมข้อมูลแอดมิน (ใช้ simulated data สำหรับ demo)
    const adminSet = new Set<string>();
    const adminTypes: Record<string, string> = {};
    
    (attendanceData || []).forEach((record: { admin_id: string; admin_type: string }) => {
      adminSet.add(record.admin_id);
      adminTypes[record.admin_id] = record.admin_type || 'manual_key';
    });

    // สร้างข้อมูลยอดแอดมิน (ในจริงจะดึงจาก entries table)
    const admins = Array.from(adminSet).map((adminId) => {
      const totalCustomers = Math.floor(Math.random() * 30) + 5;
      const totalEntries = Math.floor(Math.random() * 150) + 20;
      const totalSales = Math.floor(Math.random() * 80000) + 5000;
      const totalPayout = Math.floor(totalSales * (Math.random() * 0.3 + 0.1));
      const netProfit = totalSales - totalPayout;

      return {
        admin_id: adminId,
        admin_name: `Admin ${String(adminId).slice(0, 8)}`,
        admin_type: adminTypes[adminId] || 'manual_key',
        total_customers: totalCustomers,
        total_entries: totalEntries,
        total_sales: totalSales,
        total_payout: totalPayout,
        net_profit: netProfit,
      };
    });

    // คำนวณ summary
    const summary = {
      totalSales: admins.reduce((sum, a) => sum + a.total_sales, 0),
      totalPayout: admins.reduce((sum, a) => sum + a.total_payout, 0),
      netProfit: admins.reduce((sum, a) => sum + a.net_profit, 0),
      totalEntries: admins.reduce((sum, a) => sum + a.total_entries, 0),
      totalCustomers: admins.reduce((sum, a) => sum + a.total_customers, 0),
    };

    return NextResponse.json({ admins, summary });
  } catch (error) {
    console.error('Error in admin-sales-report API:', error);
    return NextResponse.json({
      admins: [],
      summary: {
        totalSales: 0,
        totalPayout: 0,
        netProfit: 0,
        totalEntries: 0,
        totalCustomers: 0,
      },
    });
  }
}
