# Package and Subscription Management System

> Last Updated: 2026-05-26

## Overview

ระบบจัดการแพ็คเกจและ Subscription แบบครบวงจรสำหรับ Multi-Tenant SaaS Platform

## Database Tables

### Core Tables

| Table | Purpose |
|-------|---------|
| `packages` | แพ็คเกจหลัก (Starter, Basic, Pro, Enterprise, Unlimited) |
| `package_features` | ฟีเจอร์ที่สามารถเปิด/ปิดได้ |
| `package_feature_grants` | การ mapping แพ็คเกจ-ฟีเจอร์ |
| `package_addons` | Add-on ที่ซื้อเพิ่มได้ |

### Subscription Tables

| Table | Purpose |
|-------|---------|
| `tenant_subscriptions` | Subscription ของ Tenant |
| `tenant_feature_flags` | Feature override ระดับ Tenant |
| `tenant_addons` | Add-on ที่ Tenant ซื้อ |

### Tracking Tables

| Table | Purpose |
|-------|---------|
| `subscription_usage_records` | บันทึกการใช้งานสำหรับ billing |
| `subscription_change_requests` | คำขอ upgrade/downgrade |
| `trial_extensions` | ประวัติการต่อ trial |

## Default Packages

| Package | Price/mo | Customers | Agents | Daily Bets |
|---------|----------|-----------|--------|------------|
| Starter | ฟรี | 50 | 3 | 200 |
| Basic | ฿2,900 | 100 | 5 | 500 |
| Pro | ฿5,900 | 500 | 20 | 2,000 |
| Enterprise | ฿9,900 | 2,000 | 100 | 10,000 |
| Unlimited | ฿19,900 | ไม่จำกัด | ไม่จำกัด | ไม่จำกัด |

## API Endpoints

### Packages API

```
GET /api/packages
  ?includePrivate=true - รวมแพ็คเกจ private
  ?includeFeatures=true - รวม features
  ?includeAddons=true - รวม addons

POST /api/packages - สร้างแพ็คเกจใหม่ (Super Admin)
PUT /api/packages - อัพเดทแพ็คเกจ
DELETE /api/packages?id={id} - ปิดใช้งานแพ็คเกจ
```

### Subscriptions API

```
GET /api/subscriptions?tenantId={id}
  Returns: subscription, usage stats, days left

POST /api/subscriptions
  action: create | upgrade | downgrade | cancel | reactivate | extend_trial | convert_trial
```

### Features API

```
GET /api/features
  ?tenantId={id}&feature={code} - เช็คฟีเจอร์เดียว
  ?tenantId={id}&features={codes} - เช็คหลายฟีเจอร์
  ?tenantId={id}&checkLimit={type} - เช็คลิมิต
  ?tenantId={id}&canAddMore={type}&amount={n} - เช็คเพิ่มได้ไหม

POST /api/features
  action: grant | revoke | remove_override
```

## Library Usage

### Check Feature Access

```typescript
import { hasFeature, checkFeature } from '@/lib/packages'

// Simple check
const canUseAPI = await hasFeature(tenantId, 'api_access')

// Detailed check
const result = await checkFeature(tenantId, 'advanced_reports')
// { enabled: true, source: 'package', value: true }
```

### Check Limits

```typescript
import { checkLimit, canAddMore } from '@/lib/packages/feature-flags'

// Check current usage
const usage = await checkLimit(tenantId, 'customers')
// { limit: 100, current: 45, remaining: 55, percentUsed: 45 }

// Check if can add
const check = await canAddMore(tenantId, 'agents', 5)
// { allowed: true } or { allowed: false, reason: 'Limit reached...' }
```

### Subscription Management

```typescript
import { 
  createSubscription, 
  upgradeSubscription,
  extendTrial 
} from '@/lib/packages'

// Create with trial
await createSubscription(tenantId, packageId, {
  billingCycle: 'monthly',
  trialDays: 14
})

// Upgrade immediately
await upgradeSubscription(tenantId, newPackageId, {
  immediate: true,
  proration: true
})

// Extend trial
await extendTrial(tenantId, 7, 'Customer request', adminId)
```

## Feature Priority

เมื่อเช็คฟีเจอร์ ระบบจะเช็คตามลำดับ:

1. **Tenant Override** - ถ้ามี override จะใช้ค่านี้
2. **Package Features** - ฟีเจอร์ที่รวมในแพ็คเกจ
3. **Addons** - ฟีเจอร์จาก addon ที่ซื้อเพิ่ม
4. **Default** - ปิดโดย default

## Subscription Statuses

| Status | Description |
|--------|-------------|
| `trial` | ทดลองใช้ |
| `active` | ใช้งานปกติ |
| `past_due` | ค้างชำระ |
| `suspended` | ถูกระงับ |
| `cancelled` | ยกเลิกแล้ว |
| `expired` | หมดอายุ |

## Files Created

```
lib/packages/
├── index.ts
├── package-manager.ts
├── subscription-manager.ts
└── feature-flags.ts

app/api/
├── packages/route.ts
├── subscriptions/route.ts
└── features/route.ts
```
