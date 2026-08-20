import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAgentOrHigher } from '@/lib/api-auth';

// API สำหรับดึงข้อมูล Chart ยอดเล่นของ Agent (Scoped Data)
// Identity มาจาก session เท่านั้น — ไม่มี demo/random data, ไม่มีอัตราคอมปลอม
export async function GET(request: Request) {
  try {
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const requestedAgentId = searchParams.get('agent_id');
    const range = searchParams.get('range') || 'week';

    // IDOR guard: เฉพาะ admin/super_admin ที่ระบุ agent_id คนอื่นได้
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const agentId = isAdmin && requestedAgentId ? requestedAgentId : user.id;

    const supabase = await createClient();

    // Get all downline user IDs
    const { data: downlineUsers } = await supabase
      .from('users')
      .select('id')
      .eq('upline_id', agentId);

    const memberIds = downlineUsers?.map((u: any) => u.id) || [];

    // Calculate date range
    const now = new Date();
    let days = 7;
    switch (range) {
      case 'today':
        days = 1;
        break;
      case 'week':
        days = 7;
        break;
      case 'month':
        days = 30;
        break;
      case 'year':
        days = 365;
        break;
    }

    // Generate daily data (turnover จริงจาก entries, commission จริงจาก credit_transactions)
    const dailyData = [];
    const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      let turnover = 0;
      let commission = 0;

      if (memberIds.length > 0) {
        const { data: entries } = await supabase
          .from('entries')
          .select('amount')
          .in('user_id', memberIds)
          .gte('created_at', dayStart.toISOString())
          .lt('created_at', dayEnd.toISOString());

        if (entries) {
          turnover = entries.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
        }
      }

      // คอมมิชชั่นจริงของ agent ในวันนั้นจาก credit_transactions (ไม่มีอัตราปลอม)
      const { data: dayComm } = await supabase
        .from('credit_transactions')
        .select('amount')
        .eq('user_id', agentId)
        .eq('type', 'commission')
        .gte('created_at', dayStart.toISOString())
        .lt('created_at', dayEnd.toISOString());

      if (dayComm) {
        commission = dayComm.reduce((sum: number, c: any) => sum + Math.abs(Number(c.amount) || 0), 0);
      }

      dailyData.push({
        date: days <= 7 ? dayNames[date.getDay()] : `${date.getDate()}/${date.getMonth() + 1}`,
        fullDate: dayStart.toISOString().split('T')[0],
        turnover,
        commission,
      });
    }

    // Get bet type distribution (จากข้อมูลจริงเท่านั้น)
    const betTypeDistribution = [
      { name: '3 ตัวบน', value: 0 },
      { name: '3 ตัวโต๊ด', value: 0 },
      { name: '2 ตัวบน', value: 0 },
      { name: '2 ตัวล่าง', value: 0 },
      { name: 'วิ่งบน', value: 0 },
      { name: 'วิ่งล่าง', value: 0 },
    ];

    if (memberIds.length > 0) {
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const { data: entries } = await supabase
        .from('entries')
        .select('bet_type, amount')
        .in('user_id', memberIds)
        .gte('created_at', startDate.toISOString());

      if (entries) {
        const betTypeMap: Record<string, number> = {};
        let totalAmount = 0;

        entries.forEach((e: any) => {
          const amount = Number(e.amount) || 0;
          betTypeMap[e.bet_type] = (betTypeMap[e.bet_type] || 0) + amount;
          totalAmount += amount;
        });

        if (totalAmount > 0) {
          betTypeDistribution.forEach((bt) => {
            const betTypeCode = bt.name === '3 ตัวบน' ? '3top' :
                               bt.name === '3 ตัวโต๊ด' ? '3tode' :
                               bt.name === '2 ตัวบน' ? '2top' :
                               bt.name === '2 ตัวล่าง' ? '2bot' :
                               bt.name === 'วิ่งบน' ? 'run_top' : 'run_bot';

            const amount = betTypeMap[betTypeCode] || 0;
            bt.value = Math.round((amount / totalAmount) * 100);
          });
        }
      }
    }

    return NextResponse.json({
      daily: dailyData,
      betTypes: betTypeDistribution,
      range,
      agentId,
    });
  } catch (err) {
    console.error('Agent turnover chart API error:', err);
    return NextResponse.json({ error: 'Failed to fetch chart data' }, { status: 500 });
  }
}
