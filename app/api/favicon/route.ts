import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: settings } = await supabase
      .from('site_settings')
      .select('favicon_url')
      .single();
    
    if (settings?.favicon_url) {
      // Redirect to the favicon URL from settings
      return NextResponse.redirect(settings.favicon_url);
    }
    
    // Fallback to default favicon
    return NextResponse.redirect(new URL('/favicon-32x32.png', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  } catch {
    return NextResponse.redirect(new URL('/favicon-32x32.png', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  }
}
