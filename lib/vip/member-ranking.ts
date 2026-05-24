/**
 * VIP Member Ranking System
 * Different payout rates based on user level
 * Automatic tier upgrade/downgrade based on activity
 */

import { createClient } from '@/lib/supabase/server';

// VIP Level configuration
export interface VIPLevel {
  id: string;
  name: string;
  nameEn: string;
  minPoints: number;
  minBetVolume: number;
  payoutBonus: number;      // Extra payout percentage (e.g., 2 = +2%)
  rebateRate: number;       // Rebate on losses percentage
  maxBetMultiplier: number; // Multiplier for max bet limits
  withdrawPriority: number; // Lower = faster processing
  benefits: string[];
  color: string;            // Theme color for UI
  icon: string;             // Icon identifier
}

// Default VIP levels
export const VIP_LEVELS: VIPLevel[] = [
  {
    id: 'member',
    name: 'สมาชิก',
    nameEn: 'Member',
    minPoints: 0,
    minBetVolume: 0,
    payoutBonus: 0,
    rebateRate: 0,
    maxBetMultiplier: 1,
    withdrawPriority: 5,
    benefits: ['เข้าถึงหวยทั่วไป'],
    color: '#64748B',
    icon: 'user',
  },
  {
    id: 'bronze',
    name: 'บรอนซ์',
    nameEn: 'Bronze',
    minPoints: 1000,
    minBetVolume: 10000,
    payoutBonus: 1,
    rebateRate: 0.5,
    maxBetMultiplier: 1.2,
    withdrawPriority: 4,
    benefits: ['เข้าถึงหวยทั่วไป', 'โบนัสเรทจ่าย +1%'],
    color: '#CD7F32',
    icon: 'award',
  },
  {
    id: 'silver',
    name: 'ซิลเวอร์',
    nameEn: 'Silver',
    minPoints: 5000,
    minBetVolume: 50000,
    payoutBonus: 2,
    rebateRate: 1,
    maxBetMultiplier: 1.5,
    withdrawPriority: 3,
    benefits: ['เข้าถึงหวยทุกประเภท', 'โบนัสเรทจ่าย +2%', 'คืนยอดเสีย 1%'],
    color: '#C0C0C0',
    icon: 'star',
  },
  {
    id: 'gold',
    name: 'โกลด์',
    nameEn: 'Gold',
    minPoints: 20000,
    minBetVolume: 200000,
    payoutBonus: 3,
    rebateRate: 2,
    maxBetMultiplier: 2,
    withdrawPriority: 2,
    benefits: ['เข้าถึงหวย VIP', 'โบนัสเรทจ่าย +3%', 'คืนยอดเสีย 2%', 'ถอนเงินเร็ว'],
    color: '#FFD700',
    icon: 'crown',
  },
  {
    id: 'platinum',
    name: 'แพลตินัม',
    nameEn: 'Platinum',
    minPoints: 100000,
    minBetVolume: 1000000,
    payoutBonus: 5,
    rebateRate: 3,
    maxBetMultiplier: 3,
    withdrawPriority: 1,
    benefits: ['เข้าถึงหวยทุกประเภท', 'โบนัสเรทจ่าย +5%', 'คืนยอดเสีย 3%', 'ถอนเงินทันที', 'ผู้จัดการส่วนตัว'],
    color: '#E5E4E2',
    icon: 'gem',
  },
  {
    id: 'diamond',
    name: 'ไดมอนด์',
    nameEn: 'Diamond',
    minPoints: 500000,
    minBetVolume: 5000000,
    payoutBonus: 8,
    rebateRate: 5,
    maxBetMultiplier: 5,
    withdrawPriority: 0,
    benefits: ['เข้าถึงหวยพิเศษ', 'โบนัสเรทจ่าย +8%', 'คืนยอดเสีย 5%', 'ถอนเงินทันทีไม่จำกัด', 'ผู้จัดการส่วนตัว', 'ของขวัญพิเศษ'],
    color: '#B9F2FF',
    icon: 'diamond',
  },
];

