import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from '@/lib/audit-system';

/**
 * Liability Limits API
 * 
 * Master can set max bet limits per number
 * Syncs to all Agents instantly via network broadcast
 */

// GET - Get all liability limits
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const betType = searchParams.get('bet_type');
    const activeOnly = searchParams.get('active') !== 'false';

    let query = supabase
      .from('liability_limits')
      .select('*')
      .order('number', { ascending: true });

    if (betType) {
      query = query.eq('bet_type', betType);
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Get global default limit
    const { data: globalSetting } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'default_liability_limit')
      .single();

    const globalLimit = globalSetting?.setting_value?.amount || 100000;

    return NextResponse.json({
      limits: data || [],
      global_default: globalLimit,
    });

  } catch (error) {
    console.error('Error fetching liability limits:', error);
    return NextResponse.json({ error: 'Failed to fetch limits' }, { status: 500 });
  }
}

// POST - Create or update liability limit
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { 
      number, 
      bet_type, 
      max_amount, 
      is_active = true,
      broadcast_to_network = true,
      performed_by,
    } = body;

    // Validate required fields
    if (!number || !bet_type || max_amount === undefined) {
      return NextResponse.json({ 
        error: 'Missing required fields: number, bet_type, max_amount' 
      }, { status: 400 });
    }

    // Upsert limit
    const { data, error } = await supabase
      .from('liability_limits')
      .upsert({
        number,
        bet_type,
        max_amount,
        is_active,
        updated_at: new Date().toISOString(),
        updated_by: performed_by,
      }, {
        onConflict: 'number,bet_type',
      })
      .select()
      .single();

    if (error) throw error;

    // Audit log
    await createAuditLog({
      action: 'liability_limit_set',
      category: 'risk',
      description: `Set liability limit: ${number} (${bet_type}) = ${max_amount.toLocaleString()}`,
      metadata: { number, bet_type, max_amount, is_active },
      user_id: performed_by,
    });

    // Broadcast to network if requested
    let syncResult = { synced: 0, total: 0 };
    if (broadcast_to_network) {
      syncResult = await broadcastLimitToNetwork(supabase, {
        type: 'liability_limit',
        action: 'set',
        data: { number, bet_type, max_amount, is_active },
      });
    }

    return NextResponse.json({
      success: true,
      limit: data,
      synced_sites: syncResult.synced,
      total_sites: syncResult.total,
    });

  } catch (error) {
    console.error('Error setting liability limit:', error);
    return NextResponse.json({ error: 'Failed to set limit' }, { status: 500 });
  }
}

// DELETE - Remove liability limit
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const number = searchParams.get('number');
    const betType = searchParams.get('bet_type');
    const broadcastToNetwork = searchParams.get('broadcast') !== 'false';

    if (!id && (!number || !betType)) {
      return NextResponse.json({ 
        error: 'Provide id or number+bet_type' 
      }, { status: 400 });
    }

    let query = supabase.from('liability_limits').delete();
    
    if (id) {
      query = query.eq('id', id);
    } else {
      query = query.eq('number', number).eq('bet_type', betType);
    }

    const { error } = await query;
    if (error) throw error;

    // Audit log
    await createAuditLog({
      action: 'liability_limit_removed',
      category: 'risk',
      description: `Removed liability limit: ${number || id} (${betType || 'N/A'})`,
      metadata: { id, number, bet_type: betType },
    });

    // Broadcast to network
    let syncResult = { synced: 0, total: 0 };
    if (broadcastToNetwork && number && betType) {
      syncResult = await broadcastLimitToNetwork(supabase, {
        type: 'liability_limit',
        action: 'remove',
        data: { number, bet_type: betType },
      });
    }

    return NextResponse.json({
      success: true,
      synced_sites: syncResult.synced,
    });

  } catch (error) {
    console.error('Error removing liability limit:', error);
    return NextResponse.json({ error: 'Failed to remove limit' }, { status: 500 });
  }
}

// PATCH - Update global default limit
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { global_default, broadcast_to_network = true, performed_by } = body;

    if (global_default === undefined) {
      return NextResponse.json({ error: 'Missing global_default' }, { status: 400 });
    }

    // Update system setting
    await supabase
      .from('system_settings')
      .upsert({
        setting_key: 'default_liability_limit',
        setting_value: { amount: global_default },
        updated_at: new Date().toISOString(),
      });

    // Audit log
    await createAuditLog({
      action: 'global_limit_updated',
      category: 'risk',
      description: `Updated global liability limit to ${global_default.toLocaleString()}`,
      metadata: { global_default },
      user_id: performed_by,
    });

    // Broadcast to network
    let syncResult = { synced: 0, total: 0 };
    if (broadcast_to_network) {
      syncResult = await broadcastLimitToNetwork(supabase, {
        type: 'global_limit',
        action: 'update',
        data: { amount: global_default },
      });
    }

    return NextResponse.json({
      success: true,
      global_default,
      synced_sites: syncResult.synced,
    });

  } catch (error) {
    console.error('Error updating global limit:', error);
    return NextResponse.json({ error: 'Failed to update global limit' }, { status: 500 });
  }
}

// Helper: Broadcast limit changes to all agent sites
async function broadcastLimitToNetwork(
  supabase: any,
  payload: { type: string; action: string; data: any }
): Promise<{ synced: number; total: number }> {
  try {
    // Get active agent sites
    const { data: agents } = await supabase
      .from('agents')
      .select('id, name, api_url, api_key')
      .eq('status', 'active')
      .not('api_url', 'is', null);

    if (!agents?.length) return { synced: 0, total: 0 };

    // Push to all agents in parallel
    const results = await Promise.allSettled(
      agents.map(async (agent: any) => {
        try {
          const response = await fetch(`${agent.api_url}/api/sync/receive`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Master-Key': process.env.MASTER_SYNC_KEY || '',
            },
            body: JSON.stringify({
              ...payload,
              timestamp: new Date().toISOString(),
              source: 'master',
            }),
            signal: AbortSignal.timeout(5000),
          });
          return response.ok;
        } catch {
          return false;
        }
      })
    );

    const synced = results.filter(r => r.status === 'fulfilled' && r.value).length;
    
    // Log sync result
    await supabase
      .from('network_sync_logs')
      .insert({
        sync_type: payload.type,
        action: payload.action,
        payload,
        synced_count: synced,
        total_count: agents.length,
        created_at: new Date().toISOString(),
      });

    return { synced, total: agents.length };
  } catch (error) {
    console.error('Broadcast error:', error);
    return { synced: 0, total: 0 };
  }
}
