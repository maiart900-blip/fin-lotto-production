import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTodayDateRange } from '@/lib/daily-reset';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get today's business day range (resets at 01:00 AM Thailand time)
    const todayRange = getTodayDateRange();

    // Fetch all pending counts in parallel
    const [
      topupResult,
      withdrawResult,
      newCustomersResult,
      newEntriesResult,
      depositIssuesResult,
      slipPendingResult,
    ] = await Promise.all([
      // Pending topup requests
      supabase
        .from('topup_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      
      // Pending withdraw requests
      supabase
        .from('withdraw_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      
      // New customers today (using 01:00 AM reset)
      supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayRange.start)
        .lte('created_at', todayRange.end),
      
      // Entries today (using 01:00 AM reset)
      supabase
        .from('entries')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayRange.start)
        .lte('created_at', todayRange.end),
      
      // Pending deposit issues
      supabase
        .from('deposit_issues')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
        
      // Pending slip verification
      supabase
        .from('topup_requests')
        .select('id', { count: 'exact', head: true })
        .eq('slip_status', 'pending'),
    ]);

    const counts = {
      topupPending: topupResult.count || 0,
      withdrawPending: withdrawResult.count || 0,
      newCustomersToday: newCustomersResult.count || 0,
      newEntriesToday: newEntriesResult.count || 0,
      depositIssuesPending: depositIssuesResult.count || 0,
      slipPending: slipPendingResult.count || 0,
      totalPending: (topupResult.count || 0) + (withdrawResult.count || 0) + (depositIssuesResult.count || 0) + (slipPendingResult.count || 0),
    };

    return NextResponse.json(counts);
  } catch (error) {
    console.error('[v0] Pending counts error:', error);
    return NextResponse.json({
      topupPending: 0,
      withdrawPending: 0,
      newCustomersToday: 0,
      newEntriesToday: 0,
      depositIssuesPending: 0,
      slipPending: 0,
      totalPending: 0,
    });
  }
}
