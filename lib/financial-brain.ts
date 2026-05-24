/**
 * FIN LOTTO R+ Financial Brain
 * ============================
 * Logic การคำนวณ Commission Spread และ Profit Sharing ระหว่างแม่-ลูก-เอเย่นต์
 * แม่นยำ 100% สำหรับระบบระดับพันล้าน
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface CommissionTier {
  role: 'master' | 'site' | 'senior_agent' | 'agent' | 'sub_agent';
  name: string;
  commissionRate: number; // เปอร์เซ็นต์ที่ได้รับ
  ptRate: number; // Position Taking - เปอร์เซ็นต์ที่ถือสู้
}

export interface BetCalculation {
  grossAmount: number;        // ยอดแทงเต็ม
  totalCommission: number;    // คอมมิชชันรวม
  netAmount: number;          // ยอดสุทธิหลังหักคอม
  
  // Commission Distribution
  masterCommission: number;   // คอมเว็บแม่
  siteCommission: number;     // คอมเว็บลูก
  agentCommission: number;    // คอมเอเย่นต์
  
  // Position Taking (ถือสู้)
  masterPT: number;           // เว็บแม่ถือสู้
  sitePT: number;             // เว็บลูกถือสู้
  agentPT: number;            // เอเย่นต์ถือสู้
  
  // After PT adjustment
  masterExposure: number;     // ความเสี่ยงเว็บแม่
  siteExposure: number;       // ความเสี่ยงเว็บลูก
  agentExposure: number;      // ความเสี่ยงเอเย่นต์
}

export interface PayoutCalculation {
  winningAmount: number;      // เงินรางวัล
  payRate: number;            // เรทจ่าย
  
  // Payout Distribution
  masterPayout: number;       // เว็บแม่จ่าย
  sitePayout: number;         // เว็บลูกจ่าย
  agentPayout: number;        // เอเย่นต์จ่าย
  
  // Final Position (หลังจ่ายรางวัล)
  masterProfit: number;       // กำไร/ขาดทุน เว็บแม่
  siteProfit: number;         // กำไร/ขาดทุน เว็บลูก
  agentProfit: number;        // กำไร/ขาดทุน เอเย่นต์
}

export interface SettlementReport {
  siteId: string;
  period: { from: string; to: string };
  
  // Volume Summary
  totalBets: number;
  totalVolume: number;
  totalPayout: number;
  
  // Commission Summary
  grossCommission: number;
  masterShare: number;
  siteShare: number;
  
  // PT Summary
  masterPTAmount: number;
  sitePTAmount: number;
  
  // Win/Loss
  masterWinLoss: number;
  siteWinLoss: number;
  
  // Final Settlement
  siteOwesToMaster: number;   // เว็บลูกติดเว็บแม่
  masterOwesSite: number;     // เว็บแม่ติดเว็บลูก
  netSettlement: number;      // ยอดสุทธิ (+ = เว็บลูกจ่าย, - = เว็บแม่จ่าย)
}

// =============================================================================
// FINANCIAL BRAIN CLASS
// =============================================================================

export class FinancialBrain {
  
  // Default commission tiers (can be overridden per site/agent)
  private defaultTiers: CommissionTier[] = [
    { role: 'master', name: 'เว็บแม่', commissionRate: 0.05, ptRate: 0.10 },
    { role: 'site', name: 'เว็บลูก', commissionRate: 0.10, ptRate: 0.20 },
    { role: 'senior_agent', name: 'เอเย่นต์ใหญ่', commissionRate: 0.03, ptRate: 0.15 },
    { role: 'agent', name: 'เอเย่นต์', commissionRate: 0.02, ptRate: 0.10 },
    { role: 'sub_agent', name: 'ตัวแทน', commissionRate: 0.00, ptRate: 0.05 },
  ];

  // ===========================================================================
  // BET CALCULATION
  // ===========================================================================

  /**
   * คำนวณการแบ่งคอมมิชชันและ PT สำหรับการแทง 1 รายการ
   */
  calculateBet(
    amount: number,
    siteCommissionRate: number,
    agentCommissionRate: number,
    masterPTRate: number = 0.10,
    sitePTRate: number = 0.20,
    agentPTRate: number = 0.10
  ): BetCalculation {
    // 1. คำนวณคอมมิชชัน
    const totalCommissionRate = siteCommissionRate; // Total commission from bet
    const totalCommission = amount * totalCommissionRate;
    const netAmount = amount - totalCommission;

    // 2. แบ่งคอมมิชชันระหว่างชั้น
    // Master gets their cut from site commission
    const masterCommissionRate = Math.min(0.05, siteCommissionRate * 0.25); // 25% of site commission or max 5%
    const masterCommission = amount * masterCommissionRate;
    
    // Site keeps difference minus agent share
    const agentCommission = amount * agentCommissionRate;
    const siteCommission = totalCommission - masterCommission - agentCommission;

    // 3. คำนวณ Position Taking (ถือสู้)
    // PT = ส่วนที่แต่ละชั้นรับความเสี่ยงจากยอดแทง
    const totalPT = masterPTRate + sitePTRate + agentPTRate;
    const normalizedMasterPT = masterPTRate / totalPT;
    const normalizedSitePT = sitePTRate / totalPT;
    const normalizedAgentPT = agentPTRate / totalPT;

    const masterPT = netAmount * normalizedMasterPT;
    const sitePT = netAmount * normalizedSitePT;
    const agentPT = netAmount * normalizedAgentPT;

    // 4. คำนวณความเสี่ยง (Exposure)
    const masterExposure = masterPT;
    const siteExposure = sitePT;
    const agentExposure = agentPT;

    return {
      grossAmount: amount,
      totalCommission,
      netAmount,
      masterCommission,
      siteCommission,
      agentCommission,
      masterPT,
      sitePT,
      agentPT,
      masterExposure,
      siteExposure,
      agentExposure,
    };
  }

  /**
   * คำนวณการจ่ายรางวัลและแบ่งกำไร/ขาดทุน
   */
  calculatePayout(
    betAmount: number,
    payRate: number,
    betCalculation: BetCalculation
  ): PayoutCalculation {
    const winningAmount = betAmount * payRate;

    // แบ่งการจ่ายตาม PT ratio
    const totalPT = betCalculation.masterPT + betCalculation.sitePT + betCalculation.agentPT;
    
    const masterPayout = winningAmount * (betCalculation.masterPT / totalPT);
    const sitePayout = winningAmount * (betCalculation.sitePT / totalPT);
    const agentPayout = winningAmount * (betCalculation.agentPT / totalPT);

    // คำนวณกำไร/ขาดทุน (Commission - Payout = Profit)
    const masterProfit = betCalculation.masterCommission + betCalculation.masterPT - masterPayout;
    const siteProfit = betCalculation.siteCommission + betCalculation.sitePT - sitePayout;
    const agentProfit = betCalculation.agentCommission + betCalculation.agentPT - agentPayout;

    return {
      winningAmount,
      payRate,
      masterPayout,
      sitePayout,
      agentPayout,
      masterProfit,
      siteProfit,
      agentProfit,
    };
  }

  // ===========================================================================
  // COMMISSION SPREAD CALCULATION
  // ===========================================================================

  /**
   * คำนวณส่วนต่างคอมมิชชันระหว่างชั้น
   * เช่น แม่ให้มา 30%, ลูกให้เอเย่นต์ 25% = กินส่วนต่าง 5%
   */
  calculateCommissionSpread(
    uplineRate: number,  // อัตราที่ได้รับจากเหนือ
    downlineRate: number // อัตราที่ให้ลง
  ): {
    spreadRate: number;
    spreadAmount: (amount: number) => number;
    isValid: boolean;
    message: string;
  } {
    const spreadRate = uplineRate - downlineRate;
    
    if (spreadRate < 0) {
      return {
        spreadRate: 0,
        spreadAmount: () => 0,
        isValid: false,
        message: 'ไม่สามารถให้คอมมากกว่าที่ได้รับ',
      };
    }

    return {
      spreadRate,
      spreadAmount: (amount: number) => amount * spreadRate,
      isValid: true,
      message: `กินส่วนต่าง ${(spreadRate * 100).toFixed(2)}%`,
    };
  }

  // ===========================================================================
  // SETTLEMENT CALCULATION
  // ===========================================================================

  /**
   * คำนวณยอดเคลียร์ระหว่างเว็บแม่กับเว็บลูก
   */
  calculateSettlement(
    bets: Array<{
      amount: number;
      isWin: boolean;
      payRate: number;
      siteCommissionRate: number;
      agentCommissionRate: number;
      masterPTRate: number;
      sitePTRate: number;
    }>,
    period: { from: string; to: string }
  ): SettlementReport {
    let totalVolume = 0;
    let totalPayout = 0;
    let grossCommission = 0;
    let masterShare = 0;
    let siteShare = 0;
    let masterPTAmount = 0;
    let sitePTAmount = 0;
    let masterWinLoss = 0;
    let siteWinLoss = 0;

    for (const bet of bets) {
      const betCalc = this.calculateBet(
        bet.amount,
        bet.siteCommissionRate,
        bet.agentCommissionRate,
        bet.masterPTRate,
        bet.sitePTRate
      );

      totalVolume += bet.amount;
      grossCommission += betCalc.totalCommission;
      masterShare += betCalc.masterCommission;
      siteShare += betCalc.siteCommission;
      masterPTAmount += betCalc.masterPT;
      sitePTAmount += betCalc.sitePT;

      if (bet.isWin) {
        const payoutCalc = this.calculatePayout(bet.amount, bet.payRate, betCalc);
        totalPayout += payoutCalc.winningAmount;
        masterWinLoss += payoutCalc.masterProfit;
        siteWinLoss += payoutCalc.siteProfit;
      } else {
        // ถ้าไม่ถูก ได้ PT + Commission
        masterWinLoss += betCalc.masterCommission + betCalc.masterPT;
        siteWinLoss += betCalc.siteCommission + betCalc.sitePT;
      }
    }

    // คำนวณยอดเคลียร์
    // ถ้าบวก = เว็บลูกต้องจ่ายเว็บแม่
    // ถ้าลบ = เว็บแม่ต้องจ่ายเว็บลูก
    const netSettlement = masterWinLoss;
    const siteOwesToMaster = Math.max(0, netSettlement);
    const masterOwesSite = Math.max(0, -netSettlement);

    return {
      siteId: '', // Set by caller
      period,
      totalBets: bets.length,
      totalVolume,
      totalPayout,
      grossCommission,
      masterShare,
      siteShare,
      masterPTAmount,
      sitePTAmount,
      masterWinLoss,
      siteWinLoss,
      siteOwesToMaster,
      masterOwesSite,
      netSettlement,
    };
  }

  // ===========================================================================
  // PROJECTION CALCULATION
  // ===========================================================================

  /**
   * คาดการณ์กำไรตามยอดแทงที่คาดหวัง
   */
  projectProfit(
    expectedVolume: number,
    avgCommissionRate: number = 0.20,
    expectedWinRate: number = 0.35, // โดยทั่วไปหวยออกถูก ~35%
    avgPayRate: number = 800 // เฉลี่ย 3 ตัวบน
  ): {
    expectedCommission: number;
    expectedPayout: number;
    expectedProfit: number;
    profitMargin: number;
    riskLevel: 'low' | 'medium' | 'high';
  } {
    const expectedCommission = expectedVolume * avgCommissionRate;
    
    // คาดการณ์เงินจ่ายรางวัล
    // สมมติว่ามีคนถูกตามอัตรา expectedWinRate
    const avgBetAmount = 100; // สมมติเฉลี่ย 100 บาทต่อรายการ
    const expectedBets = expectedVolume / avgBetAmount;
    const expectedWins = expectedBets * expectedWinRate;
    const expectedPayout = expectedWins * avgBetAmount * avgPayRate;

    // กำไรที่คาดหวัง
    const expectedProfit = expectedCommission - expectedPayout + (expectedVolume - expectedCommission);
    const profitMargin = expectedProfit / expectedVolume;

    // ประเมินความเสี่ยง
    let riskLevel: 'low' | 'medium' | 'high';
    if (profitMargin > 0.05) {
      riskLevel = 'low';
    } else if (profitMargin > 0) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'high';
    }

    return {
      expectedCommission,
      expectedPayout,
      expectedProfit,
      profitMargin,
      riskLevel,
    };
  }

  // ===========================================================================
  // AGENT HIERARCHY CALCULATION
  // ===========================================================================

  /**
   * คำนวณคอมมิชชันของทั้งสายงาน
   */
  calculateAgentHierarchy(
    betAmount: number,
    hierarchy: Array<{
      agentId: string;
      role: 'senior_agent' | 'agent' | 'sub_agent';
      commissionRate: number;
      ptRate: number;
    }>
  ): Array<{
    agentId: string;
    role: string;
    commission: number;
    pt: number;
    total: number;
  }> {
    const results = [];
    let remainingCommission = betAmount * 0.20; // Total commission pool

    for (const agent of hierarchy) {
      const commission = betAmount * agent.commissionRate;
      const pt = betAmount * agent.ptRate;
      
      remainingCommission -= commission;
      
      results.push({
        agentId: agent.agentId,
        role: agent.role,
        commission,
        pt,
        total: commission + pt,
      });
    }

    return results;
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * ตรวจสอบว่าอัตราคอมมิชชันถูกต้องหรือไม่
   */
  validateCommissionRates(rates: {
    masterRate: number;
    siteRate: number;
    agentRate: number;
  }): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (rates.masterRate < 0 || rates.masterRate > 0.10) {
      errors.push('Master commission ต้องอยู่ระหว่าง 0-10%');
    }

    if (rates.siteRate < rates.masterRate) {
      errors.push('Site commission ต้องมากกว่า Master commission');
    }

    if (rates.agentRate > rates.siteRate - rates.masterRate) {
      errors.push('Agent commission ต้องไม่เกินส่วนต่างระหว่าง Site และ Master');
    }

    if (rates.siteRate > 0.30) {
      errors.push('Site commission ไม่ควรเกิน 30%');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format ตัวเลขเป็นสกุลเงิน
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * Format เปอร์เซ็นต์
   */
  formatPercent(rate: number): string {
    return `${(rate * 100).toFixed(2)}%`;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let financialBrainInstance: FinancialBrain | null = null;

export function getFinancialBrain(): FinancialBrain {
  if (!financialBrainInstance) {
    financialBrainInstance = new FinancialBrain();
  }
  return financialBrainInstance;
}

// =============================================================================
// EXAMPLE CALCULATIONS
// =============================================================================

/*
Example: การแทง 1,000 บาท

สมมติ:
- Site Commission: 20%
- Master Commission: 5% (จาก 20%)
- Agent Commission: 5%
- Master PT: 10%
- Site PT: 20%
- Agent PT: 10%

คำนวณ:
1. Total Commission = 1,000 x 20% = 200 บาท
2. Master Commission = 1,000 x 5% = 50 บาท
3. Agent Commission = 1,000 x 5% = 50 บาท
4. Site Commission = 200 - 50 - 50 = 100 บาท

Net Amount = 1,000 - 200 = 800 บาท (สำหรับแบ่ง PT)

PT Distribution (normalized 10+20+10 = 40%):
- Master PT = 800 x (10/40) = 200 บาท
- Site PT = 800 x (20/40) = 400 บาท
- Agent PT = 800 x (10/40) = 200 บาท

ถ้าถูกรางวัล (เรท 800):
- Total Payout = 1,000 x 800 = 800,000 บาท
- Master Payout = 800,000 x (10/40) = 200,000 บาท
- Site Payout = 800,000 x (20/40) = 400,000 บาท
- Agent Payout = 800,000 x (10/40) = 200,000 บาท

กำไร/ขาดทุน:
- Master = 50 (คอม) + 200 (PT) - 200,000 (จ่าย) = -199,750 บาท
- Site = 100 (คอม) + 400 (PT) - 400,000 (จ่าย) = -399,500 บาท
- Agent = 50 (คอม) + 200 (PT) - 200,000 (จ่าย) = -199,750 บาท

ถ้าไม่ถูกรางวัล:
- Master = 50 (คอม) + 200 (PT) = +250 บาท
- Site = 100 (คอม) + 400 (PT) = +500 บาท
- Agent = 50 (คอม) + 200 (PT) = +250 บาท
*/
