import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Tenants API - SUPER ADMIN ONLY
 * Manages multi-tenant sites (Sub-Sites)
 * 
 * TASK 1: SUB-WEB CREATION API
 * - Securely generates new tenant accounts (Username/Password)
 * - Maps custom domains to multi-tenant architecture
 * - Auto-creates tenant admin user with secure credentials
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

// POST - Create new tenant (Sub-Site) with secure credentials and domain mapping
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
      custom_domains = [], // Array of custom domains for this tenant
      owner_id,
      sync_payout_rates = true,
      sync_blocked_numbers = true,
      sync_lottery_status = true,
      // Admin credentials (optional - auto-generate if not provided)
      admin_username,
      admin_password,
    } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อและ slug' },
        { status: 400 }
      );
    }

    // Validate slug format (alphanumeric, lowercase, hyphens only)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'Slug ต้องเป็นตัวอักษรภาษาอังกฤษพิมพ์เล็ก ตัวเลข และ - เท่านั้น' },
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

    // Check if domain exists (if provided)
    if (domain) {
      const { data: existingDomain } = await supabase
        .from('tenants')
        .select('id')
        .eq('domain', domain)
        .single();

      if (existingDomain) {
        return NextResponse.json(
          { error: 'โดเมนนี้ถูกใช้งานแล้ว' },
          { status: 400 }
        );
      }
    }

    // Generate secure API key for this tenant (for child site integration)
    const apiKeyRaw = `flk_${slug}_${crypto.randomBytes(24).toString('hex')}`;
    const apiKeyHash = await bcrypt.hash(apiKeyRaw, 10);
    const apiKeyPrefix = apiKeyRaw.slice(0, 16);

    // Create tenant with domain mapping
    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({
        name,
        slug,
        domain: domain || `${slug}.finlotto.com`, // Default subdomain
        owner_id,
        is_master: false,
        is_active: true,
        sync_payout_rates,
        sync_blocked_numbers,
        sync_lottery_status,
        theme_config: { primaryColor: '#D4AF37', theme: 'midnight-gold' },
        // Store custom domains as JSON array
        custom_domains: custom_domains.length > 0 ? custom_domains : null,
      })
      .select()
      .single();

    if (error) throw error;

    // Create site API key for this tenant (for risk aggregation integration)
    await supabase
      .from('site_api_keys')
      .insert({
        site_id: tenant.id,
        site_name: name,
        site_type: 'child_auto',
        api_key_hash: apiKeyHash,
        api_key_prefix: apiKeyPrefix,
        is_active: true,
        rate_limit_per_minute: 60,
      });

    // Create initial stats record
    await supabase
      .from('tenant_stats')
      .insert({
        tenant_id: tenant.id,
        stat_date: new Date().toISOString().split('T')[0]
      });

    // Generate secure admin credentials
    const finalUsername = admin_username || `admin_${slug}`;
    const finalPassword = admin_password || generateSecurePassword(slug);
    const hashedPassword = await bcrypt.hash(finalPassword, 12);
    
    // Create tenant admin user with secure credentials
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .insert({
        username: finalUsername,
        password_hash: hashedPassword,
        role: 'admin',
        tenant_id: tenant.id,
        is_active: true,
        display_name: `Admin ${name}`,
        // Force password change on first login
        must_change_password: true,
      })
      .select('id, username')
      .single();

    if (adminError) {
      console.error('Failed to create tenant admin:', adminError);
    }

    // Also insert into admin_users table for backward compatibility
    if (adminUser) {
      await supabase
        .from('admin_users')
        .insert({
          id: adminUser.id,
          username: finalUsername,
          password_hash: hashedPassword,
          role: 'admin',
          tenant_id: tenant.id,
          is_active: true,
          display_name: `Admin ${name}`,
        });
    }

    return NextResponse.json({
      success: true,
      tenant: {
        ...tenant,
        domain_mapping: {
          primary: tenant.domain,
          custom: custom_domains,
          subdomain: `${slug}.finlotto.com`,
        },
      },
      admin: adminUser ? {
        username: adminUser.username,
        password: finalPassword, // One-time display only - NOT stored in logs
        must_change_password: true,
        message: 'กรุณาเปลี่ยนรหัสผ่านทันทีหลังเข้าสู่ระบบครั้งแรก'
      } : null,
      api_key: {
        key: apiKeyRaw, // One-time display only
        prefix: apiKeyPrefix,
        message: 'เก็บ API Key นี้ไว้ให้ดี - จะไม่แสดงอีก'
      },
    });
  } catch (err) {
    console.error('Create tenant error:', err);
    return NextResponse.json({ error: 'ไม่สามารถสร้างเว็บลูกได้' }, { status: 500 });
  }
}

/**
 * Generate secure password for tenant admin
 * Format: [slug]_[random]_[timestamp]
 */
function generateSecurePassword(slug: string): string {
  const random = crypto.randomBytes(8).toString('hex');
  const timestamp = Date.now().toString(36);
  return `${slug.slice(0, 4)}${random}${timestamp}`;
}
