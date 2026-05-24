import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();

  try {
    const { data: settings, error } = await supabase
      .from('payroll_settings')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching payroll settings:', error);
    }

    // Return default if no settings found
    if (!settings) {
      return NextResponse.json({
        settings: {
          base_salary: 15000,
          late_penalty_per_minute: 5,
          ot_rate_per_hour: 45,
          work_hours_per_day: 8,
          work_start_hour: 9,
          rest_days_per_week: 1,
          bonus_per_customer: 10,
          bonus_no_error: 500,
          bonus_top_performer: 1000,
        },
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error in payroll settings API:', error);
    return NextResponse.json({
      settings: {
        base_salary: 15000,
        late_penalty_per_minute: 5,
        ot_rate_per_hour: 45,
        work_hours_per_day: 8,
        work_start_hour: 9,
        rest_days_per_week: 1,
        bonus_per_customer: 10,
        bonus_no_error: 500,
        bonus_top_performer: 1000,
      },
    });
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  try {
    // Check if settings exist
    const { data: existing } = await supabase
      .from('payroll_settings')
      .select('id')
      .single();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('payroll_settings')
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Insert new
      const { error } = await supabase
        .from('payroll_settings')
        .insert(body);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving payroll settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
