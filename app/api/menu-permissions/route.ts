import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDefaultMenusForRole, getDefaultFeaturesForRole, UserRole } from '@/lib/permissions';

// GET - Get menu permissions for a specific user/agent/member/sub_site
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const targetId = searchParams.get('target_id');
    const targetType = searchParams.get('target_type') || 'user';
    const role = searchParams.get('role') as UserRole | null;
    
    if (!targetId) {
      return NextResponse.json({ error: 'target_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('menu_permissions')
      .select('*')
      .eq('target_id', targetId)
      .eq('target_type', targetType)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Menu Permissions] Get error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If no custom permissions found, return defaults based on role
    if (!data && role) {
      const defaultMenus = getDefaultMenusForRole(role);
      const defaultFeatures = getDefaultFeaturesForRole(role);
      
      return NextResponse.json({
        target_id: targetId,
        target_type: targetType,
        visible_menus: defaultMenus,
        hidden_menus: [],
        enabled_features: defaultFeatures,
        disabled_features: [],
        can_create_sub_agent: defaultFeatures.includes('can_create_sub_agent'),
        can_view_reports: defaultFeatures.includes('can_view_reports'),
        can_key_lottery: defaultFeatures.includes('can_key_lottery'),
        can_approve_transactions: defaultFeatures.includes('can_approve_transactions'),
        can_manage_members: defaultFeatures.includes('can_manage_members'),
        can_manage_finances: defaultFeatures.includes('can_manage_finances'),
        is_default: true,
      });
    }

    return NextResponse.json({
      ...data,
      permissions: data?.visible_menus || [], // For member-visibility page compatibility
      visible_menus: data?.visible_menus || [],
      hidden_menus: data?.hidden_menus || [],
      enabled_features: data?.enabled_features || [],
      disabled_features: data?.disabled_features || [],
      canCreateSubAgent: data?.can_create_sub_agent || false,
      canViewReports: data?.can_view_reports ?? true,
      canKeyLottery: data?.can_key_lottery ?? true,
      canApproveTransactions: data?.can_approve_transactions || false,
      can_create_sub_agent: data?.can_create_sub_agent || false,
      can_view_reports: data?.can_view_reports ?? true,
      can_key_lottery: data?.can_key_lottery ?? true,
      can_approve_transactions: data?.can_approve_transactions || false,
      can_manage_members: data?.can_manage_members || false,
      can_manage_finances: data?.can_manage_finances || false,
    });
  } catch (error) {
    console.error('[Menu Permissions] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Save menu permissions
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { 
      target_id, 
      target_type = 'user',
      owner_id = null,
      sub_site_id = null,
      branch_id = null,
      visible_menus = [],
      hidden_menus = [],
      enabled_features = [],
      disabled_features = [],
      can_create_sub_agent = false,
      can_view_reports = true,
      can_key_lottery = true,
      can_approve_transactions = false,
      can_manage_members = false,
      can_manage_finances = false,
    } = body;
    
    if (!target_id) {
      return NextResponse.json({ error: 'target_id is required' }, { status: 400 });
    }

    // Upsert permission record
    const { data, error } = await supabase
      .from('menu_permissions')
      .upsert({
        target_id,
        target_type,
        owner_id,
        sub_site_id,
        branch_id,
        visible_menus,
        hidden_menus,
        enabled_features,
        disabled_features,
        can_create_sub_agent,
        can_view_reports,
        can_key_lottery,
        can_approve_transactions,
        can_manage_members,
        can_manage_finances,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'target_id,target_type',
      })
      .select()
      .single();

    if (error) {
      console.error('[Menu Permissions] Upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also update the agent/customer/user record for backward compatibility
    if (target_type === 'agent') {
      await supabase
        .from('agents')
        .update({
          visible_menus,
          can_create_sub_agent,
          can_view_reports,
        })
        .eq('id', target_id);
    } else if (target_type === 'member') {
      await supabase
        .from('customers')
        .update({
          visible_menus,
          can_key_lottery,
          can_approve_transactions,
        })
        .eq('id', target_id);
    } else if (target_type === 'user') {
      await supabase
        .from('users')
        .update({
          visible_menus,
        })
        .eq('id', target_id);
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Menu Permissions] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Save permissions for single target OR batch update for multiple targets
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    // Check if this is a batch update (targets array) or single target
    if (Array.isArray(body.targets)) {
      // Batch update
      const { targets, visible_menus, target_type = 'agent' } = body;
      
      if (targets.length === 0) {
        return NextResponse.json({ error: 'targets array is required' }, { status: 400 });
      }

      const records = targets.map((target_id: string) => ({
        target_id,
        target_type,
        visible_menus,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('menu_permissions')
        .upsert(records, {
          onConflict: 'target_id,target_type',
        });

      if (error) {
        console.error('[Menu Permissions] Batch upsert error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, count: targets.length });
    } else {
      // Single target update (used by member-visibility page)
      const { 
        target_id, 
        target_type = 'user',
        permissions = [],
        canKeyLottery,
        canApproveTransactions,
        canCreateSubAgent,
        canViewReports,
      } = body;
      
      if (!target_id) {
        return NextResponse.json({ error: 'target_id is required' }, { status: 400 });
      }

      // Upsert permission record
      const { data, error } = await supabase
        .from('menu_permissions')
        .upsert({
          target_id,
          target_type,
          visible_menus: permissions,
          can_key_lottery: canKeyLottery,
          can_approve_transactions: canApproveTransactions,
          can_create_sub_agent: canCreateSubAgent,
          can_view_reports: canViewReports,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'target_id,target_type',
        })
        .select()
        .single();

      if (error) {
        console.error('[Menu Permissions] Single upsert error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Also update the target record for backward compatibility
      if (target_type === 'agent') {
        await supabase
          .from('agents')
          .update({
            visible_menus: permissions,
            can_create_sub_agent: canCreateSubAgent,
            can_view_reports: canViewReports,
          })
          .eq('id', target_id);
      } else if (target_type === 'member') {
        await supabase
          .from('customers')
          .update({
            visible_menus: permissions,
            can_key_lottery: canKeyLottery,
            can_approve_transactions: canApproveTransactions,
          })
          .eq('id', target_id);
      }

      return NextResponse.json({ success: true, data });
    }
  } catch (error) {
    console.error('[Menu Permissions] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
