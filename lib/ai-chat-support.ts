/**
 * AI Chat Support System
 * ตอบสมาชิกอัตโนมัติ - แจ้งผลหวย, โปรโมชั่น, คำถามทั่วไป
 * Production Ready with AI SDK
 */

import { generateText, streamText } from 'ai';
import { createClient } from '@/lib/supabase/server';

// Chat Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    intent?: string;
    confidence?: number;
    handedOff?: boolean;
  };
}

export interface ChatSession {
  id: string;
  customerId: string;
  customerName: string;
  messages: ChatMessage[];
  status: 'active' | 'closed' | 'handed_off';
  intent?: string;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
}

// Intent Classification
export type ChatIntent = 
  | 'lottery_result'
  | 'deposit'
  | 'withdraw'
  | 'promotion'
  | 'account'
  | 'how_to_play'
  | 'complaint'
  | 'other';

// Knowledge Base for common questions
const KNOWLEDGE_BASE: Record<ChatIntent, { keywords: string[]; response: string }> = {
  lottery_result: {
    keywords: ['ผลหวย', 'ผลรางวัล', 'ออกอะไร', 'ผลลอตเตอรี่', 'ออกเลข', 'รางวัล'],
    response: `สามารถตรวจผลหวยได้ที่:
1. เมนู "ผลรางวัล" บนหน้าหลัก
2. ดูผลหวยย้อนหลังได้ทุกงวด
3. หรือบอกชื่อหวยที่ต้องการทราบผล เช่น "ผลหวยลาว", "ผลหวยไทย"

ต้องการทราบผลหวยงวดไหนครับ?`,
  },
  deposit: {
    keywords: ['ฝากเงิน', 'เติมเงิน', 'โอนเงิน', 'ฝาก', 'เติมเครดิต'],
    response: `ขั้นตอนการฝากเงิน:
1. กดเมนู "เติมเงิน"
2. เลือกบัญชีปลายทาง
3. โอนเงินและแนบสลิป
4. รอระบบตรวจสอบอัตโนมัติ (1-3 นาที)

หากเกิน 5 นาทียังไม่เข้า กรุณาติดต่อเจ้าหน้าที่

มีปัญหาการฝากเงินอย่างไรครับ?`,
  },
  withdraw: {
    keywords: ['ถอนเงิน', 'ถอน', 'โอนออก', 'ถอนเครดิต', 'เอาเงินออก'],
    response: `ขั้นตอนการถอนเงิน:
1. กดเมนู "ถอนเงิน"
2. กรอกจำนวนเงินที่ต้องการถอน
3. ตรวจสอบบัญชีปลายทาง
4. ยืนยันการถอน

เงื่อนไข:
- ถอนขั้นต่ำ 100 บาท
- ต้องมียอด Turnover ครบตามที่กำหนด

มีปัญหาการถอนเงินอย่างไรครับ?`,
  },
  promotion: {
    keywords: ['โปรโมชั่น', 'โบนัส', 'โปร', 'สิทธิพิเศษ', 'แจก', 'ฟรี'],
    response: `โปรโมชั่นปัจจุบัน:
1. สมาชิกใหม่รับโบนัส 20%
2. ฝากครั้งแรกของวันรับเพิ่ม 5%
3. ถูกรางวัลรับโบนัสพิเศษ

ดูโปรโมชั่นทั้งหมดที่เมนู "โปรโมชั่น"

สนใจโปรโมชั่นไหนเป็นพิเศษครับ?`,
  },
  account: {
    keywords: ['บัญชี', 'รหัส', 'ลืมรหัส', 'เปลี่ยนรหัส', 'โปรไฟล์', 'ข้อมูล'],
    response: `จัดการบัญชี:
1. เปลี่ยนรหัสผ่าน: เมนู "โปรไฟล์" > "เปลี่ยนรหัสผ่าน"
2. แก้ไขข้อมูล: เมนู "โปรไฟล์" > "แก้ไขข้อมูล"
3. ลืมรหัสผ่าน: กดที่หน้า Login > "ลืมรหัสผ่าน"

ต้องการความช่วยเหลือเรื่องบัญชีอย่างไรครับ?`,
  },
  how_to_play: {
    keywords: ['วิธีเล่น', 'เล่นยังไง', 'แทงยังไง', 'วิธีแทง', 'สอน'],
    response: `วิธีแทงหวย:
1. กดเมนู "แทงหวย"
2. เลือกหวยที่ต้องการ
3. เลือกประเภท (3 ตัวบน/ล่าง, 2 ตัว, วิ่ง)
4. กรอกเลขและจำนวนเงิน
5. กดยืนยัน

อัตราจ่าย:
- 3 ตัวบน: บาทละ 850
- 3 ตัวโต๊ด: บาทละ 125
- 2 ตัวบน/ล่าง: บาทละ 90

ต้องการให้อธิบายเพิ่มเติมส่วนไหนครับ?`,
  },
  complaint: {
    keywords: ['ร้องเรียน', 'ปัญหา', 'ไม่ได้', 'ติดปัญหา', 'error', 'ผิดพลาด'],
    response: `ขออภัยในความไม่สะดวกครับ กรุณาแจ้งรายละเอียดปัญหา:
1. เกิดปัญหาอะไร
2. เกิดเมื่อไหร่
3. มี Screenshot หรือไม่

หากเป็นเรื่องเร่งด่วน จะส่งต่อให้เจ้าหน้าที่ดูแลทันที

กรุณาอธิบายปัญหาที่พบครับ`,
  },
  other: {
    keywords: [],
    response: `ขอบคุณที่ติดต่อมาครับ ผมช่วยเหลือเรื่องอะไรได้บ้างครับ?

สามารถถามได้เรื่อง:
- ผลหวย
- การฝาก-ถอนเงิน
- โปรโมชั่น
- วิธีเล่น
- ปัญหาการใช้งาน

หรือพิมพ์ "ติดต่อเจ้าหน้าที่" เพื่อให้เจ้าหน้าที่ดูแลโดยตรง`,
  },
};

