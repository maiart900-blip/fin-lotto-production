/**
 * Geo Tracking & Blocking System
 * ตรวจสอบประเทศ/พื้นที่เสี่ยง และบล็อกการเข้าถึง
 * Production Ready
 */

import { Redis } from '@upstash/redis';
import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Geo Data Types
export interface GeoLocation {
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isp: string;
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  isDatacenter: boolean;
  riskScore: number;
}

export interface GeoRule {
  id: string;
  type: 'country' | 'region' | 'city' | 'ip_range' | 'isp';
  value: string;
  action: 'block' | 'allow' | 'flag' | 'require_verification';
  reason?: string;
  createdAt: string;
  createdBy: string;
  isActive: boolean;
}

export interface GeoAccessLog {
  id: string;
  userId?: string;
  ip: string;
  location: GeoLocation;
  action: string;
  blocked: boolean;
  blockReason?: string;
  userAgent: string;
  timestamp: string;
}

// Default blocked countries (can be configured in database)
const DEFAULT_BLOCKED_COUNTRIES = [
  'KP', // North Korea
  'IR', // Iran
  'CU', // Cuba
  'SY', // Syria
];

// High risk countries (require extra verification)
const HIGH_RISK_COUNTRIES = [
  'NG', // Nigeria
  'PK', // Pakistan
  'BD', // Bangladesh
  'VN', // Vietnam
];

/**
 * Get IP from request headers
 */
