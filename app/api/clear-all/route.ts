import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit-logger';

export async function POST(request: NextRequest) {
  try {
    // Auth guard - require super_admin for clear all
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const supabase = await createClient();

    // Audit log before clear
    await logAudit({
      action: 'clear_all_data',
      actor_id: user.id,
      actor_type: 'admin',
      target_type: 'system',
      target_id: 'database',
      details: { action: 'clear_entries_customers_receipts' },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
    });

    // Clear entries and customers (keep users and settings)
    await supabase.from('entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('receipts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to clear data' }, { status: 500 });
  }
}