/**
 * Classify Intent from message
 */
export function classifyIntent(message: string): { intent: ChatIntent; confidence: number } {
  const lowerMessage = message.toLowerCase();
  
  for (const [intent, data] of Object.entries(KNOWLEDGE_BASE) as [ChatIntent, typeof KNOWLEDGE_BASE.lottery_result][]) {
    const matchCount = data.keywords.filter(keyword => 
      lowerMessage.includes(keyword.toLowerCase())
    ).length;
    
    if (matchCount > 0) {
      const confidence = Math.min(matchCount / data.keywords.length * 100 + 50, 100);
      return { intent, confidence };
    }
  }
  
  return { intent: 'other', confidence: 30 };
}

/**
 * Get Quick Response from Knowledge Base
 */
export function getQuickResponse(intent: ChatIntent): string {
  return KNOWLEDGE_BASE[intent]?.response || KNOWLEDGE_BASE.other.response;
}

/**
 * AI Generate Response
 * Uses AI for complex queries
 */
export async function generateAIResponse(
  message: string,
  context: {
    customerId?: string;
    customerName?: string;
    previousMessages?: ChatMessage[];
    lotteryResults?: Array<{ name: string; result: string; date: string }>;
  }
): Promise<string> {
  const systemPrompt = `คุณคือผู้ช่วย AI ของเว็บหวยออนไลน์ FIN LOTTO R+
ชื่อของคุณคือ "น้องฟิน"
หน้าที่: ตอบคำถามลูกค้าเกี่ยวกับ
- ผลหวย (ถ้ามีข้อมูลผลหวยให้ใช้ข้อมูลจริง)
- การฝาก-ถอนเงิน
- โปรโมชั่นและโบนัส
- วิธีเล่นหวย
- ปัญหาการใช้งาน

กฎสำคัญ:
1. ตอบเป็นภาษาไทยเสมอ
2. ตอบสั้น กระชับ ได้ใจความ
3. ถ้าไม่แน่ใจ แนะนำให้ติดต่อเจ้าหน้าที่
4. ห้ามให้ข้อมูลส่วนตัวของลูกค้าคนอื่น
5. ห้ามพูดเรื่องการเมืองหรือเรื่องที่ไม่เกี่ยวข้อง
6. สุภาพและเป็นมิตรเสมอ

${context.customerName ? `ลูกค้าชื่อ: ${context.customerName}` : ''}
${context.lotteryResults ? `ผลหวยล่าสุด:\n${context.lotteryResults.map(r => `- ${r.name}: ${r.result} (${r.date})`).join('\n')}` : ''}`;

  try {
    const { text } = await generateText({
      model: 'openai/gpt-4o-mini' as Parameters<typeof generateText>[0]['model'],
      system: systemPrompt,
      messages: [
        ...(context.previousMessages || []).slice(-5).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user' as const, content: message },
      ],
      maxOutputTokens: 500,
      temperature: 0.7,
    });
    
    return text;
  } catch (error) {
    console.error('[AI Chat] Generate failed:', error);
    return getQuickResponse('other');
  }
}

