import { createClient } from '@/lib/supabase/server';
import { createHash, randomBytes } from 'crypto';

/**
 * Site API Key Authentication
 * 
 * Used for authenticating child auto sites when they push risk data to FIN LOTTO.
 * 
 * Key format: flk_[site_id]_[32 random chars]
 * Example: flk_meetang_abc123def456ghi789jkl012mno345
 */

export interface SiteApiKey {
  id: string;
  site_id: string;
  site_name: string;
  site_type: 'child_auto' | 'external_partner';
  is_active: boolean;
  rate_limit_per_minute: number;
  last_used_at: string | null;
}

/**
 * Generate a new API key for a site
 */
export function generateApiKey(siteId: string): { key: string; hash: string; prefix: string } {
  const randomPart = randomBytes(24).toString('hex'); // 48 chars
  const key = `flk_${siteId}_${randomPart}`;
  const hash = hashApiKey(key);
  const prefix = key.substring(0, 16); // flk_[site]_[8ch]
  
  return { key, hash, prefix };
}

/**
 * Hash an API key for storage
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Validate API key and return site info
 */
export async function validateApiKey(apiKey: string): Promise<{
  valid: boolean;
  site?: SiteApiKey;
  error?: string;
}> {
  if (!apiKey || !apiKey.startsWith('flk_')) {
    return { valid: false, error: 'Invalid API key format' };
  }
  
  const hash = hashApiKey(apiKey);
  const prefix = apiKey.substring(0, 16);
  
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('site_api_keys')
    .select('*')
    .eq('api_key_hash', hash)
    .eq('api_key_prefix', prefix)
    .eq('is_active', true)
    .is('revoked_at', null)
    .single();
  
  if (error || !data) {
    return { valid: false, error: 'Invalid or revoked API key' };
  }
  
  // Update last_used_at
  await supabase
    .from('site_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);
  
  return {
    valid: true,
    site: {
      id: data.id,
      site_id: data.site_id,
      site_name: data.site_name,
      site_type: data.site_type,
      is_active: data.is_active,
      rate_limit_per_minute: data.rate_limit_per_minute,
      last_used_at: data.last_used_at,
    },
  };
}

/**
 * Create a new site API key
 */
export async function createSiteApiKey(params: {
  site_id: string;
  site_name: string;
  site_type: 'child_auto' | 'external_partner';
  contact_email?: string;
  webhook_url?: string;
  created_by?: string;
}): Promise<{ success: boolean; key?: string; error?: string }> {
  const supabase = await createClient();
  
  // Check if site_id already exists
  const { data: existing } = await supabase
    .from('site_api_keys')
    .select('id')
    .eq('site_id', params.site_id)
    .is('revoked_at', null)
    .single();
  
  if (existing) {
    return { success: false, error: 'Site ID already has an active API key' };
  }
  
  const { key, hash, prefix } = generateApiKey(params.site_id);
  
  const { error } = await supabase
    .from('site_api_keys')
    .insert({
      site_id: params.site_id,
      site_name: params.site_name,
      site_type: params.site_type,
      api_key_hash: hash,
      api_key_prefix: prefix,
      contact_email: params.contact_email,
      webhook_url: params.webhook_url,
      created_by: params.created_by,
    });
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  // Return the key only once - it cannot be retrieved later
  return { success: true, key };
}

/**
 * Revoke a site API key
 */
export async function revokeSiteApiKey(params: {
  site_id: string;
  revoked_by?: string;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('site_api_keys')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoked_by: params.revoked_by,
      revoke_reason: params.reason,
    })
    .eq('site_id', params.site_id)
    .is('revoked_at', null);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

/**
 * List all site API keys (without the actual keys)
 */
export async function listSiteApiKeys(): Promise<{
  keys: Array<{
    id: string;
    site_id: string;
    site_name: string;
    site_type: string;
    api_key_prefix: string;
    is_active: boolean;
    created_at: string;
    last_used_at: string | null;
  }>;
  error?: string;
}> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('site_api_keys')
    .select('id, site_id, site_name, site_type, api_key_prefix, is_active, created_at, last_used_at')
    .order('created_at', { ascending: false });
  
  if (error) {
    return { keys: [], error: error.message };
  }
  
  return { keys: data || [] };
}

/**
 * Middleware helper for API routes
 */
export async function requireSiteApiKey(request: Request): Promise<{
  authenticated: boolean;
  site?: SiteApiKey;
  error?: string;
}> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, error: 'Missing Authorization header' };
  }
  
  const apiKey = authHeader.substring(7);
  const result = await validateApiKey(apiKey);
  return {
    authenticated: result.valid,
    site: result.site,
    error: result.error,
  };
}

