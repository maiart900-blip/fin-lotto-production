/**
 * AI Analytics System for FIN LOTTO R+
 * ระบบวิเคราะห์ล่วงหน้า - Predictive Risk & Churn Prediction
 */

import { createClient } from '@/lib/supabase/server';
import { redis } from '@/lib/redis';

// =============================================
// TYPES
// =============================================

export interface PredictedNumber {
  number: string;
  predictedVolume: number;
  confidence: number;
  historicalAvg: number;
  trend: 'rising' | 'falling' | 'stable';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  suggestedLimit: number;
  reasons: string[];
}

export interface ChurnRisk {
  customerId: string;
  customerName: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastActivity: string;
  daysSinceLastBet: number;
  totalLifetimeValue: number;
  suggestedAction: string;
  factors: ChurnFactor[];
}

export interface ChurnFactor {
  factor: string;
  weight: number;
  description: string;
}

export interface AgentChurnRisk {
  agentId: string;
  agentName: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  monthlyVolumeChange: number;
  activeCustomersChange: number;
  suggestedAction: string;
}

export interface AnalyticsSummary {
  predictedHotNumbers: PredictedNumber[];
  churnRiskCustomers: ChurnRisk[];
  churnRiskAgents: AgentChurnRisk[];
  totalAtRiskValue: number;
  recommendations: string[];
}

// =============================================
// PREDICTIVE RISK ANALYSIS
// =============================================

/**
 * วิเคราะห์เลขที่คาดว่าจะมีคนแทงเยอะในงวดถัดไป
 */
