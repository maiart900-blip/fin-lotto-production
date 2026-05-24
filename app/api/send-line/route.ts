import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createLotteryResultMessage,
  createTopupNotifyMessage,
  createWithdrawNotifyMessage,
  createWinNotifyMessage,
  createCustomMessage,
  createBroadcastMessage,
  type LotteryResultData,
  type TopupNotifyData,
  type WithdrawNotifyData,
  type WinNotifyData,
  type MessageType,
} from '@/lib/line-message-templates';

/**
 * LINE Messaging API - Multi-Group Push Message
 * Premium Edition with Rich Templates
 * 
 * รองรับการส่งข้อความไปหลายกลุ่มพร้อมกัน
 * รองรับ Message Templates: ผลหวย, เติมเงิน, ถอน, ถูกรางวัล
 * 
 * ENV Variables:
 * - LINE_CHANNEL_ACCESS_TOKEN: Channel Access Token
 * - LINE_GROUP_IDS: Comma-separated Group IDs (optional, can use database instead)
 */

// ฟังก์ชันสร้างข้อความตาม Template
function buildMessage(body: Record<string, unknown>): string {
  const messageType = body.messageType as MessageType | undefined;
  
  // ถ้ามี customMessage ใช้เลย
  if (body.customMessage) {
    return createCustomMessage(body.customMessage as string, body.includeHeader !== false);
  }
  
  // ถ้ามี message ธรรมดา (backward compatible)
  if (body.message && !body.lotteryName) {
    return body.message as string;
  }
  
  // เลือก template ตาม messageType
  switch (messageType) {
    case 'topup':
      return createTopupNotifyMessage(body as unknown as TopupNotifyData);
      
    case 'withdraw':
      return createWithdrawNotifyMessage(body as unknown as WithdrawNotifyData);
      
    case 'win':
      return createWinNotifyMessage(body as unknown as WinNotifyData);
      
    case 'broadcast':
      return createBroadcastMessage(
        (body.title as string) || 'ประกาศ',
        (body.content as string) || (body.message as string) || '',
        (body.broadcastType as 'info' | 'warning' | 'success' | 'promo') || 'info'
      );
      
    case 'lottery_result':
    default:
      // Default: ประกาศผลหวย
      if (body.lotteryName || body.top3 || body.bottom2) {
        return createLotteryResultMessage({
          lotteryName: (body.lotteryName as string) || 'หวย',
          resultDate: body.resultDate as string,
          top3: body.top3 as string,
          bottom2: body.bottom2 as string,
          top2: body.top2 as string,
          first: body.first as string,
          front3: body.front3 as string,
          back3: body.back3 as string,
          back2: body.back2 as string,
          runTop: body.runTop as string,
          runBottom: body.runBottom as string,
          prizes: body.prizes as Record<string, string>,
        });
      }
      
      // Fallback
      return body.message as string || 'ข้อความจาก FIN LOTTO P+';
  }
}

