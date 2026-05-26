import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AutoRecovery } from '@/lib/auto-recovery'

// Cron job for auto-recovery - runs every 5 minutes
// Vercel cron: */5 * * * *

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const recovery = new AutoRecovery(supabase)
  
  try {
    const results = await recovery.runAllRecoveryChecks()
    
    // Log summary
    const actionsCount = results.filter(r => r.action_taken).length
    const successCount = results.filter(r => r.success).length
    
    console.log(`[AutoRecovery] Completed: ${actionsCount} actions taken, ${successCount}/${results.length} successful`)
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        total_checks: results.length,
        actions_taken: actionsCount,
        successful: successCount
      }
    })
  } catch (error) {
    console.error('[AutoRecovery] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