export async function predictHotNumbers(
  lotteryId: string,
  topN: number = 20
): Promise<PredictedNumber[]> {
  const supabase = await createClient();
  const predictions: PredictedNumber[] = [];

  try {
    // 1. Get historical betting data (last 10 rounds)
    const { data: historicalData } = await supabase
      .from('bet_logs')
      .select('number, amount, created_at')
      .eq('lottery_id', lotteryId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (!historicalData || historicalData.length === 0) {
      return [];
    }

    // 2. Aggregate by number
    const numberStats: Record<string, {
      totalAmount: number;
      count: number;
      recentAmount: number;
      recentCount: number;
      amounts: number[];
    }> = {};

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    historicalData.forEach((bet: any) => {
      const num = bet.number;
      if (!numberStats[num]) {
        numberStats[num] = {
          totalAmount: 0,
          count: 0,
          recentAmount: 0,
          recentCount: 0,
          amounts: [],
        };
      }

      numberStats[num].totalAmount += bet.amount;
      numberStats[num].count++;
      numberStats[num].amounts.push(bet.amount);

      if (new Date(bet.created_at).getTime() > oneWeekAgo) {
        numberStats[num].recentAmount += bet.amount;
        numberStats[num].recentCount++;
      }
    });

    // 3. Calculate predictions
    const roundCount = 10; // Assume 10 rounds in 30 days
    
    for (const [number, stats] of Object.entries(numberStats)) {
      const historicalAvg = stats.totalAmount / roundCount;
      const recentAvg = stats.recentAmount / Math.max(stats.recentCount, 1) * 3; // Estimate for recent week
      
      // Trend calculation
      const trend = recentAvg > historicalAvg * 1.2 ? 'rising' 
                   : recentAvg < historicalAvg * 0.8 ? 'falling' 
                   : 'stable';

      // Predict next round volume (weighted recent + historical)
      const predictedVolume = Math.round(recentAvg * 0.6 + historicalAvg * 0.4);

      // Confidence based on data consistency
      const variance = calculateVariance(stats.amounts);
      const confidence = Math.max(0.5, 1 - (variance / (historicalAvg || 1)));

      // Risk level based on predicted volume
      const riskLevel = predictedVolume > 100000 ? 'critical'
                       : predictedVolume > 50000 ? 'high'
                       : predictedVolume > 20000 ? 'medium'
                       : 'low';

      // Suggested limit
      const suggestedLimit = Math.round(predictedVolume * 1.5);

      // Reasons
      const reasons: string[] = [];
      if (trend === 'rising') reasons.push('แนวโน้มเพิ่มขึ้นในสัปดาห์ที่ผ่านมา');
      if (stats.count > 50) reasons.push('เป็นเลขยอดนิยมประจำ');
      if (isSpecialNumber(number)) reasons.push('เป็นเลขมงคล/วันสำคัญ');

      predictions.push({
        number,
        predictedVolume,
        confidence: Math.round(confidence * 100) / 100,
        historicalAvg: Math.round(historicalAvg),
        trend,
        riskLevel,
        suggestedLimit,
        reasons,
      });
    }

    // 4. Add special date numbers
    const specialNumbers = getSpecialDateNumbers();
    specialNumbers.forEach(num => {
      const existing = predictions.find(p => p.number === num.number);
      if (existing) {
        existing.predictedVolume *= 1.3;
        existing.reasons.push(num.reason);
      } else {
        predictions.push({
          number: num.number,
          predictedVolume: 10000,
          confidence: 0.6,
          historicalAvg: 5000,
          trend: 'rising',
          riskLevel: 'medium',
          suggestedLimit: 15000,
          reasons: [num.reason],
        });
      }
    });

    // Sort by predicted volume and return top N
    return predictions
      .sort((a, b) => b.predictedVolume - a.predictedVolume)
      .slice(0, topN);
  } catch (error) {
    console.error('Predict hot numbers error:', error);
    return [];
  }
}

/**
 * ตรวจจับเลขที่อาจมีการฮั้วกัน (Collusion Detection)
 */
export async function detectCollusionPatterns(
  lotteryId: string
): Promise<{ suspicious: boolean; patterns: any[] }> {
  const supabase = await createClient();

  try {
    // Get bets in the last hour
    const { data: recentBets } = await supabase
      .from('bet_logs')
      .select('number, amount, customer_id, agent_id, created_at')
      .eq('lottery_id', lotteryId)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (!recentBets || recentBets.length < 10) {
      return { suspicious: false, patterns: [] };
    }

    const patterns: any[] = [];

    // Pattern 1: Same number from multiple accounts in short time
    const numberGroups: Record<string, any[]> = {};
    recentBets.forEach((bet: any) => {
      if (!numberGroups[bet.number]) numberGroups[bet.number] = [];
      numberGroups[bet.number].push(bet);
    });

    for (const [number, bets] of Object.entries(numberGroups)) {
      if (bets.length >= 5) {
        const uniqueCustomers = new Set(bets.map(b => b.customer_id));
        const timeSpan = Math.max(...bets.map(b => new Date(b.created_at).getTime())) -
                        Math.min(...bets.map(b => new Date(b.created_at).getTime()));
        
        // Suspicious if many different customers bet same number in < 5 minutes
        if (uniqueCustomers.size >= 4 && timeSpan < 5 * 60 * 1000) {
          patterns.push({
            type: 'coordinated_betting',
            number,
            customerCount: uniqueCustomers.size,
            timeSpanMinutes: Math.round(timeSpan / 60000),
            totalAmount: bets.reduce((sum, b) => sum + b.amount, 0),
          });
        }
      }
    }

    return {
      suspicious: patterns.length > 0,
      patterns,
    };
  } catch (error) {
    console.error('Collusion detection error:', error);
    return { suspicious: false, patterns: [] };
  }
}

// =============================================
// CHURN PREDICTION
// =============================================

/**
 * วิเคราะห์ลูกค้าที่เสี่ยงจะหายไป
 */
export async function predictCustomerChurn(
  minLifetimeValue: number = 1000,
  topN: number = 50
): Promise<ChurnRisk[]> {
  const supabase = await createClient();
  const churnRisks: ChurnRisk[] = [];

  try {
    // Get customers with recent activity (active in last 90 days but not in last 7 days)
    const { data: customers } = await supabase
      .from('customers')
      .select(`
        id,
        username,
        credit_balance,
        total_bet,
        total_deposit,
        last_bet_at,
        created_at
      `)
      .gte('total_bet', minLifetimeValue)
      .order('last_bet_at', { ascending: true })
      .limit(200);

    if (!customers) return [];

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    for (const customer of customers) {
      const lastBetTime = customer.last_bet_at ? new Date(customer.last_bet_at).getTime() : 0;
      const daysSinceLastBet = Math.floor((now - lastBetTime) / (24 * 60 * 60 * 1000));

      // Skip if active in last 7 days
      if (lastBetTime > sevenDaysAgo) continue;

      // Calculate risk factors
      const factors: ChurnFactor[] = [];
      let riskScore = 0;

      // Factor 1: Days since last bet
      if (daysSinceLastBet > 30) {
        riskScore += 40;
        factors.push({
          factor: 'inactive_long',
          weight: 40,
          description: `ไม่มีกิจกรรม ${daysSinceLastBet} วัน`,
        });
      } else if (daysSinceLastBet > 14) {
        riskScore += 25;
        factors.push({
          factor: 'inactive_medium',
          weight: 25,
          description: `ไม่มีกิจกรรม ${daysSinceLastBet} วัน`,
        });
      } else if (daysSinceLastBet > 7) {
        riskScore += 15;
        factors.push({
          factor: 'inactive_short',
          weight: 15,
          description: `ไม่มีกิจกรรม ${daysSinceLastBet} วัน`,
        });
      }

      // Factor 2: Low credit balance
      if (customer.credit_balance < 100) {
        riskScore += 20;
        factors.push({
          factor: 'low_balance',
          weight: 20,
          description: `ยอดเครดิตเหลือน้อย (${customer.credit_balance} บาท)`,
        });
      }

      // Factor 3: Decreasing activity (need bet history)
      const { data: recentBets } = await supabase
        .from('bet_logs')
        .select('amount, created_at')
        .eq('customer_id', customer.id)
        .gte('created_at', new Date(thirtyDaysAgo).toISOString());

      if (recentBets && recentBets.length > 0) {
        const firstHalfBets = recentBets.filter((b: any) => 
          new Date(b.created_at).getTime() < thirtyDaysAgo + 15 * 24 * 60 * 60 * 1000
        );
        const secondHalfBets = recentBets.filter((b: any) => 
          new Date(b.created_at).getTime() >= thirtyDaysAgo + 15 * 24 * 60 * 60 * 1000
        );

        const firstHalfVolume = firstHalfBets.reduce((sum: number, b: any) => sum + b.amount, 0);
        const secondHalfVolume = secondHalfBets.reduce((sum: number, b: any) => sum + b.amount, 0);

        if (firstHalfVolume > 0 && secondHalfVolume < firstHalfVolume * 0.5) {
          riskScore += 20;
          factors.push({
            factor: 'decreasing_activity',
            weight: 20,
            description: 'ยอดแทงลดลงมากกว่า 50%',
          });
        }
      }

      // Determine risk level
      const riskLevel = riskScore >= 70 ? 'critical'
                       : riskScore >= 50 ? 'high'
                       : riskScore >= 30 ? 'medium'
                       : 'low';

      // Suggested action
      let suggestedAction = '';
      if (riskLevel === 'critical') {
        suggestedAction = 'โทรติดต่อโดยด่วน พร้อมเสนอโปรโมชั่นพิเศษ';
      } else if (riskLevel === 'high') {
        suggestedAction = 'ส่ง LINE พร้อมโบนัสเครดิต';
      } else if (riskLevel === 'medium') {
        suggestedAction = 'ส่งข้อความเตือนความทรงจำ';
      } else {
        suggestedAction = 'ติดตามต่อไป';
      }

      churnRisks.push({
        customerId: customer.id,
        customerName: customer.username,
        riskScore,
        riskLevel,
        lastActivity: customer.last_bet_at,
        daysSinceLastBet,
        totalLifetimeValue: customer.total_bet || 0,
        suggestedAction,
        factors,
      });
    }

    // Sort by risk score and return top N
    return churnRisks
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, topN);
  } catch (error) {
    console.error('Churn prediction error:', error);
    return [];
  }
}

