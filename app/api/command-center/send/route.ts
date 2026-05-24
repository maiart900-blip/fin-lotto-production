import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { commandPipe } from '@/lib/double-pipe';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { type, payload, targetAgents, priority } = body;

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    const createdBy = user?.id || 'system';

    // Send command via Double-Pipe
    const result = await commandPipe.sendCommand({
      type,
      payload,
      priority: priority || 'high',
      targetAgents: targetAgents || 'all',
      createdBy,
    });

    // Log to audit
    await supabase.from('audit_logs').insert({
      action: `command_${type}`,
      entity_type: 'network_command',
      entity_id: result.commandId,
      new_data: { type, payload, targetAgents, deliveredTo: result.deliveredTo },
      user_id: createdBy,
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Command center send error:', error);
    return NextResponse.json({ success: false, error: 'Failed to send command' }, { status: 500 });
  }
}
