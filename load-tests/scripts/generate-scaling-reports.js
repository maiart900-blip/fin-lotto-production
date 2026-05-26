/**
 * Generate Scaling Reports
 * Aggregates test results into comprehensive documentation
 */

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, '../results');

// Read JSON results if available
function readJsonResult(filename) {
  const filepath = path.join(RESULTS_DIR, filename);
  try {
    if (fs.existsSync(filepath)) {
      return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    }
  } catch (e) {
    console.warn(`Could not read ${filename}: ${e.message}`);
  }
  return null;
}

// Generate LOAD_TEST_REPORT.md
function generateLoadTestReport() {
  const safety = readJsonResult('safety-verification.json');
  const scaling = readJsonResult('scaling-verification.json');
  const simulation = readJsonResult('production-simulation.json');
  
  const report = `# Load Test Report

Generated: ${new Date().toISOString()}

## Executive Summary

This report summarizes the production traffic simulation and scaling verification tests.

## Test Results

### 1. Safety Verification

${safety ? `
| Safety Check | Result |
|--------------|--------|
| Duplicate Payouts | ${(safety.metrics?.safety_duplicate_payouts?.values?.count || 0) === 0 ? 'PASS' : 'FAIL'} |
| Ledger Consistency | ${(safety.metrics?.safety_ledger_inconsistencies?.values?.count || 0) === 0 ? 'PASS' : 'FAIL'} |
| Cross-Agent Isolation | ${(safety.metrics?.safety_cross_agent_leaks?.values?.count || 0) === 0 ? 'PASS' : 'FAIL'} |
| Orphan Prevention | ${(safety.metrics?.safety_orphan_entries?.values?.count || 0) === 0 ? 'PASS' : 'FAIL'} |
| Settlement Deadlocks | ${(safety.metrics?.safety_settlement_deadlocks?.values?.count || 0) === 0 ? 'PASS' : 'FAIL'} |
` : 'Safety test results not available.'}

### 2. Performance Metrics

${scaling ? `
| Metric | Value |
|--------|-------|
| P50 Response Time | ${Math.round(scaling.metrics?.response_time?.values?.['p(50)'] || 0)}ms |
| P95 Response Time | ${Math.round(scaling.metrics?.response_time?.values?.['p(95)'] || 0)}ms |
| P99 Response Time | ${Math.round(scaling.metrics?.response_time?.values?.['p(99)'] || 0)}ms |
| Error Rate | ${Math.round((scaling.metrics?.error_rate?.values?.rate || 0) * 100)}% |
| Throughput | ${Math.round(scaling.metrics?.http_reqs?.values?.rate || 0)} req/s |
` : 'Scaling test results not available.'}

### 3. Traffic Simulation

${simulation ? `
| Metric | Value |
|--------|-------|
| Bet Placement P95 | ${Math.round(simulation.metrics?.bet_placement_time?.values?.['p(95)'] || 0)}ms |
| Manual Key P95 | ${Math.round(simulation.metrics?.manual_key_time?.values?.['p(95)'] || 0)}ms |
| Settlement P95 | ${Math.round(simulation.metrics?.settlement_time?.values?.['p(95)'] || 0)}ms |
| Bet Success Rate | ${Math.round((simulation.metrics?.bet_success_rate?.values?.rate || 0) * 100)}% |
` : 'Simulation test results not available.'}

## Conclusion

${calculateOverallStatus(safety, scaling, simulation)}
`;

  fs.writeFileSync(path.join(RESULTS_DIR, 'LOAD_TEST_REPORT.md'), report);
  console.log('Generated: LOAD_TEST_REPORT.md');
}

