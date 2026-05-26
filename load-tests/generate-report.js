#!/usr/bin/env node

/**
 * Capacity Report Generator
 * Analyzes load test results and generates a comprehensive capacity report
 */

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, 'results');
const REPORT_FILE = path.join(RESULTS_DIR, 'CAPACITY_REPORT.md');

// Thresholds for recommendations
const THRESHOLDS = {
  responseTime: {
    excellent: 500,
    good: 1000,
    acceptable: 2000,
    poor: 3000,
  },
  errorRate: {
    excellent: 0.01,
    good: 0.02,
    acceptable: 0.05,
    poor: 0.10,
  },
};

function loadResults() {
  const results = {};
  
  if (!fs.existsSync(RESULTS_DIR)) {
    console.log('No results directory found. Run load tests first.');
    return results;
  }
  
  const files = fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    const name = file.replace('.json', '');
    try {
      const content = fs.readFileSync(path.join(RESULTS_DIR, file), 'utf8');
      results[name] = JSON.parse(content);
    } catch (err) {
      console.error(`Failed to load ${file}:`, err.message);
    }
  }
  
  return results;
}

function analyzeResult(data) {
  if (!data || !data.metrics) {
    return null;
  }
  
  const metrics = data.metrics;
  
  return {
    requests: {
      total: metrics.http_reqs?.values?.count || 0,
      rate: metrics.http_reqs?.values?.rate || 0,
    },
    responseTime: {
      avg: metrics.http_req_duration?.values?.avg || 0,
      p95: metrics.http_req_duration?.values?.['p(95)'] || 0,
      p99: metrics.http_req_duration?.values?.['p(99)'] || 0,
      max: metrics.http_req_duration?.values?.max || 0,
    },
    errors: {
      rate: metrics.http_req_failed?.values?.rate || 0,
      count: metrics.http_req_failed?.values?.passes || 0,
    },
    thresholds: data.thresholds || {},
    vus: data.root_group?.checks?.[0]?.passes || 0,
  };
}

function getRating(value, thresholds, inverse = false) {
  if (inverse) {
    if (value <= thresholds.excellent) return '🟢 Excellent';
    if (value <= thresholds.good) return '🟡 Good';
    if (value <= thresholds.acceptable) return '🟠 Acceptable';
    return '🔴 Poor';
  } else {
    if (value >= thresholds.excellent) return '🟢 Excellent';
    if (value >= thresholds.good) return '🟡 Good';
    if (value >= thresholds.acceptable) return '🟠 Acceptable';
    return '🔴 Poor';
  }
}

function estimateCapacity(results) {
  // Analyze full-system test if available
  const fullSystem = results['full-system'];
  if (!fullSystem) {
    return {
      safeUsers: 'N/A',
      maxTested: 'N/A',
      breakingPoint: 'N/A',
      recommendation: 'Run full-system test to get capacity estimates.',
    };
  }
  
  const analysis = analyzeResult(fullSystem);
  if (!analysis) {
    return {
      safeUsers: 'N/A',
      maxTested: 'N/A',
      breakingPoint: 'N/A',
      recommendation: 'Invalid test results.',
    };
  }
  
  // Estimate based on error rate and response times
  let safeUsers = 50;
  let maxTested = 0;
  
  // Check if thresholds passed
  const allPassed = Object.values(analysis.thresholds).every(t => t.ok);
  
  if (analysis.errors.rate < 0.02 && analysis.responseTime.p95 < 2000) {
    safeUsers = 100;
  }
  if (analysis.errors.rate < 0.05 && analysis.responseTime.p95 < 3000) {
    safeUsers = Math.max(safeUsers, 75);
  }
  
  // Estimate breaking point based on p99 response time
  if (analysis.responseTime.p99 > 5000) {
    maxTested = Math.floor(analysis.requests.rate * 0.8);
  } else {
    maxTested = Math.floor(analysis.requests.rate * 1.2);
  }
  
  return {
    safeUsers: safeUsers,
    maxTested: maxTested,
    breakingPoint: Math.floor(maxTested * 1.5),
    recommendation: allPassed 
      ? 'System performing within acceptable thresholds.'
      : 'Some thresholds exceeded - optimization needed before scaling.',
  };
}

function identifyBottlenecks(results) {
  const bottlenecks = [];
  
  for (const [name, data] of Object.entries(results)) {
    const analysis = analyzeResult(data);
    if (!analysis) continue;
    
    // Check for slow response times
    if (analysis.responseTime.p95 > 2000) {
      bottlenecks.push({
        category: 'Response Time',
        test: name,
        issue: `P95 response time is ${Math.round(analysis.responseTime.p95)}ms (>2000ms)`,
        severity: analysis.responseTime.p95 > 5000 ? 'HIGH' : 'MEDIUM',
      });
    }
    
    // Check for high error rates
    if (analysis.errors.rate > 0.05) {
      bottlenecks.push({
        category: 'Error Rate',
        test: name,
        issue: `Error rate is ${(analysis.errors.rate * 100).toFixed(2)}% (>5%)`,
        severity: analysis.errors.rate > 0.10 ? 'HIGH' : 'MEDIUM',
      });
    }
    
    // Check for failed thresholds
    for (const [threshold, result] of Object.entries(analysis.thresholds)) {
      if (!result.ok) {
        bottlenecks.push({
          category: 'Threshold',
          test: name,
          issue: `Failed threshold: ${threshold}`,
          severity: 'HIGH',
        });
      }
    }
  }
  
  return bottlenecks;
}