// ส่งข้อความไปกลุ่มเดียว
async function sendToGroup(
  channelAccessToken: string,
  groupId: string,
  messageText: string
): Promise<{ success: boolean; groupId: string; error?: string }> {
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: groupId,
        messages: [{ type: 'text', text: messageText }],
      }),
    });

    if (response.ok) {
      return { success: true, groupId };
    }

    const errorData = await response.json().catch(() => ({}));
    return { 
      success: false, 
      groupId, 
      error: errorData.message || `HTTP ${response.status}` 
    };
  } catch (error) {
    return { 
      success: false, 
      groupId, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      lotteryName, 
      resultDate, 
      top3, 
      bottom2, 
      customMessage,
      message,
      token,
      groupId,      // Single group (backward compatible)
      groupIds,     // Multiple groups (array)
      sendToAll,    // Send to all groups in database
    } = body;

    const channelAccessToken = token || process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!channelAccessToken) {
      return NextResponse.json(
        { 
          error: 'ยังไม่ได้ตั้งค่า LINE Token',
          details: 'กรุณาตั้งค่า LINE_CHANNEL_ACCESS_TOKEN ใน Environment Variables',
          code: 'MISSING_TOKEN'
        },
        { status: 400 }
      );
    }

    // สร้างข้อความด้วย Template ใหม่
    const messageText = buildMessage(body);

    if (!messageText) {
      return NextResponse.json(
        { error: 'ต้องระบุข้อความหรือข้อมูลผลหวย' },
        { status: 400 }
      );
    }

    // กำหนด target groups
    let targetGroups: string[] = [];

    if (sendToAll) {
      // ดึงทุกกลุ่มจาก database
      const supabase = await createClient();
      const { data: dbGroups } = await supabase
        .from('line_groups')
        .select('group_id')
        .eq('is_active', true);
      
      if (dbGroups && dbGroups.length > 0) {
        targetGroups = dbGroups.map(g => g.group_id);
      }
    } else if (groupIds && Array.isArray(groupIds) && groupIds.length > 0) {
      // ส่งไปกลุ่มที่ระบุ
      targetGroups = groupIds;
    } else if (groupId) {
      // ส่งไปกลุ่มเดียว (backward compatible)
      targetGroups = [groupId];
    } else {
      // ใช้ ENV - รองรับทั้ง LINE_GROUP_IDS (comma-separated) และ LINE_GROUP_ID (single)
      const envGroupIds = process.env.LINE_GROUP_IDS;
      const envGroupId = process.env.LINE_GROUP_ID;
      
      if (envGroupIds) {
        targetGroups = envGroupIds.split(',').map(id => id.trim()).filter(Boolean);
      } else if (envGroupId) {
        targetGroups = [envGroupId];
      }
    }

    if (targetGroups.length === 0) {
      return NextResponse.json(
        { 
          error: 'ไม่พบกลุ่ม LINE ที่จะส่งข้อความ',
          details: 'กรุณาเพิ่มกลุ่ม LINE หรือตั้งค่า LINE_GROUP_IDS',
          code: 'NO_GROUPS'
        },
        { status: 400 }
      );
    }

    // ส่งข้อความไปทุกกลุ่มพร้อมกัน
    const results = await Promise.all(
      targetGroups.map(gId => sendToGroup(channelAccessToken, gId, messageText))
    );

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: failedCount === 0,
      message: `ส่งสำเร็จ ${successCount}/${targetGroups.length} กลุ่ม`,
      sentMessage: messageText,
      results,
      stats: {
        total: targetGroups.length,
        success: successCount,
        failed: failedCount,
      }
    });
  } catch (error) {
    console.error('LINE Messaging API error:', error);
    return NextResponse.json(
      {
        error: 'เกิดข้อผิดพลาดในการส่งข้อความ',
        details: error instanceof Error ? error.message : 'Unknown error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

// GET - ตรวจสอบสถานะการตั้งค่า LINE
export async function GET() {
  const hasToken = !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const envGroupIds = process.env.LINE_GROUP_IDS;
  const envGroupId = process.env.LINE_GROUP_ID;
  
  let groupCount = 0;
  if (envGroupIds) {
    groupCount = envGroupIds.split(',').filter(Boolean).length;
  } else if (envGroupId) {
    groupCount = 1;
  }

  // ดึงกลุ่มจาก database ด้วย
  let dbGroupCount = 0;
  try {
    const supabase = await createClient();
    const { data: dbGroups } = await supabase
      .from('line_groups')
      .select('group_id')
      .eq('is_active', true);
    dbGroupCount = dbGroups?.length || 0;
  } catch {
    // Ignore error
  }

  const totalGroups = Math.max(groupCount, dbGroupCount);

  return NextResponse.json({
    configured: hasToken && totalGroups > 0,
    token: hasToken ? '********' : null,
    groupCount: totalGroups,
    envGroups: groupCount,
    dbGroups: dbGroupCount,
    status: {
      token: hasToken ? 'configured' : 'missing',
      groups: totalGroups > 0 ? 'configured' : 'missing',
    },
    message: !hasToken 
      ? 'ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN'
      : totalGroups === 0
        ? 'ยังไม่มีกลุ่ม LINE'
        : `พร้อมใช้งาน (${totalGroups} กลุ่ม)`,
  });
}
