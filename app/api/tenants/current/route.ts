import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const defaultMasterTenant = {
  id: 'master',
  name: 'FIN LOTTO Master',
  slug: 'master',
  domain: null,
  logo_url: null,
  theme_config: {
    primaryColor: '#D4AF37',
    theme: 'midnight-gold',
  },
  is_master: true,
  is_active: true,
  sync_payout_rates: true,
  sync_blocked_numbers: true,
  sync_lottery_status: true,
};

export async function GET(request: Request) {
  try {
    const hostname = new URL(request.url).hostname;
    
    // Default to master for localhost/development
    if (hostname === 'localhost' || hostname.includes('vercel.app') || hostname.includes('127.0.0.1')) {
      // Try to get master tenant from DB
      const supabase = await createClient();
      const { data: masterTenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('is_master', true)
        .single();
      
      if (masterTenant) {
        return NextResponse.json(masterTenant);
      }
      
      return NextResponse.json(defaultMasterTenant);
    }
    
    // Extract subdomain for multi-tenant
    const parts = hostname.split('.');
    let slug = 'master';
    
    if (parts.length >= 3) {
      slug = parts[0]; // subdomain
    }
    
    const supabase = await createClient();
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();
    
    if (error || !tenant) {
      // Fallback to master tenant
      return NextResponse.json(defaultMasterTenant);
    }
    
    return NextResponse.json(tenant);
  } catch (error) {
    console.error('Get current tenant error:', error);
    return NextResponse.json(defaultMasterTenant);
  }
}