function generateReport(results) {
  const analyses = {};
  for (const [name, data] of Object.entries(results)) {
    analyses[name] = analyzeResult(data);
  }
  
  const capacity = estimateCapacity(results);
  const bottlenecks = identifyBottlenecks(results);
  
  const report = `# Capacity & Load Test Report

Generated: ${new Date().toISOString()}

## Executive Summary

### Capacity Estimates

| Metric | Value |
|--------|-------|
| Safe Concurrent Users | ${capacity.safeUsers} |
| Max Tested Users | ${capacity.maxTested} |
| Estimated Breaking Point | ${capacity.breakingPoint} |

**Recommendation:** ${capacity.recommendation}

---

## Test Results Summary

${Object.entries(analyses).filter(([_, a]) => a).map(([name, analysis]) => `
### ${name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}

| Metric | Value | Rating |
|--------|-------|--------|
| Total Requests | ${analysis.requests.total.toLocaleString()} | - |
| Request Rate | ${analysis.requests.rate.toFixed(2)}/s | - |
| Avg Response Time | ${Math.round(analysis.responseTime.avg)}ms | ${getRating(analysis.responseTime.avg, THRESHOLDS.responseTime, true)} |
| P95 Response Time | ${Math.round(analysis.responseTime.p95)}ms | ${getRating(analysis.responseTime.p95, THRESHOLDS.responseTime, true)} |
| P99 Response Time | ${Math.round(analysis.responseTime.p99)}ms | ${getRating(analysis.responseTime.p99, THRESHOLDS.responseTime, true)} |
| Max Response Time | ${Math.round(analysis.responseTime.max)}ms | - |
| Error Rate | ${(analysis.errors.rate * 100).toFixed(2)}% | ${getRating(analysis.errors.rate, THRESHOLDS.errorRate, true)} |
| Error Count | ${analysis.errors.count} | - |

**Threshold Results:**
${Object.entries(analysis.thresholds).map(([k, v]) => `- ${k}: ${v.ok ? '✅ PASS' : '❌ FAIL'}`).join('\n')}
`).join('\n')}

---

## Identified Bottlenecks

${bottlenecks.length === 0 ? 'No significant bottlenecks identified.' : `
| Severity | Category | Test | Issue |
|----------|----------|------|-------|
${bottlenecks.map(b => `| ${b.severity} | ${b.category} | ${b.test} | ${b.issue} |`).join('\n')}
`}

---

## Recommendations

### Immediate Actions (if bottlenecks found)

1. **Database Optimization**
   - Review slow queries in Supabase dashboard
   - Add missing indexes for frequently queried columns
   - Consider connection pooling settings

2. **API Optimization**
   - Enable response caching for read-heavy endpoints
   - Implement pagination for large datasets
   - Review N+1 query patterns

3. **Redis/Caching**
   - Verify Redis connection pooling
   - Review cache hit/miss ratios
   - Consider increasing cache TTLs

4. **Vercel Functions**
   - Monitor function cold starts
   - Review memory allocation
   - Consider Edge Functions for latency-sensitive endpoints

### Infrastructure Upgrades (for scaling)

| Component | Current | Recommended for 500+ users |
|-----------|---------|---------------------------|
| Supabase | Free/Pro | Pro with connection pooling |
| Redis (Upstash) | Free | Pay-as-you-go with higher limits |
| Vercel | Hobby/Pro | Pro with higher function limits |

### Database Indexes to Add

Based on common query patterns, consider adding indexes for:

\`\`\`sql
-- Entries table
CREATE INDEX IF NOT EXISTS idx_entries_lottery_created ON entries(lottery_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_user_status ON entries(user_id, status);

-- Bets table
CREATE INDEX IF NOT EXISTS idx_bets_user_lottery ON bets(user_id, lottery_id);
CREATE INDEX IF NOT EXISTS idx_bets_status_created ON bets(status, created_at DESC);

-- Transactions table
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON credit_transactions(user_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON credit_transactions(created_at DESC);

-- Agents table
CREATE INDEX IF NOT EXISTS idx_agents_parent ON agents(parent_agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
\`\`\`

---

## How to Run Tests

\`\`\`bash
# Install k6
brew install k6  # macOS

# Run individual tests
k6 run load-tests/scripts/public-pages.js
k6 run load-tests/scripts/auth-flow.js
k6 run load-tests/scripts/customer-dashboard.js
k6 run load-tests/scripts/betting-flow.js
k6 run load-tests/scripts/credit-transactions.js
k6 run load-tests/scripts/admin-dashboard.js
k6 run load-tests/scripts/agent-dashboard.js
k6 run load-tests/scripts/monitoring-apis.js

# Run full system test with different VU levels
k6 run -e MAX_VUS=50 load-tests/scripts/full-system.js
k6 run -e MAX_VUS=100 load-tests/scripts/full-system.js
k6 run -e MAX_VUS=250 load-tests/scripts/full-system.js
k6 run -e MAX_VUS=500 load-tests/scripts/full-system.js

# Generate this report
node load-tests/generate-report.js
\`\`\`

---

## Test Configuration

- Base URL: ${process.env.BASE_URL || 'http://localhost:3000'}
- Test Duration: 30s - 5min (staged)
- Thresholds: P95 < 2000ms, Error rate < 5%

`;

  return report;
}

// Main execution
const results = loadResults();

if (Object.keys(results).length === 0) {
  console.log(`
================================================================================
CAPACITY REPORT GENERATOR
================================================================================

No test results found in ${RESULTS_DIR}

To generate results, run the load tests:

  k6 run load-tests/scripts/public-pages.js
  k6 run load-tests/scripts/full-system.js
  
Then run this script again:

  node load-tests/generate-report.js

================================================================================
`);
} else {
  const report = generateReport(results);
  
  // Ensure results directory exists
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
  
  fs.writeFileSync(REPORT_FILE, report);
  console.log(`Report generated: ${REPORT_FILE}`);
  console.log('\n' + report);
}
