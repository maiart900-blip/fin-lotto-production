/**
 * Enterprise Revenue Share Engine
 * Handles multi-tier revenue distribution across tenants, providers, and platform
 */

import { createClient } from '@/lib/supabase/server'

export interface RevenueShareConfig {
  id: string
  tenant_id?: string
  provider_id?: string
  config_type: 'global' | 'tenant' | 'provider' | 'game_type'
  game_type: 'lottery' | 'casino' | 'slots' | 'sports' | 'all'
  tenant_share_percent: number
  platform_share_percent: number
  provider_share_percent: number
  min_threshold: number
  max_cap?: number
  settlement_frequency: 'realtime' | 'daily' | 'weekly' | 'monthly'
  auto_settle: boolean
  is_active: boolean
  priority: number
}

export interface RevenueCalculation {
  gross_amount: number
  tenant_share: number
  platform_share: number
  provider_share: number
  adjustments: number
  net_tenant_amount: number
  config_used: RevenueShareConfig
}

export class RevenueShareEngine {
  
  /**
   * Get applicable revenue share config for a tenant/game type
   * Priority: tenant-specific > provider-specific > game-type > global
   */
  static async getApplicableConfig(
    tenantId: string,
    gameType: string = 'lottery',
    providerId?: string
  ): Promise<RevenueShareConfig | null> {
    const supabase = await createClient()
    
    // Try tenant-specific first
    let { data: config } = await supabase
      .from('revenue_share_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('game_type', gameType)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(1)
      .single()
    
    if (config) return config
    
    // Try provider-specific if providerId given
    if (providerId) {
      const { data: providerConfig } = await supabase
        .from('revenue_share_configs')
        .select('*')
        .eq('provider_id', providerId)
        .eq('config_type', 'provider')
        .eq('is_active', true)
        .limit(1)
        .single()
      
      if (providerConfig) return providerConfig
    }
    
    // Try game-type global
    const { data: gameConfig } = await supabase
      .from('revenue_share_configs')
      .select('*')
      .eq('config_type', 'global')
      .eq('game_type', gameType)
      .eq('is_active', true)
      .limit(1)
      .single()
    
    if (gameConfig) return gameConfig
    
    // Fall back to global 'all' config
    const { data: globalConfig } = await supabase
      .from('revenue_share_configs')
      .select('*')
      .eq('config_type', 'global')
      .eq('game_type', 'all')
      .eq('is_active', true)
      .limit(1)
      .single()
    
    return globalConfig
  }
  
  /**
   * Calculate revenue distribution for a given gross amount
   */
  static async calculateRevenue(
    tenantId: string,
    grossAmount: number,
    gameType: string = 'lottery',
    providerId?: string
  ): Promise<RevenueCalculation> {
    const config = await this.getApplicableConfig(tenantId, gameType, providerId)
    
    if (!config) {
      // Default fallback: 85/15 split
      return {
        gross_amount: grossAmount,
        tenant_share: grossAmount * 0.85,
        platform_share: grossAmount * 0.15,
        provider_share: 0,
        adjustments: 0,
        net_tenant_amount: grossAmount * 0.85,
        config_used: {
          id: 'default',
          config_type: 'global',
          game_type: 'all',
          tenant_share_percent: 85,
          platform_share_percent: 15,
          provider_share_percent: 0,
          min_threshold: 0,
          settlement_frequency: 'daily',
          auto_settle: true,
          is_active: true,
          priority: 0
        }
      }
    }
    
    // Apply threshold check
    if (grossAmount < config.min_threshold) {
      return {
        gross_amount: grossAmount,
        tenant_share: grossAmount,
        platform_share: 0,
        provider_share: 0,
        adjustments: 0,
        net_tenant_amount: grossAmount,
        config_used: config
      }
    }
    
    // Calculate shares
    let tenantShare = grossAmount * (config.tenant_share_percent / 100)
    let platformShare = grossAmount * (config.platform_share_percent / 100)
    let providerShare = grossAmount * (config.provider_share_percent / 100)
    
    // Apply cap if exists
    if (config.max_cap && platformShare > config.max_cap) {
      const excess = platformShare - config.max_cap
      platformShare = config.max_cap
      tenantShare += excess // Give excess back to tenant
    }
    
    return {
      gross_amount: grossAmount,
      tenant_share: tenantShare,
      platform_share: platformShare,
      provider_share: providerShare,
      adjustments: 0,
      net_tenant_amount: tenantShare,
      config_used: config
    }
  }
  
  /**
   * Get all revenue share configs
   */
  static async getAllConfigs(filters?: {
    tenantId?: string
    configType?: string
    gameType?: string
    isActive?: boolean
  }): Promise<RevenueShareConfig[]> {
    const supabase = await createClient()
    
    let query = supabase
      .from('revenue_share_configs')
      .select('*')
      .order('priority', { ascending: false })
    
    if (filters?.tenantId) {
      query = query.eq('tenant_id', filters.tenantId)
    }
    if (filters?.configType) {
      query = query.eq('config_type', filters.configType)
    }
    if (filters?.gameType) {
      query = query.eq('game_type', filters.gameType)
    }
    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    return data || []
  }
  
  /**
   * Create or update revenue share config
   */
  static async upsertConfig(config: Partial<RevenueShareConfig> & {
    config_type: string
    game_type: string
  }): Promise<RevenueShareConfig> {
    const supabase = await createClient()
    
    // Validate percentages sum to 100
    const total = (config.tenant_share_percent || 0) + 
                  (config.platform_share_percent || 0) + 
                  (config.provider_share_percent || 0)
    
    if (total !== 100) {
      throw new Error(`Revenue share percentages must sum to 100, got ${total}`)
    }
    
    const { data, error } = await supabase
      .from('revenue_share_configs')
      .upsert({
        ...config,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  }
  
  /**
   * Set tenant-specific revenue share
   */
  static async setTenantRevenueShare(
    tenantId: string,
    gameType: string,
    tenantSharePercent: number,
    platformSharePercent: number,
    providerSharePercent: number = 0
  ): Promise<RevenueShareConfig> {
    return this.upsertConfig({
      tenant_id: tenantId,
      config_type: 'tenant',
      game_type: gameType as RevenueShareConfig['game_type'],
      tenant_share_percent: tenantSharePercent,
      platform_share_percent: platformSharePercent,
      provider_share_percent: providerSharePercent,
      is_active: true,
      priority: 100 // Higher priority than global
    })
  }
  
  /**
   * Update live revenue tracking (real-time)
   */
  static async updateLiveTracking(
    tenantId: string,
    turnover: number,
    wins: number,
    profit: number,
    bets: number = 1
  ): Promise<void> {
    const supabase = await createClient()
    const now = new Date()
    const trackingDate = now.toISOString().split('T')[0]
    const trackingHour = now.getHours()
    
    // Calculate real-time platform share
    const config = await this.getApplicableConfig(tenantId, 'lottery')
    const platformSharePercent = config?.platform_share_percent || 15
    const platformShareRealtime = profit * (platformSharePercent / 100)
    
    // Upsert hourly record
    await supabase
      .from('live_revenue_tracking')
      .upsert({
        tenant_id: tenantId,
        tracking_date: trackingDate,
        tracking_hour: trackingHour,
        hourly_turnover: turnover,
        hourly_wins: wins,
        hourly_profit: profit,
        hourly_bets: bets,
        platform_share_realtime: platformShareRealtime,
        updated_at: now.toISOString()
      }, {
        onConflict: 'tenant_id,tracking_date,tracking_hour'
      })
    
    // Update daily totals using RPC or separate query
    const { data: dailyData } = await supabase
      .from('live_revenue_tracking')
      .select('hourly_turnover, hourly_wins, hourly_profit, hourly_bets')
      .eq('tenant_id', tenantId)
      .eq('tracking_date', trackingDate)
    
    if (dailyData) {
      const dailyTotals = dailyData.reduce((acc, row) => ({
        turnover: acc.turnover + Number(row.hourly_turnover || 0),
        wins: acc.wins + Number(row.hourly_wins || 0),
        profit: acc.profit + Number(row.hourly_profit || 0),
        bets: acc.bets + Number(row.hourly_bets || 0)
      }), { turnover: 0, wins: 0, profit: 0, bets: 0 })
      
      await supabase
        .from('live_revenue_tracking')
        .update({
          daily_turnover: dailyTotals.turnover,
          daily_wins: dailyTotals.wins,
          daily_profit: dailyTotals.profit,
          daily_bets: dailyTotals.bets
        })
        .eq('tenant_id', tenantId)
        .eq('tracking_date', trackingDate)
        .eq('tracking_hour', trackingHour)
    }
  }
  
  /**
   * Get live revenue for a tenant
   */
  static async getLiveRevenue(tenantId: string, date?: string): Promise<{
    hourly: Array<{ hour: number; turnover: number; profit: number }>
    daily: { turnover: number; wins: number; profit: number; bets: number; platformShare: number }
  }> {
    const supabase = await createClient()
    const trackingDate = date || new Date().toISOString().split('T')[0]
    
    const { data } = await supabase
      .from('live_revenue_tracking')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('tracking_date', trackingDate)
      .order('tracking_hour', { ascending: true })
    
    const hourly = (data || []).map(row => ({
      hour: row.tracking_hour,
      turnover: Number(row.hourly_turnover || 0),
      profit: Number(row.hourly_profit || 0)
    }))
    
    const latest = data?.[data.length - 1]
    const daily = {
      turnover: Number(latest?.daily_turnover || 0),
      wins: Number(latest?.daily_wins || 0),
      profit: Number(latest?.daily_profit || 0),
      bets: Number(latest?.daily_bets || 0),
      platformShare: Number(latest?.platform_share_realtime || 0)
    }
    
    return { hourly, daily }
  }
}

export default RevenueShareEngine