/**
 * Stream AI Response
 */
export async function streamAIResponse(
  message: string,
  context: {
    customerId?: string;
    customerName?: string;
    previousMessages?: ChatMessage[];
  }
) {
  const systemPrompt = `คุณคือ "น้องฟิน" ผู้ช่วย AI ของ FIN LOTTO R+
ตอบคำถามเกี่ยวกับหวย, ฝาก-ถอน, โปรโมชั่น อย่างสุภาพและกระชับ`;

  return streamText({
    model: 'openai/gpt-4o-mini' as Parameters<typeof streamText>[0]['model'],
    system: systemPrompt,
    messages: [
      ...(context.previousMessages || []).slice(-5).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ],
    maxOutputTokens: 500,
  });
}

/**
 * Create Chat Session
 */
export async function createChatSession(
  customerId: string,
  customerName: string
): Promise<ChatSession> {
  const supabase = await createClient();
  const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  const session: ChatSession = {
    id: sessionId,
    customerId,
    customerName,
    messages: [],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  
  await supabase.from('chat_sessions').insert({
    id: sessionId,
    customer_id: customerId,
    customer_name: customerName,
    status: 'active',
    created_at: now,
    updated_at: now,
  });
  
  // Add welcome message
  const welcomeMessage: ChatMessage = {
    id: `msg_${Date.now()}`,
    role: 'assistant',
    content: `สวัสดีครับ คุณ${customerName} 👋\nน้องฟินยินดีให้บริการครับ\n\nสามารถถามได้เลยครับ ไม่ว่าจะเป็น:\n- ผลหวย\n- การฝาก-ถอน\n- โปรโมชั่น\n- วิธีเล่น`,
    timestamp: now,
  };
  
  await addMessage(sessionId, welcomeMessage);
  session.messages.push(welcomeMessage);
  
  return session;
}

/**
 * Add Message to Session
 */
export async function addMessage(
  sessionId: string,
  message: ChatMessage
): Promise<void> {
  const supabase = await createClient();
  
  await supabase.from('chat_messages').insert({
    id: message.id,
    session_id: sessionId,
    role: message.role,
    content: message.content,
    intent: message.metadata?.intent,
    confidence: message.metadata?.confidence,
    created_at: message.timestamp,
  });
  
  // Update session
  await supabase
    .from('chat_sessions')
    .update({ updated_at: message.timestamp })
    .eq('id', sessionId);
}

/**
 * Process Customer Message
 * Main entry point for chat
 */
export async function processMessage(
  sessionId: string,
  customerId: string,
  customerName: string,
  message: string
): Promise<{
  response: string;
  intent: ChatIntent;
  confidence: number;
  handedOff: boolean;
}> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  
  // Save user message
  const userMessage: ChatMessage = {
    id: `msg_${Date.now()}`,
    role: 'user',
    content: message,
    timestamp: now,
  };
  await addMessage(sessionId, userMessage);
  
  // Check for handoff request
  if (
    message.includes('ติดต่อเจ้าหน้าที่') ||
    message.includes('ขอคุยกับคน') ||
    message.includes('agent')
  ) {
    await supabase
      .from('chat_sessions')
      .update({ status: 'handed_off', updated_at: now })
      .eq('id', sessionId);
    
    const handoffResponse = `ส่งเรื่องให้เจ้าหน้าที่เรียบร้อยแล้วครับ กรุณารอสักครู่ เจ้าหน้าที่จะติดต่อกลับภายใน 5 นาที

ขอบคุณที่ใช้บริการครับ`;
    
    const assistantMessage: ChatMessage = {
      id: `msg_${Date.now() + 1}`,
      role: 'assistant',
      content: handoffResponse,
      timestamp: new Date().toISOString(),
      metadata: { intent: 'complaint', handedOff: true },
    };
    await addMessage(sessionId, assistantMessage);
    
    return {
      response: handoffResponse,
      intent: 'complaint',
      confidence: 100,
      handedOff: true,
    };
  }
  
  // Classify intent
  const { intent, confidence } = classifyIntent(message);
  
  let response: string;
  
  // Use AI for low confidence or complex queries
  if (confidence < 60 || message.length > 100) {
    // Get previous messages for context
    const { data: prevMessages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    const previousMessages: ChatMessage[] = (prevMessages || []).reverse().map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.created_at,
    }));
    
    // Get latest lottery results if asking about results
    let lotteryResults;
    if (intent === 'lottery_result') {
      const { data: results } = await supabase
        .from('lottery_results')
        .select('lottery_name, result, draw_date')
        .order('draw_date', { ascending: false })
        .limit(5);
      
      lotteryResults = results?.map(r => ({
        name: r.lottery_name,
        result: r.result,
        date: r.draw_date,
      }));
    }
    
    response = await generateAIResponse(message, {
      customerId,
      customerName,
      previousMessages,
      lotteryResults,
    });
  } else {
    response = getQuickResponse(intent);
  }
  
  // Save assistant response
  const assistantMessage: ChatMessage = {
    id: `msg_${Date.now() + 1}`,
    role: 'assistant',
    content: response,
    timestamp: new Date().toISOString(),
    metadata: { intent, confidence },
  };
  await addMessage(sessionId, assistantMessage);
  
  // Update session intent
  await supabase
    .from('chat_sessions')
    .update({ intent, updated_at: new Date().toISOString() })
    .eq('id', sessionId);
  
  return {
    response,
    intent,
    confidence,
    handedOff: false,
  };
}

