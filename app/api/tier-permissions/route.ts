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
    const body = await request.json();
    const { permissions } = body;
    
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
    
    // Upsert permissions
    const { error } = await supabase
      .from('tier_permissions')
      .upsert(
        permissions.map((p: {
          tier: string;
          menu_id: string;
          can_view: boolean;
          can_create: boolean;
          can_edit: boolean;
          can_delete: boolean;
        }) => ({
          tier: p.tier,
          menu_id: p.menu_id,
          can_view: p.can_view || false,
          can_create: p.can_create || false,
          can_edit: p.can_edit || false,
          can_delete: p.can_delete || false,
          updated_at: new Date().toISOString(),
        })),
        { 
          onConflict: 'tier,menu_id',
          ignoreDuplicates: false,
        }
      );
    
    if (error) {
      console.error('Error saving tier permissions:', error);
      
      // If table doesn't exist, create it
      if (error.code === '42P01') {
        return NextResponse.json(
          { error: 'tier_permissions table not found. Please run migrations.' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Tier permissions saved successfully',
      count: permissions.length,
    });
    
  } catch (error) {
    console.error('Tier permissions PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
