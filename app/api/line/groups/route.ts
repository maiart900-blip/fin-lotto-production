import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Fetch all LINE groups
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('line_groups')
      .select('*')
      .order('is_primary', { ascending: false })
      .order('last_activity_at', { ascending: false });
    
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
    }
    
    return NextResponse.json({ groups: data || [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Manage LINE groups
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { group_id, action, group_name } = body;
    
    if (!group_id && action !== 'add') {
      return NextResponse.json({ error: 'group_id is required' }, { status: 400 });
    }
    
    // Set primary group
    if (action === 'set_primary') {
      await supabase
        .from('line_groups')
        .update({ is_primary: false })
        .neq('group_id', '');
      
      const { error } = await supabase
        .from('line_groups')
        .update({ is_primary: true })
        .eq('group_id', group_id);
      
      if (error) {
        return NextResponse.json({ error: 'Failed to set primary group' }, { status: 500 });
      }
      
      return NextResponse.json({ success: true, message: 'ตั้งเป็นกลุ่มหลักแล้ว' });
    }
    
    // Delete group
    if (action === 'delete') {
      const { error } = await supabase
        .from('line_groups')
        .delete()
        .eq('group_id', group_id);
      
      if (error) {
        return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
      }
      
      return NextResponse.json({ success: true, message: 'ลบกลุ่มแล้ว' });
    }
    
    // Add group manually
    if (action === 'add') {
      if (!group_id) {
        return NextResponse.json({ error: 'group_id is required' }, { status: 400 });
      }
      
      const { error } = await supabase
        .from('line_groups')
        .upsert({
          group_id,
          group_name: group_name || 'กลุ่มที่เพิ่มด้วยตนเอง',
          is_active: true,
          joined_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        }, {
          onConflict: 'group_id',
        });
      
      if (error) {
        return NextResponse.json({ error: 'Failed to add group' }, { status: 500 });
      }
      
      return NextResponse.json({ success: true, message: 'เพิ่มกลุ่มแล้ว' });
    }
    
    // Test send to specific group
    if (action === 'test_send') {
      const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      
      if (!channelAccessToken) {
        return NextResponse.json({ 
          success: false, 
          error: 'ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN' 
        }, { status: 400 });
      }
      
      try {
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${channelAccessToken}`,
          },
          body: JSON.stringify({
            to: group_id,
            messages: [{
              type: 'text',
              text: `🔔 ทดสอบการส่งข้อความ\n\nกลุ่มนี้เชื่อมต่อสำเร็จแล้ว!`,
            }],
          }),
        });
        
        if (response.ok) {
          // Update last activity
          await supabase
            .from('line_groups')
            .update({ last_activity_at: new Date().toISOString() })
            .eq('group_id', group_id);
          
          return NextResponse.json({ success: true, message: 'ส่งข้อความทดสอบสำเร็จ' });
        }
        
        const errorData = await response.json().catch(() => ({}));
        return NextResponse.json({ 
          success: false, 
          error: errorData.message || 'ไม่สามารถส่งข้อความได้' 
        }, { status: 400 });
      } catch (err) {
        return NextResponse.json({ 
          success: false, 
          error: err instanceof Error ? err.message : 'Unknown error' 
        }, { status: 500 });
      }
    }
    
    // Toggle active status
    if (action === 'toggle_active') {
      const { data: current } = await supabase
        .from('line_groups')
        .select('is_active')
        .eq('group_id', group_id)
        .single();
      
      const { error } = await supabase
        .from('line_groups')
        .update({ is_active: !current?.is_active })
        .eq('group_id', group_id);
      
      if (error) {
        return NextResponse.json({ error: 'Failed to toggle group' }, { status: 500 });
      }
      
      return NextResponse.json({ 
        success: true, 
        message: current?.is_active ? 'ปิดใช้งานกลุ่มแล้ว' : 'เปิดใช้งานกลุ่มแล้ว' 
      });
    }
    
    // Update group name
    if (action === 'rename') {
      if (!group_name) {
        return NextResponse.json({ error: 'group_name is required' }, { status: 400 });
      }
      
      const { error } = await supabase
        .from('line_groups')
        .update({ group_name })
        .eq('group_id', group_id);
      
      if (error) {
        return NextResponse.json({ error: 'Failed to rename group' }, { status: 500 });
      }
      
      return NextResponse.json({ success: true, message: 'เปลี่ยนชื่อกลุ่มแล้ว' });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
