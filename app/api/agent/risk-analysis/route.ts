import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentOrHigher } from '@/lib/api-auth';

// API สำหรับเอเย่นส่งเลขไปวิเคราะห์ความเสี่ยงที่เว็บกลาง
// ใช้ข้อมูลจากเว็บกลางในการคำนวณความเสี่ยง
// ไม่แก้ไข API analysis เดิม

export async function POST(request: NextRequest) {
  try {
    // Auth guard - require agent or higher
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { agent_id, lottery_id, entries, date } = body;

    if (!agent_id || !lottery_id || !entries || !Array.isArray(entries)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();

    // ดึงข้อมูลเอเย่น
    const { data: agent } = await supabase
      .from('agents')
      .select('id, name, share_percent')
      .eq('id', agent_id)
      .single();

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // ดึง payout rates
    const { data: rates } = await supabase
      .from('payout_rates')
      .select('bet_type, rate')
      .eq('lottery_id', lottery_id);

    const rateMap: Record<string, number> = {};
    (rates || []).forEach(r => {
      rateMap[r.bet_type] = parseFloat(r.rate);
    });

    // ดึง entries ที่มีอยู่ในระบบ (ของทุกเอเย่น) สำหรับวันนี้
    const today = date || new Date().toISOString().split('T')[0];
    const startOfDay = `${today}T00:00:00`;
    const endOfDay = `${today}T23:59:59`;

    const { data: existingEntries } = await supabase
      .from('entries')
      .select('number, bet_type, amount')
      .eq('lottery_id', lottery_id)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    // รวมเลขที่เอเย่นจะแทงกับเลขที่มีอยู่แล้ว
    const numberTotals: Record<string, { 
      total: number; 
      byType: Record<string, number>;
      existingTotal: number;
      newTotal: number;
    }> = {};

    // เพิ่มเลขที่มีอยู่แล้ว
    (existingEntries || []).forEach(e => {
      const key = e.number;
      if (!numberTotals[key]) {
        numberTotals[key] = { total: 0, byType: {}, existingTotal: 0, newTotal: 0 };
      }
      numberTotals[key].total += Number(e.amount) || 0;
      numberTotals[key].existingTotal += Number(e.amount) || 0;
      numberTotals[key].byType[e.bet_type] = (numberTotals[key].byType[e.bet_type] || 0) + (Number(e.amount) || 0);
    });

    // เพิ่มเลขใหม่ที่เอเย่นจะแทง
    entries.forEach((e: any) => {
      const key = e.number;
      if (!numberTotals[key]) {
        numberTotals[key] = { total: 0, byType: {}, existingTotal: 0, newTotal: 0 };
      }
      const amount = Number(e.amount) || 0;
      numberTotals[key].total += amount;
      numberTotals[key].newTotal += amount;
      const betType = e.bet_type || e.betType;
      numberTotals[key].byType[betType] = (numberTotals[key].byType[betType] || 0) + amount;
    });

    // คำนวณความเสี่ยงแต่ละเลข
    const riskAnalysis = Object.entries(numberTotals).map(([number, data]) => {
      // คำนวณ potential payout
      let potentialPayout = 0;
      Object.entries(data.byType).forEach(([betType, amount]) => {
        const rate = rateMap[betType] || 0;
        potentialPayout += amount * rate;
      });

      const profitLoss = data.total - potentialPayout;
      const riskScore = potentialPayout > 0 ? (potentialPayout / data.total) * 100 : 0;

      return {
        number,
        total_amount: data.total,
        existing_amount: data.existingTotal,
        new_amount: data.newTotal,
        potential_payout: potentialPayout,
        profit_loss: profitLoss,
        risk_score: riskScore,
        by_type: data.byType,
        risk_level: riskScore > 80 ? 'high' : riskScore > 50 ? 'medium' : 'low',
      };
    }).sort((a, b) => b.risk_score - a.risk_score);

    // สรุปความเสี่ยงโดยรวม
    const totalNewAmount = entries.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
    const totalPotentialPayout = riskAnalysis.reduce((sum, r) => sum + r.potential_payout, 0);
    const highRiskNumbers = riskAnalysis.filter(r => r.risk_level === 'high');
    const mediumRiskNumbers = riskAnalysis.filter(r => r.risk_level === 'medium');

    const summary = {
      agent: {
        id: agent.id,
        name: agent.name,
        share_percent: agent.share_percent,
      },
      lottery_id,
      date: today,
      total_new_entries: entries.length,
      total_new_amount: totalNewAmount,
      total_potential_payout: totalPotentialPayout,
      overall_risk: totalPotentialPayout > totalNewAmount * 2 ? 'high' : totalPotentialPayout > totalNewAmount ? 'medium' : 'low',
      high_risk_count: highRiskNumbers.length,
      medium_risk_count: mediumRiskNumbers.length,
      warnings: [] as string[],
    };

    // เพิ่ม warnings
    if (highRiskNumbers.length > 0) {
      summary.warnings.push(`มีเลขความเสี่ยงสูง ${highRiskNumbers.length} ตัว: ${highRiskNumbers.slice(0, 5).map(n => n.number).join(', ')}`);
    }

    const topRiskNumber = riskAnalysis[0];
    if (topRiskNumber && topRiskNumber.potential_payout > 10000) {
      summary.warnings.push(`เลข ${topRiskNumber.number} มี potential payout สูงถึง ${topRiskNumber.potential_payout.toLocaleString()} บาท`);
    }

    return NextResponse.json({
      success: true,
      summary,
      risk_analysis: riskAnalysis.slice(0, 50), // ส่งเฉพาะ top 50
      rates: rateMap,
    });
  } catch (error: any) {
    console.error('Risk analysis error:', error);
    return NextResponse.json({ error: 'Failed to analyze risk', detail: error?.message }, { status: 500 });
  }
}

// GET - ดึงข้อมูลวิเคราะห์ความเสี่ยงของเอเย่น
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const lotteryId = searchParams.get('lottery_id');
    const date = searchParams.get('date');

    if (!agentId || !lotteryId) {
      return NextResponse.json({ error: 'agent_id and lottery_id are required' }, { status: 400 });
    }

    const supabase = await createClient();

    // ดึง entries ของเอเย่นวันนี้
    const today = date || new Date().toISOString().split('T')[0];
    const startOfDay = `${today}T00:00:00`;
    const endOfDay = `${today}T23:59:59`;

    const { data: entries } = await supabase
      .from('entries')
      .select('number, bet_type, amount')
      .eq('agent_id', agentId)
      .eq('lottery_id', lotteryId)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    // ดึง payout rates
    const { data: rates } = await supabase
      .from('payout_rates')
      .select('bet_type, rate')
      .eq('lottery_id', lotteryId);

    const rateMap: Record<string, number> = {};
    (rates || []).forEach(r => {
      rateMap[r.bet_type] = parseFloat(r.rate);
    });

    // รวมยอดตามเลข
    const numberTotals: Record<string, { total: number; byType: Record<string, number> }> = {};

    (entries || []).forEach(e => {
      const key = e.number;
      if (!numberTotals[key]) {
        numberTotals[key] = { total: 0, byType: {} };
      }
      numberTotals[key].total += Number(e.amount) || 0;
      numberTotals[key].byType[e.bet_type] = (numberTotals[key].byType[e.bet_type] || 0) + (Number(e.amount) || 0);
    });

    // คำนวณความเสี่ยง
    const riskAnalysis = Object.entries(numberTotals).map(([number, data]) => {
      let potentialPayout = 0;
      Object.entries(data.byType).forEach(([betType, amount]) => {
        const rate = rateMap[betType] || 0;
        potentialPayout += amount * rate;
      });

      const riskScore = potentialPayout > 0 ? (potentialPayout / data.total) * 100 : 0;

      return {
        number,
        total_amount: data.total,
        potential_payout: potentialPayout,
        profit_loss: data.total - potentialPayout,
        risk_score: riskScore,
        risk_level: riskScore > 80 ? 'high' : riskScore > 50 ? 'medium' : 'low',
      };
    }).sort((a, b) => b.risk_score - a.risk_score);

    return NextResponse.json({
      success: true,
      total_entries: entries?.length || 0,
      total_amount: entries?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0,
      risk_analysis: riskAnalysis,
      rates: rateMap,
    });
  } catch (error: any) {
    console.error('Risk analysis GET error:', error);
    return NextResponse.json({ error: 'Failed to get risk analysis', detail: error?.message }, { status: 500 });
  }
}