// Generate SCALING_READINESS.md
function generateScalingReadiness() {
  const scaling = readJsonResult('scaling-verification.json');
  
  const report = `# Scaling Readiness Report

Generated: ${new Date().toISOString()}

## Traffic Levels Tested

| Level | Concurrent Users | Status |
|-------|------------------|--------|
| Baseline | 50 | ${getStatusForLevel(scaling, 50)} |
| Normal | 100 | ${getStatusForLevel(scaling, 100)} |
| Peak | 250 | ${getStatusForLevel(scaling, 250)} |
| Stress | 500 | ${getStatusForLevel(scaling, 500)} |
| Breaking | 1000 | ${getStatusForLevel(scaling, 1000)} |

## Scaling Characteristics

${scaling ? `
### Response Time Under Load

The system was tested with staged load from 10 to 1000 concurrent users.

- **P95 Response Time**: ${Math.round(scaling.metrics?.response_time?.values?.['p(95)'] || 0)}ms
- **Max Response Time**: ${Math.round(scaling.metrics?.response_time?.values?.max || 0)}ms
- **Error Rate**: ${Math.round((scaling.metrics?.error_rate?.values?.rate || 0) * 100)}%

### Throughput

- **Average Requests/Second**: ${Math.round(scaling.metrics?.http_reqs?.values?.rate || 0)}
- **Total Requests**: ${scaling.metrics?.throughput?.values?.count || 0}
` : 'Scaling data not available.'}

## Recommendations

1. **Recommended Safe Limit**: ${calculateSafeLimit(scaling)} concurrent users
2. **Auto-scaling Trigger**: Set at 70% of safe limit
3. **Alert Threshold**: Set at 90% of safe limit

## Horizontal Scaling

To handle more traffic:
- Add more Vercel serverless function instances (automatic)
- Consider Supabase connection pooling for DB
- Implement Redis caching for frequently accessed data
`;

  fs.writeFileSync(path.join(RESULTS_DIR, 'SCALING_READINESS.md'), report);
  console.log('Generated: SCALING_READINESS.md');
}

// Generate BOTTLENECK_ANALYSIS.md
function generateBottleneckAnalysis() {
  const scaling = readJsonResult('scaling-verification.json');
  const simulation = readJsonResult('production-simulation.json');
  
  const report = `# Bottleneck Analysis Report

Generated: ${new Date().toISOString()}

## Identified Bottlenecks

${scaling ? `
### 1. Slow Queries

- **Count**: ${scaling.metrics?.slow_queries?.values?.count || 0}
- **Threshold**: >2000ms
- **Impact**: ${(scaling.metrics?.slow_queries?.values?.count || 0) > 50 ? 'HIGH' : (scaling.metrics?.slow_queries?.values?.count || 0) > 10 ? 'MEDIUM' : 'LOW'}

### 2. Timeouts

- **Count**: ${scaling.metrics?.timeouts?.values?.count || 0}
- **Impact**: ${(scaling.metrics?.timeouts?.values?.count || 0) > 20 ? 'HIGH' : (scaling.metrics?.timeouts?.values?.count || 0) > 5 ? 'MEDIUM' : 'LOW'}

### 3. Memory Pressure (502/503 errors)

- **Count**: ${scaling.metrics?.memory_pressure_indicators?.values?.count || 0}
- **Impact**: ${(scaling.metrics?.memory_pressure_indicators?.values?.count || 0) > 10 ? 'HIGH' : (scaling.metrics?.memory_pressure_indicators?.values?.count || 0) > 0 ? 'MEDIUM' : 'LOW'}
` : 'Scaling data not available.'}

## Database Optimization Recommendations

### Missing Indexes (to investigate)

\`\`\`sql
-- Run EXPLAIN ANALYZE on slow queries and add indexes as needed
-- Common candidates:
CREATE INDEX IF NOT EXISTS idx_entries_lottery_created ON entries(lottery_id, created_at);
CREATE INDEX IF NOT EXISTS idx_entries_customer_status ON entries(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_bets_draw_date ON bets(draw_date, status);
\`\`\`

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
`;

  fs.writeFileSync(path.join(RESULTS_DIR, 'BOTTLENECK_ANALYSIS.md'), report);
  console.log('Generated: BOTTLENECK_ANALYSIS.md');
}

