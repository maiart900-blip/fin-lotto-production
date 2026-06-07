import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/tenant/[siteId] - Get tenant config by site ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params;
    const supabase = await createClient();
    
    // Fetch site config from database
    const { data: site, error } = await supabase
      .from('sites')
      .select('*')
      .eq('site_id', siteId)
      .eq('is_active', true)
      .single();
    
    if (error || !site) {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      );
    }
    
    // Transform to TenantConfig format
    const tenantConfig = {
      siteId: site.site_id,
      siteName: site.name,
      domain: site.domain,
      logo: site.logo_url || '/images/logo.png',
      favicon: site.favicon_url || '/favicon.ico',
      primaryColor: site.primary_color || '#FFD700',
      secondaryColor: site.secondary_color || '#DAA520',
      accentColor: site.accent_color || '#10B981',
      theme: site.theme || 'midnight-gold',
      fontFamily: site.font_family || 'Prompt',
      features: site.features || {
        autoDeposit: true,
        autoWithdraw: true,
        lineNotify: true,
        liveStream: true,
        referralSystem: true,
      },
      useGlobalRates: site.use_global_rates ?? true,
      useGlobalLimits: site.use_global_limits ?? true,
      useGlobalWallet: site.use_global_wallet ?? false,
      lineId: site.line_id || '',
      phoneNumber: site.phone_number || '',
      welcomeText: site.welcome_text || 'ยินดีต้อนรับ',
      footerText: site.footer_text || '',
      isActive: site.is_active,
      isMaster: false,
    };
    
    return NextResponse.json(tenantConfig);
  } catch (error) {
    console.error('Error fetching tenant config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/tenant/[siteId] - Update tenant config (Master Admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params;
    const body = await request.json();
    const supabase = await createClient();
    
    // TODO: Verify user is Master Admin
    
    const { data, error } = await supabase
      .from('sites')
      .update({
        name: body.siteName,
        domain: body.domain,
        logo_url: body.logo,
        favicon_url: body.favicon,
        primary_color: body.primaryColor,
        secondary_color: body.secondaryColor,
        accent_color: body.accentColor,
        theme: body.theme,
        font_family: body.fontFamily,
        features: body.features,
        use_global_rates: body.useGlobalRates,
        use_global_limits: body.useGlobalLimits,
        use_global_wallet: body.useGlobalWallet,
        line_id: body.lineId,
        phone_number: body.phoneNumber,
        welcome_text: body.welcomeText,
        footer_text: body.footerText,
        updated_at: new Date().toISOString(),
      })
      .eq('site_id', siteId)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to update site config' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating tenant config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
