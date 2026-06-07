import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireSuperAdmin } from '@/lib/api-auth';

/**
 * Tier Permissions API
 * 
 * Manages permissions for entire tiers (not individual users):
 * - internal: พนักงาน/แอดมิน
 * - master: Master Agent (Level 1)
 * - agent: Agent (Level 2)
 * - sub_agent: Sub-Agent (Level 3)
 * 
 * Each menu can have 4 granular permissions:
 * - can_view
 * - can_create
 * - can_edit
 * - can_delete
 */

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    
    const supabase = await createClient();
    
    // Fetch tier permissions from database
    const { data: permissions, error } = await supabase
      .from('tier_permissions')
      .select('*')
      .order('tier', { ascending: true });
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching tier permissions:', error);
      // Return empty array if table doesn't exist yet
      return NextResponse.json({ permissions: [] });
    }
    
    return NextResponse.json({ 
      permissions: permissions || [],
      tiers: ['internal', 'master', 'agent', 'sub_agent'],
    });
    
  } catch (error) {
    console.error('Tier permissions GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Only super admin can modify tier permissions
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;
    
    const supabase = await createClient();
    
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    const { permissions } = body;
    
    console.log('Received permissions:', JSON.stringify(permissions, null, 2));
    
    if (!permissions || !Array.isArray(permissions)) {
      return NextResponse.json(
        { error: 'permissions array is required' },
        { status: 400 }
      );
    }
    
    // Validate each permission
    const validTiers = ['internal', 'master', 'agent', 'sub_agent'];
    for (const perm of permissions) {
      if (!validTiers.includes(perm.tier)) {
        return NextResponse.json(
          { error: `Invalid tier: ${perm.tier}` },
          { status: 400 }
        );
      }
      if (!perm.menu_id) {
        return NextResponse.json(
          { error: 'menu_id is required for each permission' },
          { status: 400 }
        );
      }
    }
    
    // Build clean records for upsert - only include valid columns
    const cleanPermissions = permissions.map((p: {
      tier: string;
      menu_id: string;
      can_view?: boolean;
      can_create?: boolean;
      can_edit?: boolean;
      can_delete?: boolean;
    }) => ({
      tier: String(p.tier),
      menu_id: String(p.menu_id),
      can_view: Boolean(p.can_view),
      can_create: Boolean(p.can_create),
      can_edit: Boolean(p.can_edit),
      can_delete: Boolean(p.can_delete),
    }));
    
    console.log('Clean permissions to upsert:', JSON.stringify(cleanPermissions.slice(0, 3), null, 2));
    
    // Upsert permissions one by one to avoid batch issues
    const errors: string[] = [];
    let successCount = 0;
    
    for (const perm of cleanPermissions) {
      const { error } = await supabase
        .from('tier_permissions')
        .upsert(perm, { 
          onConflict: 'tier,menu_id',
        });
      
      if (error) {
        console.error('Error upserting permission:', perm, error);
        errors.push(`${perm.tier}/${perm.menu_id}: ${error.message}`);
      } else {
        successCount++;
      }
    }
    
    if (errors.length > 0) {
      console.error('Some permissions failed to save:', errors);
      if (successCount === 0) {
        return NextResponse.json(
          { error: `Failed to save permissions: ${errors[0]}` },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Tier permissions saved successfully',
      count: successCount,
      errors: errors.length > 0 ? errors : undefined,
    });
    
  } catch (error) {
    console.error('Tier permissions PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
