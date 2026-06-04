import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentOrHigher } from '@/lib/api-auth';

// API สำหรับดึงข้อมูลเงินเดือนของ sub-agents ใต้สาย
export async function GET(request: Request) {
  try {
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const month = searchParams.get('month'); // format: YYYY-MM

    if (!agentId) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // ดึง sub-agents ที่อยู่ใต้สาย agent นี้
    const { data: subAgents } = await supabase
      .from('agents')
      .select('id, name, code, share_percent')
      .eq('parent_agent_id', agentId);

    if (!subAgents || subAgents.length === 0) {
      return NextResponse.json({
        salaries: [],
        summary: {
          total_staff: 0,
          total_salary: 0,
          total_bonus: 0,
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

    // คำนวณเงินเดือนจากผลงาน (entries ที่คีย์ในเดือนนั้น)
    const salaries = await Promise.all(
      subAgents.map(async (staff) => {
        // ดึง entries ของ sub-agent
        const { data: entries } = await supabase
          .from('entries')
          .select('amount')
          .eq('agent_id', staff.id)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());

        const totalAmount = entries?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
        
        // คำนวณโบนัส (สมมติ 1% ของยอดคีย์)
        const bonus = Math.round(totalAmount * 0.01);
        
        // เงินเดือนพื้นฐาน (สมมติ)
        const baseSalary = 0; // จะดึงจาก payroll table ถ้ามี
        
        // หักขาดงาน
        const deduction = 0; // จะคำนวณจาก attendance ถ้ามี

        return {
          staff_id: staff.id,
          staff_name: staff.name,
          staff_code: staff.code,
          work_days: 0, // จะดึงจาก attendance
          base_salary: baseSalary,
          bonus: bonus,
          deduction: deduction,
          net_salary: baseSalary + bonus - deduction,
          total_keyed: totalAmount,
          status: 'pending',
        };
      })
    );

    // Summary
    const summary = {
      total_staff: salaries.length,
      total_salary: salaries.reduce((sum, s) => sum + s.net_salary, 0),
      total_bonus: salaries.reduce((sum, s) => sum + s.bonus, 0),
    };

    return NextResponse.json({
      salaries,
      summary,
      period: {
        month,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      },
    });
  } catch (error) {
    console.error('Agent salary error:', error);
    return NextResponse.json({ error: 'Failed to fetch salary data' }, { status: 500 });
  }
}
