/**
 * Centralized SWR Fetcher Utility
 * 
 * Use this fetcher for all authenticated API calls.
 * It includes credentials to ensure cookies are sent with requests.
 * 
 * Usage:
 * import { fetcher, publicFetcher } from '@/lib/fetcher';
 * 
 * // For authenticated APIs (most admin/operational pages)
 * const { data } = useSWR('/api/customers', fetcher);
 * 
 * // For public APIs (no auth required)
 * const { data } = useSWR('/api/lotteries', publicFetcher);
 */

/**
 * Authenticated fetcher - includes credentials for cookie-based auth
 * Use this for all admin, agent, and protected API endpoints
 */
export const fetcher = async (url: string) => {
  const res = await fetch(url, { 
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || 'Request failed');
  }
  
  return res.json();
};

/**
 * Authenticated fetcher that returns null on error instead of throwing
 * Useful for optional data that shouldn't break the page
 */
export const fetcherSafe = async (url: string) => {
  try {
    const res = await fetch(url, { 
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
};

/**
 * Public fetcher - for endpoints that don't require authentication
 * Use this for public APIs like lotteries, results, etc.
 */
export const publicFetcher = async (url: string) => {
  const res = await fetch(url);
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || 'Request failed');
  }
  
  return res.json();
};

/**
 * POST fetcher - for authenticated POST requests
 */
export const postFetcher = async (url: string, { arg }: { arg: unknown }) => {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(arg),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || 'Request failed');
  }
  
  return res.json();
};

/**
 * Default export for convenience
 */
export default fetcher;
