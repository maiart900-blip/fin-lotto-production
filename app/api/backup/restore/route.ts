import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit-logger';

export async function POST(request: Request) {
  try {
    // Auth guard - require super_admin for restore
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { backupData } = await request.json();
    const supabase = await createClient();

    // Audit log before restore
    await logAudit({
      action: 'backup_restore',
      actor_id: user.id,
      actor_type: 'admin',
      target_type: 'system',
      target_id: 'database',
      details: { backup_tables: Object.keys(backupData || {}) },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
    });

    // Clear existing data (except users to prevent lockout)
    await supabase.from('entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Restore customers first (for foreign key)
    if (backupData.customers?.length > 0) {
      const { error: customersError } = await supabase
        .from('customers')
        .insert(backupData.customers.map((c: { id: string; name: string; phone?: string; note?: string; created_at?: string; updated_at?: string }) => ({
          id: c.id,
          name: c.name,
          phone: c.phone || null,
          note: c.note || null,
          created_at: c.created_at || new Date().toISOString(),
          updated_at: c.updated_at || new Date().toISOString(),
        })));
      if (customersError) console.error('Customers restore error:', customersError);
    }
    
    // Restore entries
    if (backupData.entries?.length > 0) {
      const { error: entriesError } = await supabase
        .from('entries')
        .insert(backupData.entries.map((e: { id: string; number: string; bet_type: string; amount: number; customer_id?: string; created_by?: string; created_at?: string }) => ({
          id: e.id,
          number: e.number,
          bet_type: e.bet_type,
          amount: e.amount,
          customer_id: e.customer_id || null,
          created_by: e.created_by || null,
          created_at: e.created_at || new Date().toISOString(),
        })));
      if (entriesError) console.error('Entries restore error:', entriesError);
    }
    
    // Update settings
    if (backupData.settings) {
      await supabase
        .from('settings')
        .update({ site_name: backupData.settings.site_name })
        .eq('id', 1);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Restore error:', error);
    return NextResponse.json({ error: 'Failed to restore backup' }, { status: 500 });
  }
}
