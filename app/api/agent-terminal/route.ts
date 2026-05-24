import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from '@/lib/audit-system';

/**
 * Agent Terminal API
 * 
 * Real-time connection between Agent betting terminal and Master risk dashboard
 * - Receives bets from Agent sites
 * - Pushes to Master risk dashboard
 * - Validates against liability limits
 * - Auto-blocks if limit exceeded
 */

interface TerminalBet {
  agent_id: string;
  agent_site_name: string;
  lottery_id: string;
  lottery_name: string;
  number: string;
  bet_type: string;
  amount: number;
  customer_id?: string;
  customer_name?: string;
  timestamp: string;
}

// POST - Receive bet from Agent terminal
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const apiKey = request.headers.get('X-API-Key');
    const body: TerminalBet = await request.json();

    // Validate API Key
    const { data: agent } = await supabase
      .from('agents')
      .select('id, name, status, api_key')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single();

    if (!agent) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid or inactive agent' 
      }, { status: 401 });
    }

    // Check liability limits
    const limitCheck = await checkLiabilityLimit(supabase, body.number, body.bet_type, body.amount);
    
    if (!limitCheck.allowed) {
      await createAuditLog({
        action: 'bet_blocked_limit',
        category: 'risk',
        description: `Bet blocked: ${body.number} (${body.bet_type}) - Limit exceeded`,
        metadata: {
          agent_id: agent.id,
          number: body.number,
          amount: body.amount,
          current_volume: limitCheck.currentVolume,
          limit: limitCheck.limit,
        },
      });

      return NextResponse.json({
        success: false,
        error: 'Liability limit exceeded',
        details: {
          number: body.number,
          current_volume: limitCheck.currentVolume,
          limit: limitCheck.limit,
          remaining: Math.max(0, limitCheck.limit - limitCheck.currentVolume),
        },
      }, { status: 400 });
    }

    // Record in network_feed for Master dashboard
    const { data: feed, error: feedError } = await supabase
      .from('network_feed')
      .insert({
        child_site_id: agent.id,
        child_site_name: agent.name,
        lottery_id: body.lottery_id,
        lottery_name: body.lottery_name,
        number: body.number,
        bet_type: body.bet_type,
        amount: body.amount,
        customer_id: body.customer_id,
        customer_name: body.customer_name,
        source: 'agent_terminal',
        created_at: body.timestamp || new Date().toISOString(),
      })
      .select()
      .single();

    if (feedError) throw feedError;

    // Update volume tracking
    await updateVolumeTracking(supabase, body.number, body.bet_type, body.amount);

    // Check if near limit (80%) and send warning
    const warningThreshold = limitCheck.limit * 0.8;
    const newVolume = limitCheck.currentVolume + body.amount;
    
    let warning = null;
    if (newVolume >= warningThreshold && newVolume < limitCheck.limit) {
      warning = {
        type: 'approaching_limit',
        message: `Number ${body.number} is at ${Math.round((newVolume / limitCheck.limit) * 100)}% of limit`,
        current_volume: newVolume,
        limit: limitCheck.limit,
      };
    }

    return NextResponse.json({
      success: true,
      feed_id: feed.id,
      warning,
      volume_status: {
        number: body.number,
        current_volume: newVolume,
        limit: limitCheck.limit,
        remaining: Math.max(0, limitCheck.limit - newVolume),
        percentage: Math.round((newVolume / limitCheck.limit) * 100),
      },
    });

  } catch (error) {
    console.error('Agent terminal error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to process bet' 
    }, { status: 500 });
  }
}

// GET - Get current status and limits for Agent
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const apiKey = request.headers.get('X-API-Key');

    // Validate API Key
    const { data: agent } = await supabase
      .from('agents')
      .select('id, name, status')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single();

    if (!agent) {
      return NextResponse.json({ error: 'Invalid agent' }, { status: 401 });
    }

    // Get liability limits
    const { data: limits } = await supabase
      .from('liability_limits')
      .select('*')
      .eq('is_active', true);

    // Get blocked numbers
    const { data: settings } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'blocked_numbers')
      .single();

    const blockedNumbers = settings?.setting_value?.numbers || [];

    // Get reduced rate numbers
    const { data: rateSettings } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'reduced_rate_numbers')
      .single();

    const reducedRates = rateSettings?.setting_value?.numbers || {};

    // Get current volume for high-risk numbers
    const { data: volumeData } = await supabase
      .from('volume_tracking')
      .select('number, bet_type, total_amount')
      .gte('updated_at', new Date(new Date().setHours(0,0,0,0)).toISOString())
      .order('total_amount', { ascending: false })
      .limit(50);

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        status: agent.status,
      },
      limits: limits || [],
      blocked_numbers: blockedNumbers,
      reduced_rates: reducedRates,
      high_volume_numbers: volumeData || [],
      sync_timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Agent terminal GET error:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}

// Helper: Check liability limit
async function checkLiabilityLimit(
  supabase: any, 
  number: string, 
  betType: string, 
  amount: number
): Promise<{ allowed: boolean; currentVolume: number; limit: number }> {
  
  // Get specific limit for this number or default
  const { data: specificLimit } = await supabase
    .from('liability_limits')
    .select('max_amount')
    .eq('number', number)
    .eq('bet_type', betType)
    .eq('is_active', true)
    .single();

  const { data: defaultLimit } = await supabase
    .from('liability_limits')
    .select('max_amount')
    .eq('number', '*')
    .eq('bet_type', betType)
    .eq('is_active', true)
    .single();

  const { data: globalLimit } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'default_liability_limit')
    .single();

  const limit = specificLimit?.max_amount || 
                defaultLimit?.max_amount || 
                globalLimit?.setting_value?.amount || 
                100000;

  // Get current volume for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: volumeData } = await supabase
    .from('volume_tracking')
    .select('total_amount')
    .eq('number', number)
    .eq('bet_type', betType)
    .gte('updated_at', today.toISOString())
    .single();

  const currentVolume = volumeData?.total_amount || 0;

  return {
    allowed: (currentVolume + amount) <= limit,
    currentVolume,
    limit,
  };
}

// Helper: Update volume tracking
async function updateVolumeTracking(
  supabase: any, 
  number: string, 
  betType: string, 
  amount: number
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Upsert volume tracking
  const { data: existing } = await supabase
    .from('volume_tracking')
    .select('id, total_amount')
    .eq('number', number)
    .eq('bet_type', betType)
    .gte('updated_at', today.toISOString())
    .single();

  if (existing) {
    await supabase
      .from('volume_tracking')
      .update({ 
        total_amount: existing.total_amount + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('volume_tracking')
      .insert({
        number,
        bet_type: betType,
        total_amount: amount,
        entry_count: 1,
        updated_at: new Date().toISOString(),
      });
  }
}
