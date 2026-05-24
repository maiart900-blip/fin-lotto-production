import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// LINE Webhook Event Types
interface LineEvent {
  type: string;
  timestamp: number;
  source: {
    type: string;
    groupId?: string;
    userId?: string;
    roomId?: string;
  };
  replyToken?: string;
  message?: {
    type: string;
    id: string;
    text?: string;
  };
}

interface LineWebhookBody {
  events: LineEvent[];
  destination: string;
}

// Verify LINE signature
function verifySignature(body: string, signature: string, channelSecret: string): boolean {
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// Get group summary from LINE API
async function getGroupSummary(groupId: string, accessToken: string) {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/group/${groupId}/summary`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch {
    return null;
  }
}

// Get group member count from LINE API
async function getGroupMemberCount(groupId: string, accessToken: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/group/${groupId}/members/count`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (res.ok) {
      const data = await res.json();
      return data.count;
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    
    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Handle empty body (LINE verification request)
    if (!rawBody || rawBody.trim() === '') {
      console.log('[LINE Webhook] Verification request (empty body)');
      return NextResponse.json({ success: true }, { status: 200 });
    }
    
    // Parse body
    let body: LineWebhookBody;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.log('[LINE Webhook] Invalid JSON body');
      return NextResponse.json({ success: true }, { status: 200 });
    }
    
    // Handle empty events array (also verification)
    if (!body.events || body.events.length === 0) {
      console.log('[LINE Webhook] Verification request (empty events)');
      return NextResponse.json({ success: true }, { status: 200 });
    }
    
    // Verify signature if channel secret is set
    if (channelSecret) {
      const signature = request.headers.get('x-line-signature');
      if (signature && !verifySignature(rawBody, signature, channelSecret)) {
        console.log('[LINE Webhook] Invalid signature');
        // Still return 200 to prevent LINE from disabling webhook
        return NextResponse.json({ success: true }, { status: 200 });
      }
    }
    
    const supabase = await createClient();
    
    // Process events
    for (const event of body.events) {
      console.log('[LINE Webhook] Event:', event.type, 'Source:', event.source);
      
      // Handle join event (Bot ถูกเชิญเข้ากลุ่ม)
      if (event.type === 'join' && event.source.groupId) {
        const groupId = event.source.groupId;
        
        // Get group info from LINE API
        let groupName = null;
        let memberCount = null;
        
        if (accessToken) {
          const summary = await getGroupSummary(groupId, accessToken);
          if (summary) {
            groupName = summary.groupName;
          }
          memberCount = await getGroupMemberCount(groupId, accessToken);
        }
        
        // Save to database
        const { error } = await supabase
          .from('line_groups')
          .upsert({
            group_id: groupId,
            group_name: groupName,
            member_count: memberCount,
            joined_at: new Date().toISOString(),
            last_activity_at: new Date().toISOString(),
            is_active: true,
          }, {
            onConflict: 'group_id',
          });
        
        if (error) {
          console.log('[LINE Webhook] Error saving group:', error);
        } else {
          console.log('[LINE Webhook] Saved group:', groupId, groupName);
        }
      }
      
      // Handle message event (อัปเดต last_activity และดึง groupId)
      if (event.type === 'message' && event.source.groupId) {
        const groupId = event.source.groupId;
        
        // Check if group exists, if not create it
        const { data: existingGroup } = await supabase
          .from('line_groups')
          .select('id')
          .eq('group_id', groupId)
          .single();
        
        if (existingGroup) {
          // Update last activity
          await supabase
            .from('line_groups')
            .update({ last_activity_at: new Date().toISOString() })
            .eq('group_id', groupId);
        } else {
          // New group discovered via message
          let groupName = null;
          let memberCount = null;
          
          if (accessToken) {
            const summary = await getGroupSummary(groupId, accessToken);
            if (summary) {
              groupName = summary.groupName;
            }
            memberCount = await getGroupMemberCount(groupId, accessToken);
          }
          
          await supabase
            .from('line_groups')
            .insert({
              group_id: groupId,
              group_name: groupName,
              member_count: memberCount,
              joined_at: new Date().toISOString(),
              last_activity_at: new Date().toISOString(),
              is_active: true,
            });
          
          console.log('[LINE Webhook] New group from message:', groupId);
        }
      }
      
      // Handle leave event (Bot ถูกเตะออกจากกลุ่ม)
      if (event.type === 'leave' && event.source.groupId) {
        const groupId = event.source.groupId;
        
        await supabase
          .from('line_groups')
          .update({ is_active: false })
          .eq('group_id', groupId);
        
        console.log('[LINE Webhook] Left group:', groupId);
      }
    }
    
    // LINE expects 200 OK
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[LINE Webhook] Error:', error);
    // Always return 200 to prevent LINE from disabling webhook
    return NextResponse.json({ success: true }, { status: 200 });
  }
}

// GET - Return webhook URL info
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  const webhookUrl = baseUrl ? `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}/api/line/webhook` : null;
  
  return NextResponse.json({
    webhookUrl,
    instructions: [
      '1. ไปที่ LINE Developers Console',
      '2. เลือก Channel ของคุณ',
      '3. ไปที่ Messaging API > Webhook settings',
      '4. ใส่ Webhook URL ด้านบน',
      '5. เปิด Use webhook',
      '6. นำ Bot เข้ากลุ่มที่ต้องการ',
    ],
  });
}
