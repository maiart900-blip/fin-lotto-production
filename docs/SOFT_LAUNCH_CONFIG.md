# Soft Launch Configuration Guide

## ระยะเวลา Soft Launch: 7 วัน

### Current Global Controls Status

| Control | Status | Description |
|---------|--------|-------------|
| maintenance_mode | OFF | ระบบเปิดใช้งาน |
| betting_enabled | ON | รับแทงหวย |
| deposit_enabled | ON | รับฝากเงิน |
| withdraw_enabled | ON | รับถอนเงิน |
| registration_enabled | ON | รับสมัครสมาชิก |
| auto_payout_enabled | ON | จ่ายรางวัลอัตโนมัติ |

---

## Launch Limits (system_settings)

| Setting | Value | Description |
|---------|-------|-------------|
| max_payout_per_result | 100,000 | วงเงินจ่ายสูงสุดต่องวด |
| max_exposure_per_number | 10,000 | ความเสี่ยงสูงสุดต่อเลข |
| max_daily_payout | 500,000 | วงเงินจ่ายสูงสุดต่อวัน |
| settlement_confirmation_required | true | ต้องยืนยันก่อนจ่ายรางวัล |
| emergency_result_rollback | true | สามารถยกเลิกผลได้ |
| launch_mode | controlled | โหมด Soft Launch |

---

## Soft Launch Checklist

### Day 1: Initial Launch
- [ ] Enable maintenance_mode briefly for final checks
- [ ] Verify all global_controls are correct
- [ ] Test customer registration flow
- [ ] Test deposit flow with small amount
- [ ] Test betting flow with small amount
- [ ] Monitor error logs

### Day 2-3: Limited Users
- [ ] Invite 5-10 test customers
- [ ] Monitor payout calculations
- [ ] Verify credit balance updates
- [ ] Check agent commission calculations
- [ ] Review audit logs

### Day 4-5: Expand Testing
- [ ] Increase to 20-30 customers
- [ ] Test full lottery cycle (bet -> result -> payout)
- [ ] Verify ledger entries are correct
- [ ] Test withdrawal flow
- [ ] Check exposure limits

### Day 6-7: Pre-Production
- [ ] Review all financial transactions
- [ ] Verify no orphan entries created
- [ ] Test edge cases (max bets, blocked numbers)
- [ ] Prepare for full launch
- [ ] Document any issues found

---

## Emergency Procedures

### 1. Stop All Betting
```
UPDATE global_controls SET is_enabled = false WHERE control_key = 'betting_enabled';
```

### 2. Enable Maintenance Mode
```
UPDATE global_controls 
SET is_enabled = true, 
    control_value = '{"enabled": true, "message": "ระบบกำลังปรับปรุง"}'
WHERE control_key = 'maintenance_mode';
```

### 3. Stop Payouts
```
UPDATE global_controls SET is_enabled = false WHERE control_key = 'auto_payout_enabled';
```

### 4. Rollback Result (if needed)
```sql
-- Mark result as not processed
UPDATE lottery_results 
SET is_processed = false, 
    status = 'rolled_back',
    rolled_back_at = NOW(),
    rollback_reason = 'Emergency rollback'
WHERE id = '<result_id>';

-- Revert winning entries
UPDATE entries 
SET status = 'pending', 
    payout_amount = 0,
    payout_status = NULL
WHERE result_id = '<result_id>';
```

---

## Monitoring Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/health` | System health check |
| `/api/monitoring` | Real-time monitoring data |
| `/master-control` | Admin control panel |
| `/admin/monitoring` | Monitoring dashboard |

---

## Key Metrics to Monitor

1. **Financial**
   - Total daily deposits vs withdrawals
   - Payout accuracy (expected vs actual)
   - Credit balance consistency

2. **Operational**
   - Entry creation rate
   - Orphan entry count (should be 0)
   - Settlement processing time

3. **User Activity**
   - New registrations per day
   - Active customers per day
   - Bet volume per lottery

---

## Support Contacts

- **Technical Issues**: Check `/api/health` first
- **Financial Discrepancies**: Review ledger_entries table
- **Customer Complaints**: Check audit_logs for user actions

---

## Post-Launch Review (Day 8+)

After 7 days of soft launch:
1. Review all financial transactions
2. Analyze system performance metrics
3. Gather user feedback
4. Adjust limits if needed
5. Plan full production launch

---

*Document generated: 2024*
*System: FIN Lotto Production*
