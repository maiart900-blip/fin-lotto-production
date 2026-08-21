/**
 * Custom React Hooks
 * Reusable hooks for common patterns
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import useSWR, { SWRConfiguration } from 'swr';

// Generic fetcher for SWR
const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('API request failed');
    const data = await res.json().catch(() => ({}));
    (error as Error & { info?: unknown; status?: number }).info = data;
    (error as Error & { info?: unknown; status?: number }).status = res.status;
    throw error;
  }
  const data = await res.json();
  return data.data ?? data;
};

// Hook for API data fetching with loading/error states
export function useApi<T>(
  url: string | null,
  config?: SWRConfiguration
) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<T>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      ...config,
    }
  );

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
    isEmpty: !isLoading && !data,
  };
}

// Hook for paginated data
export function usePaginatedApi<T>(
  baseUrl: string,
  initialPage: number = 1,
  limit: number = 20
) {
  const [page, setPage] = useState(initialPage);
  const url = `${baseUrl}?page=${page}&limit=${limit}`;

  const { data, error, isLoading, mutate } = useApi<{
    data: T[];
    meta: { total: number; hasMore: boolean };
  }>(url);

  return {
    items: data?.data ?? [],
    total: data?.meta?.total ?? 0,
    hasMore: data?.meta?.hasMore ?? false,
    page,
    setPage,
    nextPage: () => setPage(p => p + 1),
    prevPage: () => setPage(p => Math.max(1, p - 1)),
    isLoading,
    error,
    mutate,
  };
}

// Debounce hook
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Local storage hook with SSR safety
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch {
      // Ignore errors
    }
  }, [key]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch {
        // Ignore errors
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue];
}

// Toggle hook
export function useToggle(initialValue: boolean = false): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useState(initialValue);
  const toggle = useCallback(() => setValue(v => !v), []);
  return [value, toggle, setValue];
}

// Previous value hook
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

// Media query hook
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}

// Common breakpoint hooks
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 768px)');
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

// Async operation hook with loading state
export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<TResult | null>(null);

  const execute = useCallback(
    async (...args: TArgs) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await action(...args);
        setResult(res);
        return res;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [action]
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setResult(null);
  }, []);

  return { execute, isLoading, error, result, reset };
}

// Clipboard hook
export function useClipboard() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { copy, copied };
}

// Countdown hook
export function useCountdown(
  initialSeconds: number,
  onComplete?: () => void
): [number, () => void, () => void, () => void] {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => {
    setIsRunning(false);
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => s - 1);
      }, 1000);
    } else if (seconds === 0) {
      setIsRunning(false);
      onComplete?.();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, seconds, onComplete]);

  return [seconds, start, pause, reset];
}