import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/api-auth';

// GET - ดึงข้อมูล Risk Analysis
export async function GET(request: Request) {
  try {
    // Auth guard - require admin
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entity_type') || 'customer';
    const riskLevel = searchParams.get('risk_level');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get risk scores
    let query = supabase
      .from('risk_scores')
      .select('*')
      .eq('entity_type', entityType)
      .order('score', { ascending: false })
      .limit(limit);

    if (riskLevel) {
      query = query.eq('risk_level', riskLevel);
    }

    const { data: riskScores, error } = await query;

    if (error) throw error;

    // Get risk alerts (unresolved)
    const { data: alerts } = await supabase
      .from('risk_alerts')
      .select('*')
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .limit(20);

    // Calculate summary
    const summary = {
      total: riskScores?.length || 0,
      high: riskScores?.filter(r => r.risk_level === 'high').length || 0,
      medium: riskScores?.filter(r => r.risk_level === 'medium').length || 0,
      low: riskScores?.filter(r => r.risk_level === 'low').length || 0,
      critical: riskScores?.filter(r => r.risk_level === 'critical').length || 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        riskScores,
        alerts,
        summary,
      },
    });
  } catch (error) {
    console.error('Error fetching risk analysis:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch risk analysis' },
      { status: 500 }
    );
  }
}

// POST - Calculate risk score for entity
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { entity_type, entity_id } = body;

    if (!entity_type || !entity_id) {
      return NextResponse.json(
        { success: false, error: 'entity_type and entity_id required' },
        { status: 400 }
      );
    }

    let score = 0;
    const factors: Record<string, number> = {};

    if (entity_type === 'customer') {
      // Get customer data
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', entity_id)
        .single();

      if (customer) {
        // Factor 1: Large withdrawals vs deposits
        const withdrawRatio = customer.total_withdraw_amount / (customer.total_deposit_amount || 1);
        if (withdrawRatio > 2) {
          factors.high_withdraw_ratio = 30;
          score += 30;
        } else if (withdrawRatio > 1.5) {
          factors.medium_withdraw_ratio = 15;
          score += 15;
        }

        // Factor 2: Win rate too high
        const winRatio = customer.total_win_amount / (customer.total_bet_amount || 1);
        if (winRatio > 0.5) {
          factors.high_win_ratio = 25;
          score += 25;
        } else if (winRatio > 0.3) {
          factors.medium_win_ratio = 10;
          score += 10;
        }

        // Factor 3: Recent large bets
        const { data: recentBets } = await supabase
          .from('entries')
          .select('amount')
          .eq('customer_id', entity_id)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('amount', { ascending: false })
          .limit(10);

        const maxBet = recentBets?.[0]?.amount || 0;
        if (maxBet > 10000) {
          factors.large_bets = 20;
          score += 20;
        }

        // Factor 4: Multiple accounts (same phone/bank)
        if (customer.phone) {
          const { count } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('phone', customer.phone);

          if ((count || 0) > 1) {
            factors.duplicate_phone = 15;
            score += 15;
          }
        }
      }
    }

    // Determine risk level
    let riskLevel = 'low';
    if (score >= 70) riskLevel = 'critical';
    else if (score >= 50) riskLevel = 'high';
    else if (score >= 25) riskLevel = 'medium';

    // Upsert risk score
    const { data: riskScore, error } = await supabase
      .from('risk_scores')
      .upsert({
        entity_type,
        entity_id,
        score,
        risk_level: riskLevel,
        factors,
        calculated_at: new Date().toISOString(),
      }, {
        onConflict: 'entity_type,entity_id',
      })
      .select()
      .single();

    if (error) throw error;

    // Create alert if high risk
    if (score >= 50) {
      await supabase.from('risk_alerts').insert({
        alert_type: 'high_risk_score',
        severity: score >= 70 ? 'critical' : 'high',
        entity_type,
        entity_id,
        title: `พบความเสี่ยงสูง: ${entity_type} ${entity_id.slice(0, 8)}`,
        message: `คะแนนความเสี่ยง ${score} คะแนน`,
        data: { score, factors, risk_level: riskLevel },
      });
    }

    return NextResponse.json({
      success: true,
      data: riskScore,
    });
  } catch (error) {
    console.error('Error calculating risk score:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate risk score' },
      { status: 500 }
    );
  }
}