export async function getClientIP(): Promise<string> {
  const headersList = await headers();
  
  // Check various headers for real IP
  const forwardedFor = headersList.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = headersList.get('x-real-ip');
  if (realIP) return realIP;
  
  const cfConnectingIP = headersList.get('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;
  
  return '127.0.0.1';
}

/**
 * Lookup IP Geolocation
 * Uses ip-api.com (free) or ipinfo.io (paid)
 */
export async function lookupGeoLocation(ip: string): Promise<GeoLocation | null> {
  // Check cache first
  const cacheKey = `geo:${ip}`;
  const cached = await redis.get<GeoLocation>(cacheKey);
  if (cached) return cached;
  
  try {
    // Use ip-api.com (free, 45 requests per minute)
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,as,proxy,hosting,query`,
      { next: { revalidate: 3600 } } // Cache for 1 hour
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.status === 'fail') return null;
    
    const geoLocation: GeoLocation = {
      ip: data.query || ip,
      country: data.country || 'Unknown',
      countryCode: data.countryCode || 'XX',
      region: data.regionName || 'Unknown',
      city: data.city || 'Unknown',
      latitude: data.lat || 0,
      longitude: data.lon || 0,
      timezone: data.timezone || 'UTC',
      isp: data.isp || 'Unknown',
      isVpn: false, // Basic API doesn't provide this
      isProxy: data.proxy || false,
      isTor: false, // Would need separate check
      isDatacenter: data.hosting || false,
      riskScore: calculateRiskScore(data),
    };
    
    // Cache for 24 hours
    await redis.setex(cacheKey, 86400, geoLocation);
    
    return geoLocation;
    
  } catch (error) {
    console.error('[Geo] Lookup failed:', error);
    return null;
  }
}

/**
 * Calculate Risk Score based on geo data
 */
function calculateRiskScore(geoData: Record<string, unknown>): number {
  let score = 0;
  
  // Proxy/VPN detection
  if (geoData.proxy) score += 30;
  if (geoData.hosting) score += 20; // Datacenter IP
  
  // High risk country
  if (HIGH_RISK_COUNTRIES.includes(geoData.countryCode as string)) {
    score += 25;
  }
  
  // Blocked country
  if (DEFAULT_BLOCKED_COUNTRIES.includes(geoData.countryCode as string)) {
    score += 50;
  }
  
  return Math.min(score, 100);
}

/**
 * Check if access should be blocked
 */
export async function checkGeoAccess(
  ip: string,
  userId?: string
): Promise<{
  allowed: boolean;
  reason?: string;
  requiresVerification: boolean;
  location: GeoLocation | null;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}> {
  const location = await lookupGeoLocation(ip);
  
  if (!location) {
    return {
      allowed: true,
      location: null,
      requiresVerification: false,
      riskLevel: 'low',
    };
  }
  
  const supabase = await createClient();
  
  // Get custom rules from database
  const { data: rules } = await supabase
    .from('geo_rules')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  
  // Check against rules
  if (rules) {
    for (const rule of rules) {
      let matches = false;
      
      switch (rule.type) {
        case 'country':
          matches = location.countryCode === rule.value;
          break;
        case 'region':
          matches = location.region.toLowerCase() === rule.value.toLowerCase();
          break;
        case 'city':
          matches = location.city.toLowerCase() === rule.value.toLowerCase();
          break;
        case 'isp':
          matches = location.isp.toLowerCase().includes(rule.value.toLowerCase());
          break;
        case 'ip_range':
          matches = ipInRange(ip, rule.value);
          break;
      }
      
      if (matches) {
        if (rule.action === 'block') {
          await logGeoAccess(ip, location, 'blocked', true, rule.reason || 'Matched block rule', userId);
          return {
            allowed: false,
            reason: rule.reason || `Access blocked: ${rule.type} rule`,
            requiresVerification: false,
            location,
            riskLevel: 'critical',
          };
        }
        
        if (rule.action === 'require_verification') {
          return {
            allowed: true,
            requiresVerification: true,
            location,
            riskLevel: 'high',
          };
        }
        
        if (rule.action === 'flag') {
          // Log but allow
          await logGeoAccess(ip, location, 'flagged', false, rule.reason, userId);
        }
      }
    }
  }
  
  // Check default blocked countries
  if (DEFAULT_BLOCKED_COUNTRIES.includes(location.countryCode)) {
    await logGeoAccess(ip, location, 'blocked', true, 'Blocked country', userId);
    return {
      allowed: false,
      reason: 'Access not available in your region',
      requiresVerification: false,
      location,
      riskLevel: 'critical',
    };
  }
  
  // Check for proxy/VPN
  if (location.isProxy || location.isVpn || location.isTor) {
    await logGeoAccess(ip, location, 'flagged_proxy', false, 'Proxy/VPN detected', userId);
    return {
      allowed: true,
      requiresVerification: true,
      reason: 'VPN/Proxy detected - additional verification required',
      location,
      riskLevel: 'high',
    };
  }
  
  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (location.riskScore >= 70) riskLevel = 'critical';
  else if (location.riskScore >= 50) riskLevel = 'high';
  else if (location.riskScore >= 25) riskLevel = 'medium';
  
  // Log access
  await logGeoAccess(ip, location, 'allowed', false, undefined, userId);
  
  return {
    allowed: true,
    requiresVerification: HIGH_RISK_COUNTRIES.includes(location.countryCode),
    location,
    riskLevel,
  };
}

/**
 * Check if IP is in CIDR range
 */
function ipInRange(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  
  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);
  
  return (ipNum & mask) === (rangeNum & mask);
}

function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
}

/**
 * Log Geo Access
 */
async function logGeoAccess(
  ip: string,
  location: GeoLocation,
  action: string,
  blocked: boolean,
  blockReason?: string,
  userId?: string
): Promise<void> {
  const supabase = await createClient();
  const headersList = await headers();
  
  await supabase.from('geo_access_logs').insert({
    user_id: userId || null,
    ip_address: ip,
    country: location.country,
    country_code: location.countryCode,
    region: location.region,
    city: location.city,
    latitude: location.latitude,
    longitude: location.longitude,
    isp: location.isp,
    is_proxy: location.isProxy,
    is_vpn: location.isVpn,
    risk_score: location.riskScore,
    action: action,
    blocked: blocked,
    block_reason: blockReason,
    user_agent: headersList.get('user-agent') || 'Unknown',
    created_at: new Date().toISOString(),
  });
}

/**
 * Add Geo Rule
 */
export async function addGeoRule(
  rule: Omit<GeoRule, 'id' | 'createdAt'>
): Promise<{ success: boolean; ruleId?: string; error?: string }> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('geo_rules')
    .insert({
      type: rule.type,
      value: rule.value,
      action: rule.action,
      reason: rule.reason,
      is_active: rule.isActive,
      created_by: rule.createdBy,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  // Clear cache for affected IPs
  await redis.del('geo:rules:cache');
  
  return { success: true, ruleId: data.id };
}

/**
 * Remove Geo Rule
 */
export async function removeGeoRule(ruleId: string): Promise<boolean> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('geo_rules')
    .update({ is_active: false })
    .eq('id', ruleId);
  
  return !error;
}

/**
 * Get Geo Rules
 */
export async function getGeoRules(activeOnly = true): Promise<GeoRule[]> {
  const supabase = await createClient();
  
  let query = supabase.from('geo_rules').select('*').order('created_at', { ascending: false });
  
  if (activeOnly) {
    query = query.eq('is_active', true);
  }
  
  const { data } = await query;
  
  return (data || []).map(row => ({
    id: row.id,
    type: row.type,
    value: row.value,
    action: row.action,
    reason: row.reason,
    createdAt: row.created_at,
    createdBy: row.created_by,
    isActive: row.is_active,
  }));
}

/**
 * Get Geo Access Statistics
 */
export async function getGeoStats(days = 7): Promise<{
  totalAccess: number;
  blocked: number;
  flagged: number;
  byCountry: Array<{ country: string; count: number }>;
  byRiskLevel: Array<{ level: string; count: number }>;
  topBlockedIPs: Array<{ ip: string; count: number }>;
}> {
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  // Total access
  const { count: totalAccess } = await supabase
    .from('geo_access_logs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since.toISOString());
  
  // Blocked
  const { count: blocked } = await supabase
    .from('geo_access_logs')
    .select('id', { count: 'exact', head: true })
    .eq('blocked', true)
    .gte('created_at', since.toISOString());
  
  // Flagged
  const { count: flagged } = await supabase
    .from('geo_access_logs')
    .select('id', { count: 'exact', head: true })
    .like('action', '%flag%')
    .gte('created_at', since.toISOString());
  
  // By country (top 10)
  const { data: countryData } = await supabase
    .from('geo_access_logs')
    .select('country_code')
    .gte('created_at', since.toISOString());
  
  const countryCounts: Record<string, number> = {};
  (countryData || []).forEach(row => {
    countryCounts[row.country_code] = (countryCounts[row.country_code] || 0) + 1;
  });
  
  const byCountry = Object.entries(countryCounts)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // By risk level
  const { data: riskData } = await supabase
    .from('geo_access_logs')
    .select('risk_score')
    .gte('created_at', since.toISOString());
  
  const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 };
  (riskData || []).forEach(row => {
    if (row.risk_score >= 70) riskCounts.critical++;
    else if (row.risk_score >= 50) riskCounts.high++;
    else if (row.risk_score >= 25) riskCounts.medium++;
    else riskCounts.low++;
  });
  
  const byRiskLevel = Object.entries(riskCounts).map(([level, count]) => ({ level, count }));
  
  // Top blocked IPs
  const { data: blockedIPData } = await supabase
    .from('geo_access_logs')
    .select('ip_address')
    .eq('blocked', true)
    .gte('created_at', since.toISOString());
  
  const ipCounts: Record<string, number> = {};
  (blockedIPData || []).forEach(row => {
    ipCounts[row.ip_address] = (ipCounts[row.ip_address] || 0) + 1;
  });
  
  const topBlockedIPs = Object.entries(ipCounts)
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return {
    totalAccess: totalAccess || 0,
    blocked: blocked || 0,
    flagged: flagged || 0,
    byCountry,
    byRiskLevel,
    topBlockedIPs,
  };
}

/**
 * Middleware helper for route protection
 */
export async function geoProtectRoute(
  allowedCountries?: string[]
): Promise<{ allowed: boolean; reason?: string }> {
  const ip = await getClientIP();
  const result = await checkGeoAccess(ip);
  
  if (!result.allowed) {
    return { allowed: false, reason: result.reason };
  }
  
  // Check if country is in allowed list (if specified)
  if (allowedCountries && result.location) {
    if (!allowedCountries.includes(result.location.countryCode)) {
      return { 
        allowed: false, 
        reason: 'This service is not available in your region' 
      };
    }
  }
  
  return { allowed: true };
}
