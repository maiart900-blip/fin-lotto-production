# Identity Model - ระบบจัดการตัวตน

## Overview

ระบบแบ่งผู้ใช้ออกเป็น 3 กลุ่มหลัก:

```
┌─────────────────────────────────────────────────────────────────┐
│                          IDENTITY MODEL                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. CUSTOMERS (ลูกค้าแทงหวย)                                   │
│      ├─ Table: customers                                        │
│      ├─ Role: customer                                          │
│      └─ ไม่เกี่ยวข้องกับสายงาน                                  │
│                                                                 │
│   2. MEMBERS (พนักงาน/คนในทีม)                                  │
│      ├─ Table: customers (agent_level = 'member')              │
│      ├─ Role: member/staff                                      │
│      └─ ทำงานภายใต้ Agent                                       │
│                                                                 │
│   3. AGENTS (เอเย่นต์/เจ้าของสายงาน)                            │
│      ├─ Table: agents                                           │
│      ├─ Roles: agent, agent_key, sub_agent, key_staff          │
│      └─ เป็นเจ้าของหรือระดับในสายงาน                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 1. Customers (ลูกค้าแทงหวย)

**Table**: `customers`  
**Condition**: `agent_level IS NULL` (ลูกค้าทั่วไป)

```sql
-- ลูกค้าทั่วไป (regular customers)
SELECT * FROM customers WHERE agent_level IS NULL;

-- หมายเหตุ: agent_level = 'agent' คือเอเย่นใน customers table (ไม่ค่อยใช้)
```

**Database Default** (Fixed 2024):
```sql
-- agent_level defaults to NULL (regular customer)
-- New registrations automatically become regular customers
ALTER TABLE customers ALTER COLUMN agent_level SET DEFAULT NULL;
ALTER TABLE customers ALTER COLUMN user_type SET DEFAULT 'customer';
```

**หน้าที่**:
- แทงหวย
- ฝาก/ถอนเงิน
- ดูผลหวย
- ดูประวัติการแทง

**ไม่มี**:
- สิทธิ์จัดการระบบ
- สิทธิ์ดูข้อมูลผู้อื่น
- ไม่อยู่ในสายงาน Agent

## 2. Members (พนักงาน/คนในทีม)

**Table**: `customers`  
**Condition**: `agent_level = 'member'`

```sql
SELECT * FROM customers WHERE agent_level = 'member';
```

**หน้าที่**:
- คีย์หวยให้ลูกค้า
- ตรวจสอบฝาก/ถอน
- จัดการลูกค้า
- รับโพยลูกค้า

**สิทธิ์ที่ตั้งค่าได้**:
- `can_key_lottery` - คีย์หวยได้
- `can_approve_transactions` - อนุมัติธุรกรรมได้
- `visible_menus` - เมนูที่เห็นได้

**หน้าจัดการ**: `/member-visibility`

## 3. Agents (เอเย่นต์/เจ้าของสายงาน)

**Table**: `agents`  
**Roles**:
- `agent` - เอเย่นต์หลัก
- `agent_key` - เอเย่นต์คีย์
- `sub_agent` - เอเย่นต์ย่อย
- `key_staff` - พนักงานคีย์

```sql
SELECT * FROM agents;
```

**หน้าที่**:
- บริหารจัดการสายงาน
- ดูรายงานยอดขาย
- จัดการ Member (พนักงาน)
- ตั้งค่าอัตราจ่าย

**สิทธิ์ที่ตั้งค่าได้**:
- `can_create_sub_agent` - สร้างเอเย่นต์ย่อยได้
- `can_view_reports` - ดูรายงานได้
- `visible_menus` - เมนูที่เห็นได้

**หน้าจัดการ**: `/agent-visibility`

---

## Database Relationships

```
┌─────────────────┐
│     agents      │
├─────────────────┤
│ id              │
│ code            │
│ name            │
│ role            │ ─────▶ agent, agent_key, sub_agent, key_staff
│ parent_id       │ ─────▶ Hierarchy (upline agent)
│ visible_menus   │
│ can_create_sub_agent
│ can_view_reports
└────────┬────────┘
         │
         │ (owns/manages)
         ▼
┌─────────────────┐
│   customers     │
├─────────────────┤
│ id              │
│ username        │
│ name            │
│ agent_level     │ ─────▶ 'member' = พนักงาน, otherwise = ลูกค้า
│ agent_id        │ ─────▶ FK to agents (parent)
│ visible_menus   │
│ can_key_lottery │
│ can_approve_transactions
└─────────────────┘
```

---

## UI Pages

| Page | Purpose | Target |
|------|---------|--------|
| `/agent-visibility` | ตั้งค่าเมนู Agent | `agents` table |
| `/member-visibility` | ตั้งค่าเมนู Member (พนักงาน) | `customers` where `agent_level = 'member'` |

---

## API Endpoints

### For Agents
- `GET /api/agents` - List agents
- `GET /api/agents/:id` - Get agent details
- `GET /api/menu-permissions?target_id=X&target_type=agent` - Get agent permissions
- `POST /api/menu-permissions` - Save agent permissions

### For Members (Staff)
- `GET /api/customers?agent_level=member` - List members (staff)
- `GET /api/menu-permissions?target_id=X&target_type=member` - Get member permissions
- `POST /api/menu-permissions` - Save member permissions

### For Customers
- `GET /api/customers` - List all customers (excluding members)
- Customer visibility is limited - they can only see customer-facing menus

---

## Sidebar Menu Filtering

The sidebar (`app-sidebar.tsx`) filters menus based on user role:

```typescript
// For Agents: Show menus from visible_menus
if (isAgent && hasMenuRestrictions) {
  return section.items.some(item => isMenuVisible(item.href));
}

// For Members: Show memberVisible sections
if (isMember) {
  return section.memberVisible === true;
}

// For Admin/Super Admin: Show all except agentOnly
if (section.agentOnly && !isAgent) {
  return false;
}
```

---

## Login Flow

1. **Check `users` table** - Admin/Super Admin accounts
2. **Check `agents` table** - Agent accounts (by code/username)
3. **Check `customers` table** - Customer/Member accounts

```typescript
// Login determines identity:
if (userFromUsersTable) → Admin/Super Admin
if (agentFromAgentsTable) → Agent (load visible_menus from agents)
if (customerWithAgentLevelMember) → Member/Staff
if (customerWithoutAgentLevelMember) → Customer
```

---

## Summary

| Identity | Table | Condition | Manages |
|----------|-------|-----------|---------|
| **Customer** | customers | agent_level != 'member' | Self only |
| **Member** | customers | agent_level = 'member' | Tasks assigned by Agent |
| **Agent** | agents | All records | Network + Members |
| **Admin** | users | role = 'admin' | System + Agents |
| **Super Admin** | users | role = 'super_admin' | Everything |
