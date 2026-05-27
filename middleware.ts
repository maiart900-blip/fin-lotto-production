import { updateSession } from '@/lib/supabase/middleware';
import { type NextRequest, NextResponse } from 'next/server';

// Domain to tenant slug mapping
// Add child site domains here as they are configured
const DOMAIN_TENANT_MAP: Record<string, string> = {
  'meetang.finlotto.com': 'meetang-huayja',
  // Add more child sites here: 'domain.com': 'tenant-slug'
};

// Main/master domains that should NOT redirect
const MASTER_DOMAINS = [
  'finlotto.com',
  'www.finlotto.com',
  'localhost',
  'localhost:3000',
  '127.0.0.1',
  '127.0.0.1:3000',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || '';
  
  // Strip port for matching
  const hostWithoutPort = host.split(':')[0];
  
  // Check if this is a child site domain
  const tenantSlug = DOMAIN_TENANT_MAP[host] || DOMAIN_TENANT_MAP[hostWithoutPort];
  
  if (tenantSlug) {
    // This is a child site domain - rewrite to tenant route
    // Only rewrite if not already on a tenant route
    if (!pathname.startsWith('/t/')) {
      const url = request.nextUrl.clone();
      url.pathname = `/t/${tenantSlug}${pathname}`;
      
      // Use rewrite (not redirect) to keep the URL clean
      return NextResponse.rewrite(url);
    }
  }
  
  // Check if someone is trying to access another tenant's route via child domain
  // e.g., meetang.finlotto.com/t/master should be blocked
  if (tenantSlug && pathname.startsWith('/t/') && !pathname.startsWith(`/t/${tenantSlug}`)) {
    // Redirect to the correct tenant route for this domain
    const url = request.nextUrl.clone();
    const pathAfterTenant = pathname.replace(/^\/t\/[^/]+/, '');
    url.pathname = `/t/${tenantSlug}${pathAfterTenant}`;
    return NextResponse.redirect(url);
  }
  
  // Continue with session handling for all requests
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