// Member VIP data
export interface MemberVIPData {
  customerId: string;
  currentLevel: VIPLevel;
  nextLevel: VIPLevel | null;
  totalPoints: number;
  totalBetVolume: number;
  pointsToNextLevel: number;
  volumeToNextLevel: number;
  progressPercent: number;
  joinDate: string;
  lastActivityDate: string;
  history: VIPHistoryEntry[];
}

export interface VIPHistoryEntry {
  date: string;
  action: 'upgrade' | 'downgrade' | 'points_earned' | 'rebate_given';
  fromLevel?: string;
  toLevel?: string;
  points?: number;
  amount?: number;
}

/**
 * Get VIP level by points and volume
 */
export function getVIPLevelByActivity(points: number, betVolume: number): VIPLevel {
  // Find highest qualifying level
  for (let i = VIP_LEVELS.length - 1; i >= 0; i--) {
    const level = VIP_LEVELS[i];
    if (points >= level.minPoints && betVolume >= level.minBetVolume) {
      return level;
    }
  }
  return VIP_LEVELS[0];
}

/**
 * Get member's VIP data
 */
export async function getMemberVIPData(customerId: string): Promise<MemberVIPData> {
  const supabase = await createClient();

  // Get customer data
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  if (!customer) {
    throw new Error('Customer not found');
  }

  const totalPoints = customer.vip_points || 0;
  const totalBetVolume = customer.total_bet_volume || 0;

  const currentLevel = getVIPLevelByActivity(totalPoints, totalBetVolume);
  
  // Find next level
  const currentIndex = VIP_LEVELS.findIndex(l => l.id === currentLevel.id);
  const nextLevel = currentIndex < VIP_LEVELS.length - 1 ? VIP_LEVELS[currentIndex + 1] : null;

  // Calculate progress
  const pointsToNextLevel = nextLevel ? Math.max(0, nextLevel.minPoints - totalPoints) : 0;
  const volumeToNextLevel = nextLevel ? Math.max(0, nextLevel.minBetVolume - totalBetVolume) : 0;
  
  let progressPercent = 100;
  if (nextLevel) {
    const pointsProgress = (totalPoints - currentLevel.minPoints) / (nextLevel.minPoints - currentLevel.minPoints);
    const volumeProgress = (totalBetVolume - currentLevel.minBetVolume) / (nextLevel.minBetVolume - currentLevel.minBetVolume);
    progressPercent = Math.min(100, Math.max(pointsProgress, volumeProgress) * 100);
  }

  // Get VIP history
  const { data: history } = await supabase
    .from('vip_history')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(20);

  return {
    customerId,
    currentLevel,
    nextLevel,
    totalPoints,
    totalBetVolume,
    pointsToNextLevel,
    volumeToNextLevel,
    progressPercent,
    joinDate: customer.created_at,
    lastActivityDate: customer.last_activity_at || customer.updated_at,
    history: history || [],
  };
}

/**
 * Award VIP points to a member
 */