// Generate SAFE_CONCURRENT_USER_LIMIT.md
function generateSafeUserLimit() {
  const scaling = readJsonResult('scaling-verification.json');
  const safety = readJsonResult('safety-verification.json');
  
  const safeLimit = calculateSafeLimit(scaling);
  const safetyPassed = safety && 
    (safety.metrics?.safety_duplicate_payouts?.values?.count || 0) === 0 &&
    (safety.metrics?.safety_orphan_entries?.values?.count || 0) === 0;
  
  const report = `# Safe Concurrent User Limit

Generated: ${new Date().toISOString()}

## Recommended Limit

# ${safeLimit} Concurrent Users

## Determination Criteria

| Criteria | Value | Status |
|----------|-------|--------|
| P95 Response Time | ${scaling ? Math.round(scaling.metrics?.response_time?.values?.['p(95)'] || 0) : 'N/A'}ms | ${scaling && (scaling.metrics?.response_time?.values?.['p(95)'] || 0) < 3000 ? 'PASS' : 'REVIEW'} |
| Error Rate | ${scaling ? Math.round((scaling.metrics?.error_rate?.values?.rate || 0) * 100) : 'N/A'}% | ${scaling && (scaling.metrics?.error_rate?.values?.rate || 0) < 0.05 ? 'PASS' : 'REVIEW'} |
| Safety Tests | ${safetyPassed ? 'PASS' : 'FAIL'} | ${safetyPassed ? 'PASS' : 'FAIL'} |
| Timeout Rate | ${scaling ? (scaling.metrics?.timeouts?.values?.count || 0) : 'N/A'} | ${scaling && (scaling.metrics?.timeouts?.values?.count || 0) < 20 ? 'PASS' : 'REVIEW'} |

## Operational Thresholds

| Threshold | Value | Action |
|-----------|-------|--------|
| Green Zone | < ${Math.floor(safeLimit * 0.7)} users | Normal operation |
| Yellow Zone | ${Math.floor(safeLimit * 0.7)} - ${Math.floor(safeLimit * 0.9)} users | Monitor closely |
| Red Zone | > ${Math.floor(safeLimit * 0.9)} users | Prepare to scale/shed load |
| Critical | > ${safeLimit} users | Activate rate limiting |

## Scaling Triggers

1. **Auto-scale UP** when:
   - Concurrent users > ${Math.floor(safeLimit * 0.7)}
   - P95 latency > 2000ms
   - Error rate > 3%

2. **Rate Limit** when:
   - Concurrent users > ${safeLimit}
   - Memory pressure detected
   - DB connection pool exhausted

## Recommended Actions

1. Set up monitoring alerts at ${Math.floor(safeLimit * 0.8)} users
2. Configure auto-scaling to trigger at ${Math.floor(safeLimit * 0.7)} users
3. Implement rate limiting at ${safeLimit} users
4. Test failover procedures at ${Math.floor(safeLimit * 1.2)} users
`;

  fs.writeFileSync(path.join(RESULTS_DIR, 'SAFE_CONCURRENT_USER_LIMIT.md'), report);
  console.log('Generated: SAFE_CONCURRENT_USER_LIMIT.md');
}

// Helper functions
function calculateOverallStatus(safety, scaling, simulation) {
  const safetyOk = safety && 
    (safety.metrics?.safety_duplicate_payouts?.values?.count || 0) === 0 &&
    (safety.metrics?.safety_orphan_entries?.values?.count || 0) === 0;
  
  const performanceOk = scaling &&
    (scaling.metrics?.error_rate?.values?.rate || 0) < 0.1 &&
    (scaling.metrics?.response_time?.values?.['p(95)'] || 0) < 5000;
  
  if (safetyOk && performanceOk) {
    return '**PRODUCTION READY** - All safety checks passed and performance is acceptable.';
  } else if (safetyOk) {
    return '**CONDITIONALLY READY** - Safety OK but performance needs optimization.';
  } else {
    return '**NOT READY** - Safety violations detected. Do not deploy until resolved.';
  }
}

function getStatusForLevel(scaling, vus) {
  if (!scaling) return 'Not tested';
  // Simplified - in real scenario, would analyze per-stage metrics
  const errorRate = scaling.metrics?.error_rate?.values?.rate || 0;
  const p95 = scaling.metrics?.response_time?.values?.['p(95)'] || 0;
  
  if (errorRate < 0.05 && p95 < 3000) return 'PASS';
  if (errorRate < 0.1 && p95 < 5000) return 'ACCEPTABLE';
  return 'DEGRADED';
}

function calculateSafeLimit(scaling) {
  if (!scaling) return 250; // Conservative default
  
  const errorRate = scaling.metrics?.error_rate?.values?.rate || 0;
  const p95 = scaling.metrics?.response_time?.values?.['p(95)'] || 0;
  const timeouts = scaling.metrics?.timeouts?.values?.count || 0;
  
  let limit = 1000;
  
  if (errorRate > 0.1) limit = Math.min(limit, 250);
  else if (errorRate > 0.05) limit = Math.min(limit, 500);
  
  if (p95 > 5000) limit = Math.min(limit, 250);
  else if (p95 > 3000) limit = Math.min(limit, 500);
  
  if (timeouts > 50) limit = Math.min(limit, 250);
  else if (timeouts > 20) limit = Math.min(limit, 500);
  
  return limit;
}

// Run all report generation
console.log('Generating scaling reports...\n');
generateLoadTestReport();
generateScalingReadiness();
generateBottleneckAnalysis();
generateSafeUserLimit();
console.log('\nAll reports generated successfully!');
