import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { 
  createDailyClosing, 
  saveDailyClosing, 
  getDailyClosings,
  searchDailyClosings,
  searchTransactionDetails,
  getMonthlySummaries,
  getYearlySummaries,
  getTodayClosingStatus,
  lockDailyClosing,
  unlockDailyClosing,
  editDailyClosing,
  getAuditLogs,
  getAnomalies,
  type SearchFilters,
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

    // ตรวจสอบ role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || !['super_admin', 'admin', 'manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'daily';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const year = searchParams.get('year');
    const closingDate = searchParams.get('date');

    switch (type) {
      case 'daily': {
        if (!startDate || !endDate) {
          // Default: 30 วันล่าสุด
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
      }

      case 'search': {
        const filters: SearchFilters = {
          startDate: searchParams.get('startDate') || undefined,
          endDate: searchParams.get('endDate') || undefined,
          userId: searchParams.get('userId') || undefined,
          agentId: searchParams.get('agentId') || undefined,
          phone: searchParams.get('phone') || undefined,
          betId: searchParams.get('betId') || undefined,
          minAmount: searchParams.get('minAmount') ? Number(searchParams.get('minAmount')) : undefined,
          maxAmount: searchParams.get('maxAmount') ? Number(searchParams.get('maxAmount')) : undefined,
          status: searchParams.get('status') || undefined,
          hasAnomalies: searchParams.get('hasAnomalies') === 'true' ? true : 
                        searchParams.get('hasAnomalies') === 'false' ? false : undefined,
        };
        const searchResults = await searchDailyClosings(filters);
        return NextResponse.json({ data: searchResults, type: 'search', filters });
      }

      case 'details': {
        if (!closingDate) {
          return NextResponse.json({ error: 'Date is required' }, { status: 400 });
        }
        const filters: SearchFilters = {
          userId: searchParams.get('userId') || undefined,
          betId: searchParams.get('betId') || undefined,
        };
        const details = await searchTransactionDetails(closingDate, filters);
        return NextResponse.json({ data: details, type: 'details', date: closingDate });
      }

      case 'monthly': {
        const targetYear = year ? parseInt(year) : new Date().getFullYear();
        const monthlyData = await getMonthlySummaries(targetYear);
        return NextResponse.json({ data: monthlyData, type: 'monthly', year: targetYear });
      }

      case 'yearly': {
        const yearlyData = await getYearlySummaries();
        return NextResponse.json({ data: yearlyData, type: 'yearly' });
      }

      case 'status': {
        const status = await getTodayClosingStatus();
        return NextResponse.json(status);
      }

      case 'today': {
        // สร้าง preview ของวันนี้ (ไม่บันทึก)
        const todayData = await createDailyClosing();
        return NextResponse.json({ data: todayData, type: 'preview' });
      }

      case 'audit-logs': {
        if (!closingDate) {
          return NextResponse.json({ error: 'Date is required' }, { status: 400 });
        }
        const auditLogs = await getAuditLogs(closingDate);
        return NextResponse.json({ data: auditLogs, type: 'audit-logs', date: closingDate });
      }

      case 'anomalies': {
        if (!closingDate) {
          return NextResponse.json({ error: 'Date is required' }, { status: 400 });
        }
        const anomalies = await getAnomalies(closingDate);
        return NextResponse.json({ data: anomalies, type: 'anomalies', date: closingDate });
      }

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

// POST - ปิดยอดประจำวัน / Lock / Unlock / Edit
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // ตรวจสอบ authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ตรวจสอบ role
    const { data: userData } = await supabase
      .from('users')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    if (!userData || !['super_admin', 'admin', 'manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action, date, notes, reason, updates } = body;

    // Get IP for audit
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0] || 
                      headersList.get('x-real-ip') || 
                      'unknown';

    switch (action) {
      case 'close':
      case undefined: {
        // ปิดยอดประจำวัน (Manual Closing)
        const closingData = await createDailyClosing(date);
        
        if (notes) {
          closingData.details = { ...closingData.details, notes };
        }

        const result = await saveDailyClosing(closingData, user.id, 'manual', notes);

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
      }

      case 'lock': {
        if (!date) {
          return NextResponse.json({ error: 'Date is required' }, { status: 400 });
        }

        // Admin และ Super Admin สามารถ lock ได้
        const result = await lockDailyClosing(date, user.id);

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: 'Daily closing locked successfully',
        });
      }

      case 'unlock': {
        if (!date || !reason) {
          return NextResponse.json({ error: 'Date and reason are required' }, { status: 400 });
        }

        // Only Super Admin สามารถ unlock ได้
        if (userData.role !== 'super_admin') {
          return NextResponse.json({ error: 'Only Super Admin can unlock' }, { status: 403 });
        }

        const result = await unlockDailyClosing(date, user.id, reason);

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: 'Daily closing unlocked successfully',
        });
      }

      case 'edit': {
        if (!date || !reason || !updates) {
          return NextResponse.json({ error: 'Date, reason, and updates are required' }, { status: 400 });
        }

        // Only Super Admin สามารถ edit locked records ได้
        if (userData.role !== 'super_admin') {
          return NextResponse.json({ error: 'Only Super Admin can edit' }, { status: 403 });
        }

        const result = await editDailyClosing(date, updates, user.id, reason);

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: 'Daily closing updated successfully',
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Daily closing POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
