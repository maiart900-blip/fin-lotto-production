/**
 * LINE Message Templates - Premium Edition
 * FIN LOTTO P+
 * 
 * รองรับ:
 * - ผลรางวัล (หวยไทย, ฮานอย, ลาว, หุ้น, อื่นๆ)
 * - แจ้งเติมเงิน
 * - แจ้งถอนเงิน
 * - แจ้งถูกรางวัล
 * 
 * Mobile friendly, Dark Mode compatible
 */

// ========================
// CONSTANTS & BRANDING
// ========================

export const BRAND = {
  name: 'FIN LOTTO P+',
  tagline: 'เว็บหวยออนไลน์อันดับ 1',
  website: 'finlottop.com',
  logo: '🎰',
};

// Emoji sets for different lottery types
export const LOTTERY_EMOJI: Record<string, { icon: string; flag: string; color: string }> = {
  // หวยไทย
  'หวยรัฐบาล': { icon: '🇹🇭', flag: '🏆', color: '🟡' },
  'หวยไทย': { icon: '🇹🇭', flag: '🏆', color: '🟡' },
  'ธกส': { icon: '🇹🇭', flag: '🌾', color: '🟢' },
  'ออมสิน': { icon: '🇹🇭', flag: '🏦', color: '🟣' },
  
  // หวยฮานอย
  'ฮานอย': { icon: '🇻🇳', flag: '⭐', color: '🔴' },
  'ฮานอยพิเศษ': { icon: '🇻🇳', flag: '💎', color: '🔴' },
  'ฮานอยVIP': { icon: '🇻🇳', flag: '👑', color: '🔴' },
  
  // หวยลาว
  'ลาว': { icon: '🇱🇦', flag: '🌟', color: '🔵' },
  'ลาวพัฒนา': { icon: '🇱🇦', flag: '🚀', color: '🔵' },
  'ลาวสตาร์': { icon: '🇱🇦', flag: '✨', color: '🔵' },
  
  // หวยหุ้น
  'หุ้นไทย': { icon: '📈', flag: '🇹🇭', color: '🟢' },
  'หุ้นจีน': { icon: '📈', flag: '🇨🇳', color: '🔴' },
  'หุ้นฮั่งเส็ง': { icon: '📈', flag: '🇭🇰', color: '🟠' },
  'หุ้นญี่ปุ่น': { icon: '📈', flag: '🇯🇵', color: '⚪' },
  'หุ้นเกาหลี': { icon: '📈', flag: '🇰🇷', color: '🔵' },
  'หุ้นสิงคโปร์': { icon: '📈', flag: '🇸🇬', color: '🔴' },
  'หุ้นอินเดีย': { icon: '📈', flag: '🇮🇳', color: '🟠' },
  'หุ้นอังกฤษ': { icon: '📈', flag: '🇬🇧', color: '🔵' },
  'หุ้นเยอรมัน': { icon: '📈', flag: '🇩🇪', color: '🟡' },
  'หุ้นรัสเซีย': { icon: '📈', flag: '🇷🇺', color: '🔴' },
  'ดาวโจนส์': { icon: '📈', flag: '🇺🇸', color: '🔵' },
  
  // หวยยี่กี
  'ยี่กี': { icon: '🎲', flag: '⚡', color: '🟣' },
  'ยี่กีVIP': { icon: '🎲', flag: '👑', color: '🟣' },
  
  // หวยปิงปอง
  'ปิงปอง': { icon: '🏓', flag: '🎯', color: '🟠' },
  
  // มาเลย์
  'มาเลย์': { icon: '🇲🇾', flag: '🌙', color: '🔵' },
  
  // Default
  'default': { icon: '🎰', flag: '🎯', color: '🟡' },
};

// ========================
// HELPER FUNCTIONS
// ========================

function getLotteryEmoji(lotteryName: string): { icon: string; flag: string; color: string } {
  // ค้นหา exact match ก่อน
  if (LOTTERY_EMOJI[lotteryName]) {
    return LOTTERY_EMOJI[lotteryName];
  }
  
  // ค้นหา partial match
  const lowerName = lotteryName.toLowerCase();
  for (const [key, value] of Object.entries(LOTTERY_EMOJI)) {
    if (lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName)) {
      return value;
    }
  }
  
  // ตรวจสอบประเภท
  if (lowerName.includes('หุ้น') || lowerName.includes('stock')) {
    return { icon: '📈', flag: '📊', color: '🟢' };
  }
  if (lowerName.includes('ฮานอย') || lowerName.includes('hanoi')) {
    return { icon: '🇻🇳', flag: '⭐', color: '🔴' };
  }
  if (lowerName.includes('ลาว') || lowerName.includes('lao')) {
    return { icon: '🇱🇦', flag: '🌟', color: '🔵' };
  }
  if (lowerName.includes('ยี่กี') || lowerName.includes('yeekee')) {
    return { icon: '🎲', flag: '⚡', color: '🟣' };
  }
  
  return LOTTERY_EMOJI['default'];
}