/**
 * Get Chat Session
 */
export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  const supabase = await createClient();
  
  const { data: session } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
  
  if (!session) return null;
  
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  
  return {
    id: session.id,
    customerId: session.customer_id,
    customerName: session.customer_name,
    messages: (messages || []).map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.created_at,
      metadata: m.intent ? { intent: m.intent, confidence: m.confidence } : undefined,
    })),
    status: session.status,
    intent: session.intent,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    assignedTo: session.assigned_to,
  };
}

/**
 * Close Chat Session
 */
export async function closeChatSession(sessionId: string): Promise<void> {
  const supabase = await createClient();
  
  await supabase
    .from('chat_sessions')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', sessionId);
}

/**
 * Get Active Chats for Admin
 */
export async function getActiveChatSessions(limit: number = 50): Promise<ChatSession[]> {
  const supabase = await createClient();
  
  const { data: sessions } = await supabase
    .from('chat_sessions')
    .select('*')
    .in('status', ['active', 'handed_off'])
    .order('updated_at', { ascending: false })
    .limit(limit);
  
  return (sessions || []).map(s => ({
    id: s.id,
    customerId: s.customer_id,
    customerName: s.customer_name,
    messages: [],
    status: s.status,
    intent: s.intent,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    assignedTo: s.assigned_to,
  }));
}

/**
 * Assign Chat to Admin
 */
export async function assignChatToAdmin(
  sessionId: string,
  adminId: string
): Promise<void> {
  const supabase = await createClient();
  
  await supabase
    .from('chat_sessions')
    .update({ 
      assigned_to: adminId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
}