# Enterprise Revenue Share & Master Settlement Center

## Overview

Complete enterprise-grade revenue distribution and settlement system supporting multi-tier revenue sharing, automated settlement cycles, and real-time tracking.

## Database Tables

### Revenue Share Configuration
| Table | Purpose |
|-------|---------|
| `revenue_share_configs` | Per-tenant/provider/game-type revenue share rules |
| `hierarchy_share_configs` | Multi-level hierarchy distribution (member→agent→tenant→platform) |

### Settlement Management
| Table | Purpose |
|-------|---------|
| `settlement_cycles` | Daily/weekly/monthly settlement cycles |
| `settlement_transactions` | Individual transactions within cycles |
| `revenue_adjustments` | Bonuses, penalties, corrections |

### Revenue Reporting
| Table | Purpose |
|-------|---------|
| `tenant_revenue_reports` | Per-tenant daily/weekly/monthly revenue breakdown |
| `provider_revenue_reports` | Per-provider revenue and commission tracking |
| `owner_profit_reports` | Platform-wide profit reports |
| `live_revenue_tracking` | Real-time hourly revenue tracking |

## Default Revenue Share Rates

| Game Type | Tenant Share | Platform Share | Provider Share |
|-----------|--------------|----------------|----------------|
| Lottery | 85% | 15% | 0% |
| Casino | 75% | 25% | 0% |
| Slots | 70% | 20% | 10% |
| Sports | 80% | 20% | 0% |
| Default | 80% | 20% | 0% |

## API Endpoints

### GET /api/settlement

| Action | Parameters | Description |
|--------|------------|-------------|
| `cycles` | status, cycleType, startDate, endDate, limit | Get settlement cycles |
| `cycle` | cycleId | Get specific cycle details |
| `transactions` | cycleId | Get transactions for a cycle |
| `owner-reports` | reportType, startDate, endDate, limit | Get platform profit reports |
| `tenant-reports` | tenantId, startDate, endDate, limit | Get tenant revenue reports |
| `revenue-configs` | - | Get all active revenue share configs |
| `live-revenue` | tenantId, date | Get real-time revenue for tenant |
| `pending-adjustments` | - | Get pending revenue adjustments |

### POST /api/settlement

| Action | Parameters | Description |
|--------|------------|-------------|
| `process-daily` | date (optional) | Process daily settlement for all tenants |
| `approve-cycle` | cycleId | Approve a settlement cycle |
| `create-adjustment` | tenantId, adjustmentType, amount, isCredit, reason | Create revenue adjustment |
| `approve-adjustment` | adjustmentId | Approve an adjustment |
| `generate-tenant-report` | tenantId, date, reportType | Generate tenant revenue report |
| `set-revenue-share` | tenantId, gameType, tenantSharePercent, platformSharePercent | Set tenant-specific revenue share |
| `update-live-revenue` | tenantId, turnover, wins, profit, bets | Update real-time revenue |

## Libraries

### RevenueShareEngine (`lib/revenue/revenue-share-engine.ts`)

```typescript
import { RevenueShareEngine } from '@/lib/revenue'

// Get applicable config for a tenant
const config = await RevenueShareEngine.getApplicableConfig(tenantId, 'lottery')

// Calculate revenue distribution
const calc = await RevenueShareEngine.calculateRevenue(tenantId, grossProfit, 'lottery')
// Returns: { tenant_share, platform_share, provider_share, ... }

// Set tenant-specific rate
await RevenueShareEngine.setTenantRevenueShare(
  tenantId, 
  'lottery', 
  90,  // tenant gets 90%
  10,  // platform gets 10%
  0    // no provider share
)

// Update live tracking
await RevenueShareEngine.updateLiveTracking(tenantId, turnover, wins, profit, bets)

// Get live revenue
const { hourly, daily } = await RevenueShareEngine.getLiveRevenue(tenantId)
```

### MasterSettlementCenter (`lib/revenue/master-settlement-center.ts`)

```typescript
import { MasterSettlementCenter } from '@/lib/revenue'

// Process daily settlement
const cycle = await MasterSettlementCenter.processDailySettlement(new Date())

// Approve cycle
await MasterSettlementCenter.approveCycle(cycleId, approvedBy)

// Generate reports
await MasterSettlementCenter.generateTenantRevenueReport(tenantId, date, 'daily')
await MasterSettlementCenter.generateOwnerProfitReport(date, 'daily')

// Create adjustment
await MasterSettlementCenter.createAdjustment({
  tenantId,
  adjustmentType: 'bonus',
  amount: 1000,
  isCredit: true,
  reason: 'Promotional bonus'
})
```

## Settlement Cycle Flow

1. **Create Cycle** - Automatically generated for period
2. **Processing** - Calculates revenue for all tenants
3. **Transactions Created** - Individual share transactions recorded
4. **Reports Generated** - Tenant and owner reports created
5. **Approval** - Admin approves the cycle
6. **Completed** - Transactions marked as approved

## Revenue Calculation Priority

1. Tenant-specific config (highest priority)
2. Provider-specific config
3. Game-type specific global config
4. Default global config (lowest priority)

## Hierarchy Share Distribution

Default distribution chain:
- Member → Agent: 50%
- Agent → Master Agent: 30%
- Master Agent → Tenant: 15%
- Tenant → Platform: 5%

## Real-Time Tracking

The `live_revenue_tracking` table tracks:
- Hourly turnover, wins, profit, bets
- Running daily totals
- Real-time platform share calculation
- Current and max exposure

Updated via `RevenueShareEngine.updateLiveTracking()` on each bet/entry.
