import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get rate settings
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'auto_rates')
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is okay for first time
      throw error;
    }

    // Default rates if not set
    const defaultRates = {
      two_top: 95,
      two_bottom: 95,
      three_top: 850,
      three_tod: 140,
      run_top: 3.5,
      run_bottom: 4.5,
    };

    return NextResponse.json(settings?.value || defaultRates);
  } catch (error) {
    console.error('Error fetching rates:', error);
    // Return default rates on error
    return NextResponse.json({
      two_top: 95,
      two_bottom: 95,
      three_top: 850,
      three_tod: 140,
      run_top: 3.5,
      run_bottom: 4.5,
    });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    // Validate rates
    const rates = {
      two_top: Number(body.two_top) || 95,
      two_bottom: Number(body.two_bottom) || 95,
      three_top: Number(body.three_top) || 850,
      three_tod: Number(body.three_tod) || 140,
      run_top: Number(body.run_top) || 3.5,
      run_bottom: Number(body.run_bottom) || 4.5,
    };

    // Upsert rate settings
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'auto_rates',
        value: rates,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key'
      });

    if (error) throw error;
    
    return NextResponse.json({ 
      success: true, 
      message: 'เรทจ่ายถูกบันทึกแล้ว',
      rates 
    });
  } catch (error) {
    console.error('Error saving rates:', error);
    return NextResponse.json(
      { success: false, message: 'ไม่สามารถบันทึกเรทจ่ายได้' },
      { status: 500 }
    );
  }
}
