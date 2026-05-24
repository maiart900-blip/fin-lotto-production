import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  createDailyClosing, 
  saveDailyClosing, 
  getDailyClosings,
  getMonthlySummaries,
  getYearlySummaries,
  getTodayClosingStatus
} from '@/lib/daily-closing';

// GET - ดึงข้อมูล Daily Closing
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // ตรวจสอบ authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'daily';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const year = searchParams.get('year');

    switch (type) {
      case 'daily':
        if (!startDate || !endDate) {
          // ถ้าไม่ระบุ วันที่ ให้ดึง 30 วันล่าสุด
          const end = new Date();
          const start = new Date();
          start.setDate(start.getDate() - 30);
          
          const data = await getDailyClosings(
            start.toISOString().split('T')[0],
            end.toISOString().split('T')[0]
          );
          return NextResponse.json({ data, type: 'daily' });
        }
        const dailyData = await getDailyClosings(startDate, endDate);
        return NextResponse.json({ data: dailyData, type: 'daily' });

      case 'monthly':
        const targetYear = year ? parseInt(year) : new Date().getFullYear();
        const monthlyData = await getMonthlySummaries(targetYear);
        return NextResponse.json({ data: monthlyData, type: 'monthly', year: targetYear });

      case 'yearly':
        const yearlyData = await getYearlySummaries();
        return NextResponse.json({ data: yearlyData, type: 'yearly' });

      case 'status':
        const status = await getTodayClosingStatus();
        return NextResponse.json(status);

      case 'today':
        // สร้าง preview ของวันนี้ (ไม่บันทึก)
        const todayData = await createDailyClosing();
        return NextResponse.json({ data: todayData, type: 'preview' });

      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }
  } catch (error) {
    console.error('Daily closing GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - ปิดยอดประจำวัน (Manual Closing)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // ตรวจสอบ authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ตรวจสอบ role (ต้องเป็น admin หรือ super_admin)
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || !['super_admin', 'admin', 'manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { date, notes } = body;

    // สร้างข้อมูล Daily Closing
    const closingData = await createDailyClosing(date);
    
    if (notes) {
      closingData.details = { ...closingData.details, notes };
    }

    // บันทึกลงฐานข้อมูล
    const result = await saveDailyClosing(closingData, user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to save daily closing' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Daily closing saved successfully',
      data: closingData,
    });
  } catch (error) {
    console.error('Daily closing POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
