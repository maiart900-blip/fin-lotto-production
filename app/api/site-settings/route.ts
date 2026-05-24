import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Convert private Vercel Blob URLs to proxied URLs
function convertBlobUrl(url: string | null | undefined, baseUrl: string): string | null {
  if (!url) return null;
  // If it's a private Vercel Blob URL, convert to proxy endpoint
  if (url.includes('.private.blob.vercel-storage.com')) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.slice(1); // Remove leading slash
      return `${baseUrl}/api/image?pathname=${encodeURIComponent(pathname)}`;
    } catch {
      return url;
    }
  }
  return url;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const baseUrl = new URL(request.url).origin;
    
    // Get site settings (should be only one row)
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    // Return default if no settings found
    if (!data) {
      return NextResponse.json({
        site_name: 'Lotto Agent',
        primary_color: '#dc2626',
        secondary_color: '#facc15',
        background_color: '#0a0a0a',
        button_color: '#dc2626',
        text_color: '#ffffff',
        sidebar_color: '#171717',
        header_color: '#171717',
        card_color: '#262626',
        badge_color: '#facc15',
        hover_color: '#dc2626',
      });
    }
    
    // Convert all image URLs to proxied URLs
    const processedData = {
      ...data,
      logo_url: convertBlobUrl(data.logo_url, baseUrl),
      favicon_url: convertBlobUrl(data.favicon_url, baseUrl),
      login_background_url: convertBlobUrl(data.login_background_url, baseUrl),
      customer_background_url: convertBlobUrl(data.customer_background_url, baseUrl),
      main_banner_url: convertBlobUrl(data.main_banner_url, baseUrl),
      promo_banner_url: convertBlobUrl(data.promo_banner_url, baseUrl),
      splash_screen_url: convertBlobUrl(data.splash_screen_url, baseUrl),
    };
    
    return NextResponse.json(processedData);
  } catch (error) {
    console.error('Error fetching site settings:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    // Check if settings exist
    const { data: existing } = await supabase
      .from('site_settings')
      .select('id')
      .limit(1)
      .single();
    
    let result;
    
    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('site_settings')
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('site_settings')
        .insert(body)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating site settings:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
