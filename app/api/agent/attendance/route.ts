import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentContext } from '@/lib/agent-context';

// API สำหรับดึงข้อมูล attendance ของ sub-agents ใต้สาย (identity จาก session)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetAgentId = searchParams.get('agent_id'); // admin only
    const month = searchParams.get('month'); // format: YYYY-MM

    const ctxResult = await requireAgentContext(targetAgentId);
    if (ctxResult instanceof NextResponse) return ctxResult;
    const { context } = ctxResult;
    const agentId = context.agentId;

    const supabase = await createClient();

    // ดึง sub-agents ที่อยู่ใต้สาย agent นี้ (scope ด้วย tenant)
    let subAgentsQuery = supabase
      .from('agents')
      .select('id, name, code')
      .eq('parent_agent_id', agentId);
    subAgentsQuery = context.tenantId === null
      ? subAgentsQuery.is('tenant_id', null)
      : subAgentsQuery.eq('tenant_id', context.tenantId);
    const { data: subAgents } = await subAgentsQuery;

    const subAgentIds = subAgents?.map(s => s.id) || [];

    if (subAgentIds.length === 0) {
      return NextResponse.json({
        records: [],
        summary: {
          total_staff: 0,
          total_work_days: 0,
          total_absent: 0,
          total_late: 0,
        },
      });
    }

    // กำหนดช่วงวันที่
    let startDate: Date;
    let endDate: Date;

    if (month) {
      const [year, m] = month.split('-').map(Number);
      startDate = new Date(year, m - 1, 1);
      endDate = new Date(year, m, 0, 23, 59, 59, 999);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // ดึงข้อมูล attendance (ถ้ามี table)
    // หมายเหตุ: ถ้าไม่มี attendance table จะ return mock data
    let records: any[] = [];
    let summary = {
      total_staff: subAgents?.length || 0,
      total_work_days: 0,
      total_absent: 0,
      total_late: 0,
    };

    try {
      const { data: attendanceRecords, error } = await supabase
        .from('attendance_records')
        .select('*')
        .in('agent_id', subAgentIds)
        .gte('date', startDate.toISOString())
        .lte('date', endDate.toISOString())
        .order('date', { ascending: false });

      if (!error && attendanceRecords) {
        // Map staff names
        const staffMap = new Map(subAgents?.map(s => [s.id, s.name]) || []);
        
        records = attendanceRecords.map(r => ({
          ...r,
          staff_name: staffMap.get(r.agent_id) || 'Unknown',
        }));

        // Calculate summary
        summary.total_work_days = records.filter(r => r.status === 'present' || r.status === 'late').length;
        summary.total_absent = records.filter(r => r.status === 'absent').length;
        summary.total_late = records.filter(r => r.status === 'late').length;
      }
    } catch {
      // Table might not exist - return empty data
      console.log('Attendance table not found, returning empty data');
    }

    return NextResponse.json({
      records,
      summary,
      sub_agents: subAgents,
    });
  } catch (error) {
    console.error('Agent attendance error:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
  }
}
