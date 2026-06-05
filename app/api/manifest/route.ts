import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Dynamic PWA Manifest - reads from tenant_settings for branding
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get tenant from hostname or use default
    const hostname = request.headers.get('host') || '';
    let tenantSlug = 'master';
    
    // Parse tenant from subdomain (e.g., meetang-huayjha.finlotto.com)
    if (hostname.includes('.')) {
      const subdomain = hostname.split('.')[0];
      if (subdomain && subdomain !== 'www' && subdomain !== 'finlotto') {
        tenantSlug = subdomain;
      }
    }
    
    // Fetch tenant info
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name, slug, theme_config')
      .eq('slug', tenantSlug)
      .single();
    
    // If tenant found, fetch tenant_settings for branding
    let settings = null;
    if (tenant?.id) {
      const { data: tenantSettings } = await supabase
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', tenant.id)
        .single();
      settings = tenantSettings;
    }
    
    // Build dynamic manifest
    const brandName = settings?.brand_name || tenant?.name || 'FIN LOTTO R+';
    const shortName = brandName.length > 12 ? brandName.slice(0, 12) : brandName;
    const themeColor = settings?.brand_primary_color || tenant?.theme_config?.primaryColor || '#D4AF37';
    const bgColor = settings?.brand_secondary_color || '#0A0F1C';
    const description = `${brandName} - เว็บหวยออนไลน์ระดับพรีเมี่ยม จ่ายสูง ฝาก-ถอนออโต้ 24 ชม.`;
    
    // Icon URLs - use tenant logo if available, otherwise defaults
    const iconBase = settings?.brand_logo_url || '/icon';
    const hasCustomLogo = settings?.brand_logo_url && settings.brand_logo_url.startsWith('http');
    
    const icons = hasCustomLogo 
      ? [
          {
            src: settings.brand_logo_url,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: settings.brand_logo_url,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      : [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ];

    const manifest = {
      name: `${brandName} - เว็บหวยออนไลน์ระดับพรีเมี่ยม`,
      short_name: shortName,
      description: description,
      start_url: '/c',
      display: 'standalone',
      display_override: ['standalone', 'fullscreen'],
      background_color: bgColor,
      theme_color: themeColor,
      orientation: 'portrait-primary',
      icons: icons,
      categories: ['entertainment', 'games'],
      lang: 'th',
      dir: 'ltr',
      scope: '/',
      prefer_related_applications: false,
      // PWA enhancements for mobile
      edge_side_panel: {
        preferred_width: 400
      },
      // Handle deep links
      handle_links: 'auto',
      // Launch handler for better mobile experience
      launch_handler: {
        client_mode: 'navigate-existing'
      },
      // Shortcuts for quick actions
      shortcuts: [
        {
          name: 'แทงหวย',
          short_name: 'หวย',
          description: 'เข้าสู่หน้าแทงหวย',
          url: '/c/lottery',
          icons: [{ src: '/icon-192.png', sizes: '192x192' }]
        },
        {
          name: 'เติมเงิน',
          short_name: 'เติม',
          description: 'เติมเงินเข้ากระเป๋า',
          url: '/c/deposit',
          icons: [{ src: '/icon-192.png', sizes: '192x192' }]
        },
        {
          name: 'สล็อต',
          short_name: 'สล็อต',
          description: 'เล่นสล็อตออนไลน์',
          url: '/c/slots',
          icons: [{ src: '/icon-192.png', sizes: '192x192' }]
        },
        {
          name: 'คาสิโน',
          short_name: 'คาสิโน',
          description: 'เข้าเล่นคาสิโนสด',
          url: '/c/casino',
          icons: [{ src: '/icon-192.png', sizes: '192x192' }]
        }
      ],
      // Screenshots for install prompt
      screenshots: [
        {
          src: '/screenshots/mobile-home.png',
          sizes: '1080x1920',
          type: 'image/png',
          form_factor: 'narrow',
          label: 'หน้าแรก'
        }
      ],
      // Related applications (optional)
      related_applications: []
    };

    return new NextResponse(JSON.stringify(manifest, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=300, s-maxage=600', // Cache 5 mins
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[v0] Error generating manifest:', error);
    
    // Fallback to default manifest
    const fallbackManifest = {
      name: 'FIN LOTTO R+ - เว็บหวยออนไลน์ระดับพรีเมี่ยม',
      short_name: 'FIN LOTTO R+',
      description: 'FIN LOTTO R+ เว็บหวยออนไลน์ระดับพรีเมี่ยม จ่ายสูงบาทละ 900 มั่นคง ปลอดภัย',
      start_url: '/c',
      display: 'standalone',
      background_color: '#0A0F1C',
      theme_color: '#D4AF37',
      orientation: 'portrait-primary',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ],
      categories: ['entertainment', 'games'],
      lang: 'th',
      dir: 'ltr',
      scope: '/',
      prefer_related_applications: false
    };

    return new NextResponse(JSON.stringify(fallbackManifest, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/manifest+json',
      },
    });
  }
}
