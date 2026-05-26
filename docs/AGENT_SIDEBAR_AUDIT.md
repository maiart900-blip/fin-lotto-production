# Agent Sidebar Audit Report

## Date: 2026-05-26

## Overview

This report documents the sidebar menu structure and visibility rules for agent users.

## Menu Section Visibility Matrix

| Section | Admin | Super Admin | Agent | Member | Staff |
|---------|-------|-------------|-------|--------|-------|
| ศูนย์ปฏิบัติการ | Yes | Yes | No* | Yes | Yes |
| ศูนย์แอดมิน | Yes | Yes | No | No | No |
| ลูกค้าแทงหวย | Yes | Yes | No | No | Yes |
| ธุรกรรมการเงิน | Yes | Yes | No | Yes | Yes |
| ประวัติการเดิมพัน | Yes | Yes | No | No | Yes |
| หวย | Yes | Yes | No | Yes | Yes |
| ระบบออโต้ | Yes | Yes | Via permissions | No | No |
| ระบบคีย์หวย | Yes | Yes | Via permissions | No | No |
| สายงานเอเย่นต์ | Yes | Yes | No | No | No |
| โปรโมชั่น | Yes | Yes | No | No | No |
| ศูนย์การตลาด | Yes | Yes | No | No | No |
| รายงาน | Yes | Yes | No | No | Yes |
| จัดการพนักงาน | Yes | Yes | No | No | No |
| ตั้งค่าเว็บ | Yes | Yes | No | No | No |
| ไลฟ์สด | Yes | Yes | No | No | No |
| Multi-Tenant | No | Yes | No | No | No |
| Super Admin | No | Yes | No | No | No |
| ความปลอดภัย | No | Yes | No | No | No |
| **Agent: ศูนย์การเงิน** | No | No | Yes | No | No |
| **Agent: ลูกค้าใต้สาย** | No | No | Yes | No | No |
| **Agent: คีย์หวย** | No | No | Yes* | No | No |

*Agent menus are filtered based on `enable_manual_key` and `enable_auto` flags.

## Agent-Specific Sections

### ศูนย์การเงิน (Agent Finance)
- ศูนย์การเงิน: /member/slip-upload
- สรุปรายได้: /member/summary
- ประวัติธุรกรรม: /member/finance

### ลูกค้าใต้สาย (Agent Downline)
- ลูกค้าใต้สาย: /agent-members
- คอมมิชชั่น: /agent/commission
- รายงานแพ้ชนะ: /agent-profit-loss
- ถอนคอมมิชชั่น: /agent-withdraw-history

### คีย์หวย (Agent Betting) - Conditional
Shown only when `enable_manual_key: true`:
- คีย์โพย: /agent-terminal/betting
- รายการโพย: /entries
- ผลหวย: /results

## Blocked Menus for Agents

The following menus are NEVER shown to agents:

### Super Admin Only
- /super-admin/*
- /master-control

### Platform Financial
- /financial-hub
- /multi-tenant/*
- /enterprise-summary
- /billion-dashboard
- /vip-dashboard

### System Management
- /tenant-manager
- /site-manager
- /sub-sites

### Security
- /security-dashboard
- /backup
- /health-check
- /audit-logs
- /users
- /roles-permissions

### Platform Settings
- /settings/system
- /master-rates
- /risk-control
- /payment-gateway
- /scb-maemanee

## Sidebar Filtering Logic

```typescript
// 1. Check platform-only menus (always blocked for agents)
if (isAgent && isPlatformOnlyMenu(href)) {
  return false;
}

// 2. Check manual key menus
if (isAgent && isManualKeyMenu(href) && !agentEnableManualKey) {
  return false;
}

// 3. Check auto system menus
if (isAgent && isAutoMenu(href) && !agentEnableAuto) {
  return false;
}

// 4. Check hidden menus
if (userHiddenMenus.includes(href)) {
  return false;
}

// 5. Check visible menus (if restrictions exist)
if (hasMenuRestrictions) {
  return userVisibleMenus.includes(href);
}

return true;
```

## Section Filtering Logic

```typescript
// For agents: show agentOnly sections + any section with allowed items
if (isAgent) {
  // Block sections where ALL items are platform-only
  if (allItemsPlatformOnly) return false;
  
  // Show agentOnly sections
  if (section.agentOnly === true) {
    return section.items.some(item => isMenuVisible(item.href));
  }
  
  // Show non-agentOnly sections only if they have allowed items
  return section.items.some(item => isMenuVisible(item.href));
}
```

## Test Cases

| Agent Config | Expected Menus |
|--------------|----------------|
| enable_manual_key: true, enable_auto: false | Agent finance, downline, คีย์หวย |
| enable_manual_key: false, enable_auto: true | Agent finance, downline, auto-system |
| enable_manual_key: true, enable_auto: true | All agent menus |
| tenant_mode: 'auto_only' | Auto menus only (even if enable_manual_key: true) |
| tenant_mode: 'manual_key_only' | Manual key menus only |

## Status

**VERIFIED** - Sidebar correctly filters menus based on agent permissions, tenant mode, and feature flags.
