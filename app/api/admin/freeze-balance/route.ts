import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createMultiWalletService } from '@/lib/multi-wallet';
import { logAuditAction } from '@/lib/audit-logger';

// GET - Get freeze requests
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const siteId = searchParams.get('siteId') || 'default';
    const status = searchParams.get('status') || 'active';

    // Check admin permission
    const { data: adminUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = ['super_admin', 'owner', 'admin', 'manager'].includes(adminUser?.role || '');
    
    let query = supabase
      .from('freeze_requests')
      .select(`
        *,
        user:users!freeze_requests_user_id_fkey(username, phone)
      `)
      .order('frozen_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (!isAdmin) {
      query = query.eq('user_id', user.id);
    }

    if (siteId && siteId !== 'all') {
      query = query.eq('site_id', siteId);
    }

    const { data, error } = await query.limit(100);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('Get freeze requests error:', error);
    return NextResponse.json(
      { error: 'Failed to get freeze requests' },
      { status: 500 }
    );
  }
}

// POST - Freeze or release balance
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin permission
    const { data: adminUser } = await supabase
      .from('users')
      .select('id, username, role')
      .eq('id', user.id)
      .single();

    if (!['super_admin', 'owner', 'admin', 'manager'].includes(adminUser?.role || '')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await req.json();
    const { action, userId, siteId, amount, reason, freezeId, releaseReason, autoReleaseHours } = body;

    const walletService = await createMultiWalletService();
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    if (action === 'freeze') {
      // Freeze balance
      if (!userId || !reason) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const freezeRequest = await walletService.freezeBalance({
        userId,
        siteId: siteId || 'default',
        amount: amount ? Number(amount) : undefined,
        reason,
        frozenBy: user.id,
        frozenByName: adminUser?.username,
        frozenByRole: adminUser?.role,
        autoReleaseHours: autoReleaseHours ? Number(autoReleaseHours) : undefined,
        ipAddress,
      });

      // Audit log
      await logAuditAction({
        action: 'freeze_balance',
        targetType: 'user',
        targetId: userId,
        details: {
          amount: amount || 'all',
          reason,
          freezeId: freezeRequest.id,
          autoReleaseHours,
        },
        performedBy: user.id,
        ipAddress,
      });

      return NextResponse.json({
        success: true,
        message: 'Balance frozen successfully',
        data: freezeRequest,
      });

    } else if (action === 'release') {
      // Release frozen balance
      if (!freezeId || !releaseReason) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const success = await walletService.releaseFrozenBalance({
        freezeId,
        releasedBy: user.id,
        releasedByName: adminUser?.username,
        releaseReason,
        ipAddress,
      });

      if (!success) {
        return NextResponse.json({ error: 'Failed to release balance' }, { status: 400 });
      }

      // Audit log
      await logAuditAction({
        action: 'release_frozen_balance',
        targetType: 'freeze_request',
        targetId: freezeId,
        details: {
          releaseReason,
        },
        performedBy: user.id,
        ipAddress,
      });

      return NextResponse.json({
        success: true,
        message: 'Balance released successfully',
      });

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Freeze balance error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    );
  }
}
