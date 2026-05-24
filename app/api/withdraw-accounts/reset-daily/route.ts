import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const supabase = await createClient();
    
    // Reset current_daily_used to 0 for all accounts
    const { error } = await supabase
      .from('withdraw_accounts')
      .update({ 
        current_daily_used: 0,
        last_reset_date: new Date().toISOString().split('T')[0]
      })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all

    if (error) {
      console.error('Error resetting daily:', error);
      return NextResponse.json({ error: 'Failed to reset' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Daily used amounts reset successfully',
      reset_date: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
