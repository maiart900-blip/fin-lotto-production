// Shared multi-product types & registry
// ระบบรองรับหลาย product โดยใช้ product_type เป็น discriminator เดียวกันทั้ง
// entries, transactions และ agent_settlements. ระบบหวย (lottery) เป็นตัวเดียวที่
// เปิดใช้งานจริง ส่วน casino/sports/game เป็น coming_soon (โครงพร้อม ต่อ provider ภายหลัง)

export type ProductType = 'lottery' | 'casino' | 'sports' | 'game';

export type ProductStatus = 'active' | 'coming_soon';

export interface ProductDefinition {
  /** discriminator ที่บันทึกลง DB (ตรงกับ CHECK constraint) */
  type: ProductType;
  /** ชื่อแสดงผล (ไทย) */
  label: string;
  /** คำอธิบายสั้น */
  description: string;
  /** สถานะการเปิดใช้งาน */
  status: ProductStatus;
  /** ชื่อ icon จาก lucide-react */
  icon: string;
  /** สีธีมประจำ product (ใช้กับ badge/หัวการ์ด) */
  accent: string;
}

/**
 * ทะเบียนสินค้ากลาง — เป็นแหล่งความจริงเดียว (single source of truth)
 * ทุกหน้า/สรุปยอด/ตัวกรอง ควรอ่านจากที่นี่ เพื่อไม่ให้ต้อง hardcode รายการ product ซ้ำ
 */
export const PRODUCTS: Record<ProductType, ProductDefinition> = {
  lottery: {
    type: 'lottery',
    label: 'หวย',
    description: 'ระบบแทงหวยออนไลน์ (ทำงาน 100%)',
    status: 'active',
    icon: 'Ticket',
    accent: 'var(--color-primary)',
  },
  casino: {
    type: 'casino',
    label: 'คาสิโน',
    description: 'บาคาร่า/รูเล็ต/สล็อตสด (เร็วๆ นี้)',
    status: 'coming_soon',
    icon: 'Spade',
    accent: 'var(--color-chart-2)',
  },
  sports: {
    type: 'sports',
    label: 'กีฬา',
    description: 'แทงบอล/กีฬาออนไลน์ (เร็วๆ นี้)',
    status: 'coming_soon',
    icon: 'Trophy',
    accent: 'var(--color-chart-3)',
  },
  game: {
    type: 'game',
    label: 'เกม',
    description: 'เกมทำเงิน/มินิเกม (เร็วๆ นี้)',
    status: 'coming_soon',
    icon: 'Gamepad2',
    accent: 'var(--color-chart-4)',
  },
};

/** ลำดับ product ที่ใช้แสดงผลอย่างสม่ำเสมอทั้งระบบ */
export const PRODUCT_ORDER: ProductType[] = ['lottery', 'casino', 'sports', 'game'];

/** รายการ product ที่เปิดใช้งานจริง */
export const ACTIVE_PRODUCTS: ProductType[] = PRODUCT_ORDER.filter(
  (t) => PRODUCTS[t].status === 'active',
);

/** ค่า default ของทั้งระบบ (ระบบหวยเดิม) */
export const DEFAULT_PRODUCT: ProductType = 'lottery';

/** ตรวจว่า string ที่รับเข้ามาเป็น ProductType ที่ถูกต้องหรือไม่ */
export function isProductType(value: unknown): value is ProductType {
  return typeof value === 'string' && value in PRODUCTS;
}

/** ตรวจว่า product เปิดใช้งานอยู่ไหม (ใช้ guard flow การแทง) */
export function isProductActive(type: ProductType): boolean {
  return PRODUCTS[type]?.status === 'active';
}

/**
 * normalize ค่า product_type ที่มาจาก DB/รีเควสต์ ให้ปลอดภัยเสมอ
 * ถ้าไม่ระบุ/ไม่รู้จัก → คืน default (lottery) เพื่อความเข้ากันได้ย้อนหลัง
 */
export function normalizeProductType(value: unknown): ProductType {
  return isProductType(value) ? value : DEFAULT_PRODUCT;
}
