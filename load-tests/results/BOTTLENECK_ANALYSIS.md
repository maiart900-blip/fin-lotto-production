# Bottleneck Analysis Report

Generated: 2026-05-26T03:52:32.865Z

## Identified Bottlenecks

Scaling data not available.

## Database Optimization Recommendations

### Missing Indexes (to investigate)

```sql
-- Run EXPLAIN ANALYZE on slow queries and add indexes as needed
-- Common candidates:
CREATE INDEX IF NOT EXISTS idx_entries_lottery_created ON entries(lottery_id, created_at);
CREATE INDEX IF NOT EXISTS idx_entries_customer_status ON entries(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_bets_draw_date ON bets(draw_date, status);
```

### Connection Pooling

Consider using Supabase's built-in connection pooling:
- Transaction mode for short queries
- Session mode for long-running operations

## API Optimization Recommendations

1. **Caching**: Implement Redis caching for:
   - Lottery data (changes infrequently)
   - Payout rates (changes infrequently)
   - Blocked numbers (per lottery/date)

2. **Pagination**: Ensure all list endpoints have proper pagination

3. **Query Optimization**: Review queries returning >100 rows

## Queue Optimization

If payout queue lag is detected:
1. Increase worker concurrency
2. Implement batch processing for settlements
3. Consider async payout processing
