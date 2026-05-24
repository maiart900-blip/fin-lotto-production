export type BetType = 
  | '3top'    // 3 ตัวบน
  | '3tod'    // 3 ตัวโต๊ด
  | '3flip'   // 3 ตัวกลับ
  | '2top'    // 2 ตัวบน
  | '2bot'    // 2 ตัวล่าง
  | '2flip'   // 2 ตัวกลับ
  | '1top'    // วิ่งบน
  | '1bot'    // วิ่งล่าง
  | 'win2'    // วิน 2 ตัว
  | 'win3';   // วิน 3 ตัว

export const BET_TYPE_LABELS: Record<BetType, string> = {
  '3top': '3 ตัวบน',
  '3tod': '3 ตัวโต๊ด',
  '3flip': '3 ตัวกลับ',
  '2top': '2 ตัวบน',
  '2bot': '2 ตัวล่าง',
  '2flip': '2 ตัวกลับ',
  '1top': 'วิ่งบน',
  '1bot': 'วิ่งล่าง',
  'win2': 'วิน 2 ตัว',
  'win3': 'วิน 3 ตัว',
};

export const BET_TYPE_COLORS: Record<BetType, string> = {
  '3top': 'bg-red-600',
  '3tod': 'bg-orange-500',
  '3flip': 'bg-pink-500',
  '2top': 'bg-amber-500',
  '2bot': 'bg-yellow-500',
  '2flip': 'bg-lime-500',
  '1top': 'bg-emerald-500',
  '1bot': 'bg-teal-500',
  'win2': 'bg-purple-500',
  'win3': 'bg-violet-500',
};

export interface Customer {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
}

export interface LotteryEntry {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  number: string;
  betType: BetType;
  amount: number;
  note: string;
  createdAt: string;
}

export interface AppSettings {
  siteName: string;
  userName: string;
}

export type UserRole = 'super_admin' | 'admin' | 'agent' | 'partner' | 'staff' | 'member';

export interface User {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
  is_unlimited_credit?: boolean;
  credit_balance?: number;
  parent_id?: string;
  hierarchy_level?: number;
  createdAt: string;
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'ผู้ดูแลระบบ',
  agent: 'เอเย่นต์',
  partner: 'หุ้นส่วน',
  staff: 'พนักงาน',
  member: 'สมาชิก',
};

export interface NumberSummary {
  number: string;
  betType: BetType;
  totalAmount: number;
  count: number;
}

export interface DailySummary {
  date: string;
  totalAmount: number;
  count: number;
}
