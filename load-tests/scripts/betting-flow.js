/**
 * Load Test: Betting Flow
 * Tests lottery browsing and bet placement
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { BASE_URL, getOptions, getAdminHeaders, randomBetAmount, randomLotteryNumber } from '../config.js';

// Custom metrics
const betPlacementTime = new Trend('bet_placement_time');
const betSuccessRate = new Rate('bet_success_rate');
const lotteryLoadTime = new Trend('lottery_load_time');
const ratesLoadTime = new Trend('rates_load_time');

const LEVEL = __ENV.LEVEL || 'baseline';

export const options = {
  ...getOptions(LEVEL),
  tags: { category: 'betting' },
  thresholds: {
    'bet_placement_time': ['p(95)<3000'],
    'bet_success_rate': ['rate>0.7'], // At least 70% success
    'lottery_load_time': ['p(95)<1500'],
    'rates_load_time': ['p(95)<1000'],
  },
};

const headers = getAdminHeaders();

export default function() {
  group('Betting Flow', function() {
    // 1. Browse lotteries
    let startTime = Date.now();
    let res = http.get(`${BASE_URL}/api/lotteries`, {
      headers,
      tags: { name: 'lotteries_list' },
    });
    lotteryLoadTime.add(Date.now() - startTime);
    
    const lotteriesOk = check(res, {
      'lotteries load': (r) => r.status === 200,
    });
    
    if (!lotteriesOk) {
      return;
    }
    
    let lotteries = [];
    try {
      const body = JSON.parse(res.body);
      lotteries = body.data || body.lotteries || [];
    } catch {
      return;
    }
    
    if (lotteries.length === 0) {
      return;
    }
    
    sleep(0.5);
    
    // 2. Select a lottery and get rates
    const lottery = lotteries[Math.floor(Math.random() * lotteries.length)];
    const lotteryId = lottery.id;
    
    startTime = Date.now();
    res = http.get(`${BASE_URL}/api/lotteries/${lotteryId}`, {
      headers,
      tags: { name: 'lottery_detail' },
    });
    lotteryLoadTime.add(Date.now() - startTime);
    
    check(res, {
      'lottery detail loads': (r) => r.status === 200,
    });
    
    sleep(0.3);
    
    // 3. Get payout rates
    startTime = Date.now();
    res = http.get(`${BASE_URL}/api/payout-rates?lottery_id=${lotteryId}`, {
      headers,
      tags: { name: 'payout_rates' },
    });
    ratesLoadTime.add(Date.now() - startTime);
    
    check(res, {
      'rates load': (r) => r.status === 200,
    });
    
    sleep(0.5);
    
    // 4. Check blocked numbers
    res = http.get(`${BASE_URL}/api/blocked-numbers/check?lottery_id=${lotteryId}&number=${randomLotteryNumber(2)}`, {
      headers,
      tags: { name: 'blocked_check' },
    });
    
    check(res, {
      'blocked check returns': (r) => r.status === 200,
    });
    
    sleep(0.3);
    
    // 5. Place bet (simulated)
    const betPayload = {
      lottery_id: lotteryId,
      entries: [
        {
          bet_type: '2_top',
          number: randomLotteryNumber(2),
          amount: randomBetAmount(),
        },
        {
          bet_type: '2_bottom',
          number: randomLotteryNumber(2),
          amount: randomBetAmount(),
        },
      ],
    };
    
    startTime = Date.now();
    res = http.post(`${BASE_URL}/api/bets`, JSON.stringify(betPayload), {
      headers,
      tags: { name: 'place_bet' },
    });
    betPlacementTime.add(Date.now() - startTime);
    
    const betOk = check(res, {
      'bet placement returns': (r) => r.status === 200 || r.status === 201 || r.status === 400 || r.status === 401,
      'bet not server error': (r) => r.status < 500,
    });
    
    // Track success (200/201 = success, 400/401 = expected failure for test data)
    betSuccessRate.add(res.status === 200 || res.status === 201 ? 1 : 0);
    
    sleep(0.5);
    
    // 6. Check bet history
    res = http.get(`${BASE_URL}/api/bets?lottery_id=${lotteryId}&limit=5`, {
      headers,
      tags: { name: 'bet_history' },
    });
    
    check(res, {
      'bet history loads': (r) => r.status === 200 || r.status === 401,
    });
  });
  
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return {
    'load-tests/results/betting-flow.json': JSON.stringify(data, null, 2),
    stdout: generateSummary(data),
  };
}

function generateSummary(data) {
  const metrics = data.metrics;
  return `
================================================================================
BETTING FLOW LOAD TEST RESULTS
================================================================================
Test Level: ${LEVEL}
VUs: ${options.vus}

BET PLACEMENT:
  Success Rate: ${Math.round((metrics.bet_success_rate?.values?.rate || 0) * 100)}%
  Avg Time: ${Math.round(metrics.bet_placement_time?.values?.avg || 0)}ms
  P95 Time: ${Math.round(metrics.bet_placement_time?.values?.['p(95)'] || 0)}ms

LOTTERY LOADING:
  Avg Time: ${Math.round(metrics.lottery_load_time?.values?.avg || 0)}ms
  P95 Time: ${Math.round(metrics.lottery_load_time?.values?.['p(95)'] || 0)}ms

RATES LOADING:
  Avg Time: ${Math.round(metrics.rates_load_time?.values?.avg || 0)}ms
  P95 Time: ${Math.round(metrics.rates_load_time?.values?.['p(95)'] || 0)}ms

OVERALL:
  Total Requests: ${metrics.http_reqs?.values?.count || 0}
  Request Rate: ${Math.round(metrics.http_reqs?.values?.rate || 0)}/s
  Failed: ${metrics.http_req_failed?.values?.passes || 0}
================================================================================
`;
}