/**
 * วิเคราะห์ Agent ที่เสี่ยงจะหายไป
 */
export async function predictAgentChurn(): Promise<AgentChurnRisk[]> {
  const supabase = await createClient();

  try {
    const { data: agents } = await supabase
      .from('agents')
      .select(`
        id,
        name,
        total_bets,
        last_activity_at,
        created_at
      `)
      .eq('status', 'active');

    if (!agents) return [];

    const risks: AgentChurnRisk[] = [];
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

    for (const agent of agents) {
      // Get monthly volume comparison
      const { data: thisMonthBets } = await supabase
        .from('bet_logs')
        .select('amount')
        .eq('agent_id', agent.id)
        .gte('created_at', new Date(thirtyDaysAgo).toISOString());

      const { data: lastMonthBets } = await supabase
        .from('bet_logs')
        .select('amount')
        .eq('agent_id', agent.id)
        .gte('created_at', new Date(sixtyDaysAgo).toISOString())
        .lt('created_at', new Date(thirtyDaysAgo).toISOString());

      const thisMonthVolume = thisMonthBets?.reduce((sum, b) => sum + b.amount, 0) || 0;
      const lastMonthVolume = lastMonthBets?.reduce((sum, b) => sum + b.amount, 0) || 1;

      const volumeChange = ((thisMonthVolume - lastMonthVolume) / lastMonthVolume) * 100;

      // Calculate risk
      let riskScore = 0;
      
      if (volumeChange < -50) riskScore += 50;
      else if (volumeChange < -30) riskScore += 30;
      else if (volumeChange < -10) riskScore += 15;

      const daysSinceActivity = agent.last_activity_at 
        ? Math.floor((now - new Date(agent.last_activity_at).getTime()) / (24 * 60 * 60 * 1000))
        : 999;

      if (daysSinceActivity > 7) riskScore += 30;
      else if (daysSinceActivity > 3) riskScore += 15;

      const riskLevel = riskScore >= 60 ? 'critical'
                       : riskScore >= 40 ? 'high'
                       : riskScore >= 20 ? 'medium'
                       : 'low';

      let suggestedAction = '';
      if (riskLevel === 'critical') suggestedAction = 'ติดต่อด่วน เสนอเงื่อนไขพิเศษ';
      else if (riskLevel === 'high') suggestedAction = 'นัดพบเพื่อหารือ';
      else if (riskLevel === 'medium') suggestedAction = 'ติดตามสถานการณ์';
      else suggestedAction = 'ปกติ';

      risks.push({
        agentId: agent.id,
        agentName: agent.name,
        riskScore,
        riskLevel,
        monthlyVolumeChange: Math.round(volumeChange),
        activeCustomersChange: 0, // TODO: Calculate
        suggestedAction,
      });
    }

    return risks.sort((a, b) => b.riskScore - a.riskScore);
  } catch (error) {
    console.error('Agent churn prediction error:', error);
    return [];
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function calculateVariance(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  return numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length;
}

function isSpecialNumber(number: string): boolean {
  const specialNumbers = [
    '000', '111', '222', '333', '444', '555', '666', '777', '888', '999',
    '123', '234', '345', '456', '567', '678', '789',
    '321', '432', '543', '654', '765', '876', '987',
    '168', '289', '369', '888', '999',
  ];
  return specialNumbers.includes(number);
}

function getSpecialDateNumbers(): { number: string; reason: string }[] {
  const today = new Date();
  const numbers: { number: string; reason: string }[] = [];

  // Today's date
  const day = today.getDate().toString().padStart(2, '0');
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  
  numbers.push({ number: day + month.charAt(1), reason: 'วันที่วันนี้' });
  numbers.push({ number: month + day, reason: 'เดือน+วัน' });

  // Upcoming holidays (example)
  const upcomingHolidays: { date: string; name: string }[] = [
    { date: '05-13', name: 'วันพืชมงคล' },
  ];

  upcomingHolidays.forEach(holiday => {
    const [m, d] = holiday.date.split('-');
    numbers.push({ number: d + m.charAt(1), reason: `ใกล้${holiday.name}` });
  });

  return numbers;
}

// =============================================
// ANALYTICS DASHBOARD API
// =============================================

export async function getAnalyticsSummary(lotteryId?: string): Promise<AnalyticsSummary> {
  const [hotNumbers, customerChurn, agentChurn] = await Promise.all([
    lotteryId ? predictHotNumbers(lotteryId, 10) : Promise.resolve([]),
    predictCustomerChurn(1000, 20),
    predictAgentChurn(),
  ]);

  const totalAtRiskValue = customerChurn
    .filter(c => c.riskLevel === 'critical' || c.riskLevel === 'high')
    .reduce((sum, c) => sum + c.totalLifetimeValue, 0);

  const recommendations: string[] = [];

  if (hotNumbers.some(n => n.riskLevel === 'critical')) {
    recommendations.push('มีเลขที่คาดว่าจะมียอดแทงสูงมาก ควรตั้งเลขอั้นล่วงหน้า');
  }

  if (customerChurn.filter(c => c.riskLevel === 'critical').length > 5) {
    recommendations.push('มีลูกค้า VIP หลายรายเสี่ยงหายไป ควรติดต่อด่วน');
  }

  if (agentChurn.some(a => a.riskLevel === 'critical')) {
    recommendations.push('มี Agent หลักเสี่ยงหยุดทำงาน ควรนัดพบเพื่อหารือ');
  }

  return {
    predictedHotNumbers: hotNumbers,
    churnRiskCustomers: customerChurn,
    churnRiskAgents: agentChurn,
    totalAtRiskValue,
    recommendations,
  };
}

// =============================================
// EXPORTS
// =============================================

export const AIAnalytics = {
  predictHotNumbers,
  detectCollusionPatterns,
  predictCustomerChurn,
  predictAgentChurn,
  getAnalyticsSummary,
};
