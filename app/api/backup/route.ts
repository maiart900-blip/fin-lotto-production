import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get all backups
    const { data: backups, error } = await supabase
      .from('backups')
      .select('id, created_at, created_by')
      .order('created_at', { ascending: false })
      .limit(30);
    
    if (error) throw error;
    
    return NextResponse.json(backups);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch backups' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    const supabase = await createClient();
    
    // Get all data
    const [entriesRes, customersRes, usersRes, settingsRes] = await Promise.all([
      supabase.from('entries').select('*'),
      supabase.from('customers').select('*'),
      supabase.from('users').select('id, username, display_name, role, created_at'),
      supabase.from('settings').select('*').eq('id', 1).single(),
    ]);
    
    const backupData = {
      entries: entriesRes.data || [],
      customers: customersRes.data || [],
      users: usersRes.data || [],
      settings: settingsRes.data || { site_name: 'สลากพลัส Lotto' },
      backupDate: new Date().toISOString(),
    };
    
    const { data, error } = await supabase
      .from('backups')
      .insert({
        backup_data: backupData,
        created_by: userId || null,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ backup: data, data: backupData });
  } catch {
    return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 });
  }
}
