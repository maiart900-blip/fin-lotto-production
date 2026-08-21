'use client';

import useSWR, { mutate as globalMutate } from 'swr';
import { BetType } from '@/types/lottery';

// Safe fetcher that handles errors gracefully
const fetcher = async (url: string) => {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`API Error ${url}:`, res.status, res.statusText);
      // Return empty data instead of throwing
      return url.includes('/settings') ? null : [];
    }
    const data = await res.json();
    // Check if data has error property
    if (data && data.error) {
      console.error(`API returned error ${url}:`, data.error);
      return url.includes('/settings') ? null : [];
    }
    return data;
  } catch (error) {
    console.error(`Fetch error ${url}:`, error);
    return url.includes('/settings') ? null : [];
  }
};

export interface Entry {
  id: string;
  number: string;
  bet_type: BetType;
  amount: number;
  customer_id: string | null;
  lottery_id: string | null;
  win_set_id: string | null;
  created_by: string | null;
  created_at: string;
  customer?: { id: string; name: string } | null;
  lottery?: { id: string; name: string } | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: number;
  site_name: string;
  updated_at: string;
  turnover_enabled?: boolean;
  turnover_percentage?: number;
}

export interface DbUser {
  id: string;
  username: string;
  display_name: string;
  role: 'admin' | 'staff';
  created_at: string;
}

// Entries hook
export function useEntries() {
  const { data, error, isLoading, mutate } = useSWR<Entry[]>('/api/entries', fetcher, {
    refreshInterval: 5000, // Auto refresh every 5 seconds for real-time sync
  });

  const addEntry = async (entry: { number: string; betType: BetType; amount: number; customerId?: string; lotteryId?: string; createdBy?: string }) => {
    const res = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error('Failed to add entry');
    await mutate();
    return res.json();
  };

  const addEntries = async (entries: { number: string; betType: BetType; amount: number; customerId?: string; lotteryId?: string; createdBy?: string }[]) => {
    const res = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entries),
    });
    if (!res.ok) throw new Error('Failed to add entries');
    await mutate();
    return res.json();
  };

  const updateEntry = async (id: string, entry: { number: string; betType: BetType; amount: number; customerId?: string }) => {
    const res = await fetch(`/api/entries/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error('Failed to update entry');
    await mutate();
    return res.json();
  };

  const deleteEntry = async (id: string) => {
    const res = await fetch(`/api/entries/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete entry');
    await mutate();
  };

  const deleteEntries = async (ids: string[]) => {
    const res = await fetch('/api/entries', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error('Failed to delete entries');
    await mutate();
  };

  return {
    entries: data || [],
    isLoading,
    isError: !!error,
    addEntry,
    addEntries,
    updateEntry,
    deleteEntry,
    deleteEntries,
    mutate,
  };
}

// Customers hook
export function useCustomers() {
  const { data, error, isLoading, mutate } = useSWR<Customer[]>('/api/customers', fetcher, {
    refreshInterval: 10000,
  });

  const addCustomer = async (customer: { name: string; phone?: string; note?: string }) => {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer),
    });
    if (!res.ok) throw new Error('Failed to add customer');
    await mutate();
    return res.json();
  };

  const updateCustomer = async (id: string, customer: { name: string; phone?: string; note?: string }) => {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer),
    });
    if (!res.ok) throw new Error('Failed to update customer');
    await mutate();
    return res.json();
  };

  const deleteCustomer = async (id: string) => {
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete customer');
    await mutate();
  };

  return {
    customers: data || [],
    isLoading,
    isError: !!error,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    mutate,
  };
}

// Settings hook
export function useSettings() {
  const { data, error, isLoading, mutate } = useSWR<Settings>('/api/settings', fetcher);

  const updateSettings = async (settings: {
  siteName: string;
  turnover_enabled?: boolean;
  turnover_percentage?: number;
}) => {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    await mutate();
    return res.json();
  };

  return {
    settings: data || { id: 1, site_name: 'สลากพลัส Lotto', updated_at: '' },
    isLoading,
    isError: !!error,
    updateSettings,
    mutate,
  };
}

// Users hook
export function useUsers() {
  const { data, error, isLoading, mutate } = useSWR<DbUser[]>('/api/users', fetcher);

  const addUser = async (user: { username: string; password: string; displayName: string; role: 'admin' | 'staff' }) => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add user');
    await mutate();
    return data;
  };

  const updateUser = async (id: string, user: { displayName: string; role: 'admin' | 'staff'; password?: string }) => {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    if (!res.ok) throw new Error('Failed to update user');
    await mutate();
    return res.json();
  };

  const deleteUser = async (id: string) => {
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete user');
    await mutate();
  };

  return {
    users: data || [],
    isLoading,
    isError: !!error,
    addUser,
    updateUser,
    deleteUser,
    mutate,
  };
}

// Backup hook
export function useBackup() {
  const createBackup = async (userId?: string) => {
    const res = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error('Failed to create backup');
    return res.json();
  };

  const restoreBackup = async (backupData: unknown) => {
    const res = await fetch('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupData }),
    });
    if (!res.ok) throw new Error('Failed to restore backup');
    // Revalidate all data
    await globalMutate('/api/entries');
    await globalMutate('/api/customers');
    await globalMutate('/api/settings');
    return res.json();
  };

  const clearAllData = async () => {
    const res = await fetch('/api/clear-all', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to clear data');
    // Revalidate all data
    await globalMutate('/api/entries');
    await globalMutate('/api/customers');
    return res.json();
  };

  return {
    createBackup,
    restoreBackup,
    clearAllData,
  };
}
