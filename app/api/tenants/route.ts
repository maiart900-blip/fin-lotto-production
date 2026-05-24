import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';

/**
 * Tenants API - SUPER ADMIN ONLY
 * Manages multi-tenant sites (Sub-Sites)
 */

// GET - List all tenants with stats (supports pagination for 100,000+ tenants)
export async function GET(request: NextRequest) {
  try {
    // Auth guard - require super admin for tenant management
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    // Pagination params
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Max 100 per page
    const offset = (page - 1) * limit;
    
    // Filter params
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status'); // 'active', 'inactive', 'all'
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? true : false;
    
    // Build query
    let query = supabase
      .from('tenants')
      .select(`
        *,
        tenant_stats!left (
          total_bets,
          total_payouts,
          total_deposits,
          total_withdrawals,
          profit_loss,
          active_users,
          new_users,
          stat_date
        )
      `, { count: 'exact' });
    
    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,domain.ilike.%${search}%`);
    }
    
    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }
    
    // Apply sorting and pagination
    query = query
      .order('is_master', { ascending: false })
      .order(sortBy, { ascending: sortOrder })
      .range(offset, offset + limit - 1);
    
    const { data: tenants, error, count } = await query;
    
    if (error) throw error;

    // Get user counts per tenant (only for current page)
    const tenantIds = tenants?.map(t => t.id) || [];
    let tenantUserCounts: Record<string, number> = {};
    
    if (tenantIds.length > 0) {
      const { data: userCounts } = await supabase
        .from('users')
        .select('tenant_id')
        .in('tenant_id', tenantIds);

      userCounts?.forEach(u => {
        if (u.tenant_id) {
          tenantUserCounts[u.tenant_id] = (tenantUserCounts[u.tenant_id] || 0) + 1;
        }
      });
    }

    // Merge user counts with tenants
    const tenantsWithCounts = tenants?.map(t => ({
      ...t,
      user_count: tenantUserCounts[t.id] || 0,
      stats: t.tenant_stats?.[0] || null
    }));

    // Calculate pagination meta
    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      data: tenantsWithCounts || [],
      meta: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      }
    });
  } catch (err) {
    console.error('Tenants API error:', err);
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลเว็บลูกได้' }, { status: 500 });
  }
}

// POST - Create new tenant (Sub-Site)
export async function POST(request: Request) {
  try {
    // Auth guard - require super admin for creating tenants
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { 
      name, 
      slug, 
      domain, 
      owner_id,
      sync_payout_rates = true,
      sync_blocked_numbers = true,
      sync_lottery_status = true,
      auto_system_enabled = true,
      manual_key_enabled = false,
      deposit_fee_percent = 1.5,
      withdraw_fee_percent = 1.0,
    } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อและ slug' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if slug exists
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Slug นี้ถูกใช้งานแล้ว' },
        { status: 400 }
      );
    }

    // Create tenant
    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({
        name,
        slug,
        domain,
        owner_id,
        is_master: false,
        is_active: true,
        sync_payout_rates,
        sync_blocked_numbers,
        sync_lottery_status,
        auto_system_enabled,
        manual_key_enabled,
        deposit_fee_percent,
        withdraw_fee_percent,
        security_settings: {
          require_2fa_admin: true,
          require_2fa_agent: false,
          require_2fa_member: false,
          max_login_attempts: 5,
          session_timeout_minutes: 60,
          ip_whitelist_enabled: false,
          ip_whitelist: [],
        },
        theme_config: { primaryColor: '#D4AF37', theme: 'midnight-gold' }
      })
      .select()
      .single();

    if (error) throw error;

    // Create initial stats record
    await supabase
      .from('tenant_stats')
      .insert({
        tenant_id: tenant.id,
        stat_date: new Date().toISOString().split('T')[0]
      });

    return NextResponse.json(tenant);
  } catch (err) {
    console.error('Create tenant error:', err);
    return NextResponse.json({ error: 'ไม่สามารถสร้างเว็บลูกได้' }, { status: 500 });
  }
}