export async function awardVIPPoints(
  customerId: string,
  points: number,
  reason: string
): Promise<{ newTotal: number; levelChanged: boolean; newLevel?: VIPLevel }> {
  const supabase = await createClient();

  // Get current data
  const { data: customer } = await supabase
    .from('customers')
    .select('vip_points, total_bet_volume, vip_level')
    .eq('id', customerId)
    .single();

  if (!customer) {
    throw new Error('Customer not found');
  }

  const oldPoints = customer.vip_points || 0;
  const newTotal = oldPoints + points;
  const oldLevel = VIP_LEVELS.find(l => l.id === customer.vip_level) || VIP_LEVELS[0];
  const newLevel = getVIPLevelByActivity(newTotal, customer.total_bet_volume || 0);

  // Update customer points
  await supabase
    .from('customers')
    .update({
      vip_points: newTotal,
      vip_level: newLevel.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId);

  // Log points earned
  await supabase.from('vip_history').insert({
    customer_id: customerId,
    action: 'points_earned',
    points,
    description: reason,
  });

  // Log level change if applicable
  const levelChanged = oldLevel.id !== newLevel.id;
  if (levelChanged) {
    await supabase.from('vip_history').insert({
      customer_id: customerId,
      action: newLevel.minPoints > oldLevel.minPoints ? 'upgrade' : 'downgrade',
      from_level: oldLevel.id,
      to_level: newLevel.id,
    });
  }

  return { newTotal, levelChanged, newLevel: levelChanged ? newLevel : undefined };
}

/**
 * Calculate adjusted payout rate based on VIP level
 */
export function calculateVIPPayoutRate(baseRate: number, vipLevel: VIPLevel): number {
  return baseRate * (1 + vipLevel.payoutBonus / 100);
}

/**
 * Calculate rebate for a member
 */
export async function calculateMemberRebate(
  customerId: string,
  startDate: string,
  endDate: string
): Promise<{ totalLoss: number; rebateRate: number; rebateAmount: number }> {
  const supabase = await createClient();

  // Get member's VIP level
  const { data: customer } = await supabase
    .from('customers')
    .select('vip_level')
    .eq('id', customerId)
    .single();

  const vipLevel = VIP_LEVELS.find(l => l.id === customer?.vip_level) || VIP_LEVELS[0];

  // Calculate total loss for the period
  const { data: entries } = await supabase
    .from('entries')
    .select('total_amount, payout_amount')
    .eq('customer_id', customerId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const totalBets = entries?.reduce((sum, e) => sum + (e.total_amount || 0), 0) || 0;
  const totalPayout = entries?.reduce((sum, e) => sum + (e.payout_amount || 0), 0) || 0;
  const totalLoss = Math.max(0, totalBets - totalPayout);

  const rebateAmount = totalLoss * (vipLevel.rebateRate / 100);

  return {
    totalLoss,
    rebateRate: vipLevel.rebateRate,
    rebateAmount,
  };
}

/**
 * Process weekly/monthly rebates for all members
 */
export async function processRebates(
  startDate: string,
  endDate: string
): Promise<{ processed: number; totalRebate: number }> {
  const supabase = await createClient();

  // Get all customers with rebate-eligible VIP levels
  const eligibleLevels = VIP_LEVELS.filter(l => l.rebateRate > 0).map(l => l.id);
  
  const { data: customers } = await supabase
    .from('customers')
    .select('id')
    .in('vip_level', eligibleLevels);

  if (!customers || customers.length === 0) {
    return { processed: 0, totalRebate: 0 };
  }

  let processed = 0;
  let totalRebate = 0;

  for (const customer of customers) {
    const rebate = await calculateMemberRebate(customer.id, startDate, endDate);
    
    if (rebate.rebateAmount > 0) {
      // Credit the rebate to customer
      await supabase
        .from('customers')
        .update({
          credit_balance: supabase.rpc('increment', { amount: rebate.rebateAmount }),
        })
        .eq('id', customer.id);

      // Log the rebate
      await supabase.from('vip_history').insert({
        customer_id: customer.id,
        action: 'rebate_given',
        amount: rebate.rebateAmount,
        description: `Rebate for period ${startDate} - ${endDate}`,
      });

      processed++;
      totalRebate += rebate.rebateAmount;
    }
  }

  return { processed, totalRebate };
}

/**
 * Get VIP statistics for dashboard
 */
export async function getVIPStatistics(): Promise<{
  totalMembers: number;
  byLevel: Record<string, number>;
  totalPointsAwarded: number;
  totalRebatesGiven: number;
}> {
  const supabase = await createClient();

  const { data: customers } = await supabase
    .from('customers')
    .select('vip_level, vip_points');

  const byLevel: Record<string, number> = {};
  VIP_LEVELS.forEach(l => { byLevel[l.id] = 0; });

  let totalPointsAwarded = 0;
  customers?.forEach(c => {
    const level = c.vip_level || 'member';
    byLevel[level] = (byLevel[level] || 0) + 1;
    totalPointsAwarded += c.vip_points || 0;
  });

  // Get total rebates
  const { data: rebates } = await supabase
    .from('vip_history')
    .select('amount')
    .eq('action', 'rebate_given');

  const totalRebatesGiven = rebates?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;

  return {
    totalMembers: customers?.length || 0,
    byLevel,
    totalPointsAwarded,
    totalRebatesGiven,
  };
}