function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getTimeString(): string {
  return new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDateString(): string {
  return new Date().toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ========================
// LINE SEPARATORS
// ========================

const LINE = {
  double: '═══════════════════',
  single: '───────────────────',
  dotted: '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄',
  star: '✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦',
  wave: '〰️〰️〰️〰️〰️〰️〰️〰️〰️〰️',
  diamond: '◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆',
};

// ========================
// MESSAGE TEMPLATES
// ========================

export interface LotteryResultData {
  lotteryName: string;
  resultDate?: string;
  top3?: string;      // 3 ตัวบน
  bottom2?: string;   // 2 ตัวล่าง
  top2?: string;      // 2 ตัวบน (บางหวย)
  first?: string;     // รางวัลที่ 1
  front3?: string;    // 3 ตัวหน้า
  back3?: string;     // 3 ตัวหลัง
  back2?: string;     // 2 ตัวหลัง
  runTop?: string;    // วิ่งบน
  runBottom?: string; // วิ่งล่าง
  prizes?: Record<string, string>; // รางวัลอื่นๆ
}

export interface TopupNotifyData {
  username: string;
  amount: number;
  method?: string;    // วิธีการเติม (โอน, พร้อมเพย์, ฯลฯ)
  balance?: number;   // ยอดคงเหลือ
  transactionId?: string;
}

export interface WithdrawNotifyData {
  username: string;
  amount: number;
  bankName?: string;
  accountNumber?: string;
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  transactionId?: string;
}

export interface WinNotifyData {
  username: string;
  lotteryName: string;
  betNumber: string;
  betType: string;    // ประเภทการแทง (3ตัวบน, 2ตัวล่าง, ฯลฯ)
  betAmount: number;
  winAmount: number;
  resultDate?: string;
}

// ========================
// LOTTERY RESULT MESSAGES
// ========================

/**
 * สร้างข้อความประกาศผลหวย - รูปแบบ Premium
 */
export function createLotteryResultMessage(data: LotteryResultData): string {
  const emoji = getLotteryEmoji(data.lotteryName);
  const date = data.resultDate || getDateString();
  
  let message = `
${emoji.icon} ${BRAND.logo} ${BRAND.name} ${BRAND.logo} ${emoji.icon}
${LINE.double}

${emoji.flag} ผลหวย ${data.lotteryName}
📅 ประจำวันที่ ${date}

${LINE.single}
`;

  // แสดงผลรางวัลตามประเภทหวย
  if (data.first) {
    message += `
🏆 รางวัลที่ 1
   「 ${data.first} 」
`;
  }

  if (data.top3) {
    message += `
🎯 3 ตัวบน
   「 ${data.top3} 」
`;
  }

  if (data.top2) {
    message += `
🔸 2 ตัวบน
   「 ${data.top2} 」
`;
  }

  if (data.front3) {
    message += `
🔹 3 ตัวหน้า
   「 ${data.front3} 」
`;
  }

  if (data.back3) {
    message += `
🔹 3 ตัวหลัง
   「 ${data.back3} 」
`;
  }

  if (data.bottom2 || data.back2) {
    message += `
🎲 2 ตัวล่าง
   「 ${data.bottom2 || data.back2} 」
`;
  }

  if (data.runTop) {
    message += `
⬆️ วิ่งบน: ${data.runTop}
`;
  }

  if (data.runBottom) {
    message += `
⬇️ วิ่งล่าง: ${data.runBottom}
`;
  }

  // รางวัลเพิ่มเติม
  if (data.prizes && Object.keys(data.prizes).length > 0) {
    message += `\n${LINE.dotted}\n`;
    for (const [prizeName, prizeValue] of Object.entries(data.prizes)) {
      message += `${emoji.color} ${prizeName}: ${prizeValue}\n`;
    }
  }

  message += `
${LINE.double}

🍀 ขอให้โชคดีทุกท่าน 🍀
🌐 ${BRAND.website}
`;

  return message.trim();
}

/**
 * สร้างข้อความประกาศผลหวย - รูปแบบย่อ (สำหรับหลายงวด)
 */
export function createLotteryResultShort(data: LotteryResultData): string {
  const emoji = getLotteryEmoji(data.lotteryName);
  
  let result = '';
  if (data.top3) result += `3บน: ${data.top3}`;
  if (data.bottom2) result += ` | 2ล่าง: ${data.bottom2}`;
  if (data.top2) result += ` | 2บน: ${data.top2}`;
  
  return `${emoji.icon} ${data.lotteryName}: ${result}`;
}

// ========================
// TOPUP NOTIFICATION
// ========================

/**
 * สร้างข้อความแจ้งเติมเงินสำเร็จ
 */
export function createTopupNotifyMessage(data: TopupNotifyData): string {
  const time = getTimeString();
  const date = getDateString();
  
  return `
💰 ${BRAND.logo} ${BRAND.name} ${BRAND.logo} 💰
${LINE.double}

✅ เติมเงินสำเร็จ

👤 ผู้ใช้: ${data.username}
💵 จำนวน: ${formatCurrency(data.amount)} บาท
${data.method ? `📱 ช่องทาง: ${data.method}` : ''}
${data.balance ? `💳 ยอดคงเหลือ: ${formatCurrency(data.balance)} บาท` : ''}

${LINE.single}

⏰ เวลา: ${time} น.
📅 วันที่: ${date}
${data.transactionId ? `🔖 รหัส: ${data.transactionId}` : ''}

${LINE.double}
🌐 ${BRAND.website}
`.trim();
}

/**
 * สร้างข้อความแจ้งเติมเงิน - สำหรับ Admin
 */
export function createTopupNotifyAdmin(data: TopupNotifyData): string {
  const time = getTimeString();
  
  return `
🔔 แจ้งเตือนเติมเงิน

👤 ${data.username}
💵 +${formatCurrency(data.amount)} บาท
${data.method ? `📱 ${data.method}` : ''}
⏰ ${time}
${data.transactionId ? `#${data.transactionId}` : ''}
`.trim();
}

// ========================
// WITHDRAW NOTIFICATION
// ========================

const WITHDRAW_STATUS_TEXT: Record<string, { emoji: string; text: string }> = {
  pending: { emoji: '⏳', text: 'รอดำเนินการ' },
  approved: { emoji: '✅', text: 'อนุมัติแล้ว' },
  completed: { emoji: '✅', text: 'โอนเงินสำเร็จ' },
  rejected: { emoji: '❌', text: 'ไม่อนุมัติ' },
};

/**
 * สร้างข้อความแจ้งถอนเงิน
 */
export function createWithdrawNotifyMessage(data: WithdrawNotifyData): string {
  const time = getTimeString();
  const date = getDateString();
  const status = WITHDRAW_STATUS_TEXT[data.status] || WITHDRAW_STATUS_TEXT.pending;
  
  return `
🏦 ${BRAND.logo} ${BRAND.name} ${BRAND.logo} 🏦
${LINE.double}

${status.emoji} ${status.text}

👤 ผู้ใช้: ${data.username}
💵 จำนวน: ${formatCurrency(data.amount)} บาท
${data.bankName ? `🏦 ธนาคาร: ${data.bankName}` : ''}
${data.accountNumber ? `💳 เลขบัญชี: ${maskAccountNumber(data.accountNumber)}` : ''}

${LINE.single}

⏰ เวลา: ${time} น.
📅 วันที่: ${date}
${data.transactionId ? `🔖 รหัส: ${data.transactionId}` : ''}

${LINE.double}
🌐 ${BRAND.website}
`.trim();
}

function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return accountNumber;
  return 'XXX-X-' + accountNumber.slice(-4);
}

// ========================
// WIN NOTIFICATION
// ========================

/**
 * สร้างข้อความแจ้งถูกรางวัล
 */
export function createWinNotifyMessage(data: WinNotifyData): string {
  const emoji = getLotteryEmoji(data.lotteryName);
  const time = getTimeString();
  const date = data.resultDate || getDateString();
  
  return `
🎉🎊 ${BRAND.logo} ${BRAND.name} ${BRAND.logo} 🎊🎉
${LINE.star}

🏆 ยินดีด้วย! คุณถูกรางวัล! 🏆

${LINE.single}

👤 ผู้ใช้: ${data.username}
${emoji.icon} หวย: ${data.lotteryName}
🎯 เลขที่ถูก: 「 ${data.betNumber} 」
📋 ประเภท: ${data.betType}

${LINE.dotted}

💰 เงินเดิมพัน: ${formatCurrency(data.betAmount)} บาท
🎁 เงินรางวัล: ${formatCurrency(data.winAmount)} บาท

${LINE.single}

📅 งวดวันที่: ${date}
⏰ เวลา: ${time} น.

${LINE.star}
🍀 ขอให้โชคดีตลอดไป! 🍀
🌐 ${BRAND.website}
`.trim();
}

/**
 * สร้างข้อความแจ้งถูกรางวัล - สำหรับ Admin
 */
export function createWinNotifyAdmin(data: WinNotifyData): string {
  const emoji = getLotteryEmoji(data.lotteryName);
  
  return `
🎉 มีผู้ถูกรางวัล!

👤 ${data.username}
${emoji.icon} ${data.lotteryName}
🎯 ${data.betNumber} (${data.betType})
💰 ${formatCurrency(data.winAmount)} บาท
`.trim();
}

// ========================
// CUSTOM MESSAGE
// ========================

/**
 * สร้างข้อความแบบกำหนดเอง พร้อม Branding
 */
export function createCustomMessage(message: string, includeHeader = true): string {
  if (!includeHeader) {
    return message;
  }
  
  return `
${BRAND.logo} ${BRAND.name} ${BRAND.logo}
${LINE.single}

${message}

${LINE.single}
🌐 ${BRAND.website}
`.trim();
}

// ========================
// BROADCAST MESSAGES
// ========================

/**
 * สร้างข้อความประกาศทั่วไป
 */
export function createBroadcastMessage(
  title: string,
  content: string,
  type: 'info' | 'warning' | 'success' | 'promo' = 'info'
): string {
  const typeEmoji = {
    info: '📢',
    warning: '⚠️',
    success: '✅',
    promo: '🎁',
  };
  
  return `
${typeEmoji[type]} ${BRAND.logo} ${BRAND.name} ${BRAND.logo} ${typeEmoji[type]}
${LINE.double}

${typeEmoji[type]} ${title}

${LINE.single}

${content}

${LINE.double}
🌐 ${BRAND.website}
`.trim();
}

// ========================
// MULTIPLE RESULTS MESSAGE
// ========================

/**
 * สร้างข้อความประกาศผลหลายงวดพร้อมกัน
 */
export function createMultipleResultsMessage(results: LotteryResultData[]): string {
  const date = getDateString();
  const time = getTimeString();
  
  let message = `
${BRAND.logo} ${BRAND.name} ${BRAND.logo}
${LINE.double}

📊 สรุปผลหวยวันนี้
📅 ${date}
⏰ อัปเดต ${time} น.

${LINE.single}
`;

  for (const result of results) {
    message += `\n${createLotteryResultShort(result)}`;
  }

  message += `

${LINE.double}
🍀 ขอให้โชคดีทุกท่าน 🍀
🌐 ${BRAND.website}
`;

  return message.trim();
}

// ========================
// MESSAGE TYPE ENUM
// ========================

export type MessageType = 
  | 'lottery_result'
  | 'topup'
  | 'withdraw'
  | 'win'
  | 'custom'
  | 'broadcast';

// ========================
// UNIFIED MESSAGE CREATOR
// ========================

export interface CreateMessageOptions {
  type: MessageType;
  data: LotteryResultData | TopupNotifyData | WithdrawNotifyData | WinNotifyData | { message: string; title?: string };
}

export function createMessage(options: CreateMessageOptions): string {
  switch (options.type) {
    case 'lottery_result':
      return createLotteryResultMessage(options.data as LotteryResultData);
    case 'topup':
      return createTopupNotifyMessage(options.data as TopupNotifyData);
    case 'withdraw':
      return createWithdrawNotifyMessage(options.data as WithdrawNotifyData);
    case 'win':
      return createWinNotifyMessage(options.data as WinNotifyData);
    case 'custom':
      return createCustomMessage((options.data as { message: string }).message);
    case 'broadcast':
      const broadcastData = options.data as { title?: string; message: string };
      return createBroadcastMessage(broadcastData.title || 'ประกาศ', broadcastData.message);
    default:
      return createCustomMessage(JSON.stringify(options.data));
  }
}
