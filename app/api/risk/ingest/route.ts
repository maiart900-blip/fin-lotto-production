import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireSiteApiKey } from '@/lib/site-api-auth';
import { getBusinessDay } from '@/lib/daily-reset';

/**
 * Risk Aggregation Ingest API
 * 
 * TASK 3: REAL-TIME RISK AGGREGATION
 * 
 * Endpoint for child auto sites (sub-webs) to push aggregated risk data to FIN LOTTO.
 * Links all active betting slips from all sub-webs into the central "Risk Control" table.
 * 
 * Data is grouped and calculated strictly by:
 * - Specific Lottery Name (lottery_type)
 * - Current Date (draw_date) using business day logic (01:00 AM reset)
 * 
 * POST /api/risk/ingest
 * Authorization: Bearer flk_[site_id]_[key]
 * 
 * Body:
 * {
 *   lottery_type: "หวยรัฐบาล",
 *   draw_round: "01/02/2567",
 *   draw_date: "2024-02-01",
 *   aggregations: [
 *     {
 *       lottery_number: "123",
 *       bet_type: "3ตัวบน",
 *       total_bet_amount: 10000,
 *       payout_liability: 9000000,
 *       payout_rate: 900,
 *       bet_count: 15,
 *       unique_customers: 8
 *     }
 *   ]
 * }
 */

interface RiskAggregationItem {
  lottery_number: string;
  bet_type: string;
  total_bet_amount: number;
  payout_liability: number;
  payout_rate?: number;
  bet_count?: number;
  unique_customers?: number;
}

interface IngestPayload {
  lottery_type: string;
  lottery_id?: string;
  draw_round?: string;
  draw_date: string;
  aggregations: RiskAggregationItem[];
  period_start?: string;
  period_end?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate via API key
    const authResult = await requireSiteApiKey(request);
    
    if (!authResult.authenticated || !authResult.site) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const site = authResult.site;
    
    // Parse body
    const body: IngestPayload = await request.json();
    
    // Validate required fields
    if (!body.lottery_type || !body.draw_date || !body.aggregations) {
      return NextResponse.json(
        { error: 'Missing required fields: lottery_type, draw_date, aggregations' },
        { status: 400 }
      );
    }
    
    if (!Array.isArray(body.aggregations) || body.aggregations.length === 0) {
      return NextResponse.json(
        { error: 'aggregations must be a non-empty array' },
        { status: 400 }
      );
    }
    
    // Validate date format
    const drawDate = new Date(body.draw_date);
    if (isNaN(drawDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid draw_date format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }
    
    const supabase = await createClient();
    const now = new Date().toISOString();
    
    // Prepare upsert data
    const upsertData = body.aggregations.map((item) => ({
      source_type: 'child_auto',
      source_site_id: site.site_id,
      source_site_name: site.site_name,
      lottery_type: body.lottery_type,
      lottery_id: body.lottery_id || null,
      draw_round: body.draw_round || null,
      draw_date: body.draw_date,
      lottery_number: item.lottery_number,
      bet_type: item.bet_type,
      total_bet_amount: item.total_bet_amount || 0,
      payout_liability: item.payout_liability || 0,
      payout_rate: item.payout_rate || null,
      bet_count: item.bet_count || 0,
      unique_customers: item.unique_customers || 0,
      period_start: body.period_start || null,
      period_end: body.period_end || null,
      aggregated_at: now,
      received_at: now,
    }));
    
    // Upsert (insert or update on conflict)
    const { data, error } = await supabase
      .from('risk_aggregations')
      .upsert(upsertData, {
        onConflict: 'source_type,source_site_id,lottery_type,draw_date,lottery_number,bet_type',
        ignoreDuplicates: false,
      })
      .select('id');
    
    if (error) {
      console.error('Risk ingest error:', error);
      return NextResponse.json(
        { error: 'Failed to store aggregations', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `Received ${body.aggregations.length} aggregation(s)`,
      processed: data?.length || body.aggregations.length,
      site_id: site.site_id,
      received_at: now,
    });
    
  } catch (error) {
    console.error('Risk ingest error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/risk/ingest
 * Returns API documentation for child sites
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/risk/ingest',
    method: 'POST',
    description: 'Push aggregated risk data from child auto sites to FIN LOTTO',
    authentication: {
      type: 'Bearer token',
      header: 'Authorization: Bearer flk_[site_id]_[key]',
    },
    request_body: {
      lottery_type: 'string (required) - e.g., "หวยรัฐบาล"',
      lottery_id: 'string (optional) - UUID reference to lotteries table',
      draw_round: 'string (optional) - e.g., "01/02/2567"',
      draw_date: 'string (required) - YYYY-MM-DD format',
      period_start: 'string (optional) - ISO timestamp',
      period_end: 'string (optional) - ISO timestamp',
      aggregations: [
        {
          lottery_number: 'string (required) - e.g., "123"',
          bet_type: 'string (required) - e.g., "3ตัวบน"',
          total_bet_amount: 'number (required) - total amount bet',
          payout_liability: 'number (required) - total payout if wins',
          payout_rate: 'number (optional) - e.g., 900 for 3ตัวบน',
          bet_count: 'number (optional) - number of bets',
          unique_customers: 'number (optional) - unique customer count',
        },
      ],
    },
    response: {
      success: true,
      message: 'Received N aggregation(s)',
      processed: 'number',
      site_id: 'string',
      received_at: 'ISO timestamp',
    },
    notes: [
      'Data is upserted - sending the same number/bet_type combination will update existing records',
      'API key must be active and not revoked',
      'Rate limit applies per site',
    ],
  });
}
