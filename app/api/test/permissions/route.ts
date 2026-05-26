import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Admin-only API to verify permission system
// Requires admin authentication
async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  
  const { data: adminUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();
  
  return adminUser?.role === 'owner' || adminUser?.role === 'admin';
}

// GET /api/test/permissions?user_id=xxx
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verify admin access
    if (!await verifyAdmin(supabase)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    
    const userId = searchParams.get('user_id');
    const username = searchParams.get('username');
    
    if (!userId && !username) {
      return NextResponse.json({ error: 'user_id or username is required' }, { status: 400 });
    }
    
    // 1. Get user from users table
    let user = null;
    if (userId) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      user = data;
    } else if (username) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();
      user = data;
    }
    
    if (!user) {
      // Try customers table
      if (userId) {
        const { data } = await supabase
          .from('customers')
          .select('*')
          .eq('id', userId)
          .single();
        user = data;
      } else if (username) {
        const { data } = await supabase
          .from('customers')
          .select('*')
          .or(`username.eq.${username},phone.eq.${username}`)
          .single();
        user = data;
      }
      
      if (user) {
        user.source = 'customers';
      }
    } else {
      user.source = 'users';
    }
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // 2. Get menu_permissions
    const targetType = user.source === 'users' ? 'user' : (user.agent_level === 'agent' ? 'agent' : 'member');
    const { data: permissions } = await supabase
      .from('menu_permissions')
      .select('*')
      .eq('target_id', user.id)
      .eq('target_type', targetType)
      .single();
    
    // 3. Get branch info
    let branch = null;
    if (user.branch_id) {
      const { data } = await supabase
        .from('branches')
        .select('*')
        .eq('id', user.branch_id)
        .single();
      branch = data;
    }
    
    // 4. Get parent agent info (for agents)
    let parentAgent = null;
    if (user.parent_agent_id || user.upline_id) {
      const { data } = await supabase
        .from('customers')
        .select('id, name, phone, agent_level, level')
        .eq('id', user.parent_agent_id || user.upline_id)
        .single();
      parentAgent = data;
    }
    
    // 5. Calculate effective permissions
    const effectiveMenus = permissions?.visible_menus || user.visible_menus || [];
    const hiddenMenus = permissions?.hidden_menus || [];
    
    return NextResponse.json({
      test_result: 'SUCCESS',
      user: {
        id: user.id,
        username: user.username || user.phone,
        display_name: user.display_name || user.name,
        role: user.role || user.agent_level || 'customer',
        source: user.source,
        is_active: user.is_active,
      },
      branch: branch ? {
        id: branch.id,
        code: branch.code,
        name: branch.name,
        branch_type: branch.branch_type,
        is_master: branch.is_master,
      } : null,
      parent_agent: parentAgent,
      stored_permissions: {
        in_menu_permissions_table: !!permissions,
        in_user_record: !!user.visible_menus?.length,
        visible_menus_from_db: permissions?.visible_menus || [],
        visible_menus_from_user: user.visible_menus || [],
        hidden_menus: permissions?.hidden_menus || [],
        can_create_sub_agent: permissions?.can_create_sub_agent || user.can_create_sub_agent || false,
        can_view_reports: permissions?.can_view_reports ?? user.can_view_reports ?? true,
        can_key_lottery: permissions?.can_key_lottery ?? user.can_key_lottery ?? true,
        can_approve_transactions: permissions?.can_approve_transactions || false,
      },
      effective_permissions: {
        visible_menus: effectiveMenus,
        hidden_menus: hiddenMenus,
        menu_count: effectiveMenus.length,
        has_restrictions: effectiveMenus.length > 0,
      },
      hierarchy: {
        level: user.level || 1,
        parent_agent_id: user.parent_agent_id || user.upline_id || null,
        owner_id: user.owner_id || null,
      }
    });
  } catch (error) {
    console.error('Test permissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Set test permissions for a user (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verify admin access
    if (!await verifyAdmin(supabase)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const body = await request.json();
    
    const {
      target_id,
      target_type = 'user',
      visible_menus = [],
      hidden_menus = [],
      can_create_sub_agent = false,
      can_view_reports = true,
      can_key_lottery = true,
      can_approve_transactions = false,
    } = body;
    
    if (!target_id) {
      return NextResponse.json({ error: 'target_id is required' }, { status: 400 });
    }
    
    // Upsert permissions
    const { data, error } = await supabase
      .from('menu_permissions')
      .upsert({
        target_id,
        target_type,
        visible_menus,
        hidden_menus,
        can_create_sub_agent,
        can_view_reports,
        can_key_lottery,
        can_approve_transactions,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'target_id,target_type',
      })
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Permissions set successfully',
      data,
    });
  } catch (error) {
    console.error('Set test permissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
