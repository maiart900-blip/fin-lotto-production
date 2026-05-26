import { NextResponse } from 'next/server'
import { runChaosTests } from '@/lib/chaos-testing'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  try {
    const { results, resilience } = await runChaosTests()
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
      resilience,
      summary: {
        total_tests: results.length,
        passed: results.filter(r => r.status === 'pass').length,
        warnings: results.filter(r => r.status === 'warning').length,
        failed: results.filter(r => r.status === 'fail').length,
        all_data_intact: results.every(r => r.data_integrity),
        all_recovery_verified: results.every(r => r.recovery_verified),
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
