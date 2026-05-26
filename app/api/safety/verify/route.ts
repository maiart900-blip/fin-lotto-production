import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SafetyGuardrails } from '@/lib/safety-guardrails';

// GET /api/safety/verify - Run all safety checks
export async function GET() {
  try {
    const supabase = await createClient();
    const safety = new SafetyGuardrails(supabase);
    
    // Run comprehensive safety verification
    const results = await safety.runAllChecks();
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        total_checks: results.length,
        passed: results.filter(r => r.status === 'pass').length,
        warnings: results.filter(r => r.status === 'warning').length,
        failed: results.filter(r => r.status === 'fail').length,
      },
      all_passed: results.every(r => r.status === 'pass'),
      production_ready: results.every(r => r.status !== 'fail'),
    });
  } catch (error) {
    console.error('[Safety Verify] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// POST /api/safety/verify - Run specific safety check
export async function POST(request: Request) {
  try {
    const { check_type } = await request.json();
    const supabase = await createClient();
    const safety = new SafetyGuardrails(supabase);
    
    let result;
    switch (check_type) {
      case 'duplicate_payouts':
        result = await safety.checkDuplicatePayouts();
        break;
      case 'ledger_integrity':
        result = await safety.checkLedgerIntegrity();
        break;
      case 'orphan_entries':
        result = await safety.checkOrphanEntries();
        break;
      case 'global_controls':
        result = await safety.checkGlobalControls();
        break;
      case 'worker_locks':
        result = await safety.checkWorkerLocks();
        break;
      default:
        return NextResponse.json({ error: 'Invalid check_type' }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      check_type,
      result,
    });
  } catch (error) {
    console.error('[Safety Verify POST] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
