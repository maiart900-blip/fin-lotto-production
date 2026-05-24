'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { Customer, LotteryEntry, AppSettings, BetType, NumberSummary, DailySummary } from '@/types/lottery';

interface LotteryState {
  entries: LotteryEntry[];
  customers: Customer[];
  settings: AppSettings;
}

const STORAGE_KEY = 'lottery-app-data';

const defaultSettings: AppSettings = {
  siteName: 'สลากพลัส Lotto',
  userName: 'ผู้ดูแลระบบ',
};

const defaultState: LotteryState = {
  entries: [],
  customers: [],
  settings: defaultSettings,
};

let state: LotteryState = defaultState;
const listeners: Set<() => void> = new Set();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function loadFromStorage(): LotteryState {
  if (typeof window === 'undefined') return defaultState;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultState, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load from storage:', e);
  }
  return defaultState;
}

function saveToStorage(newState: LotteryState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  } catch (e) {
    console.error('Failed to save to storage:', e);
  }
}

function setState(newState: Partial<LotteryState>) {
  state = { ...state, ...newState };
  saveToStorage(state);
  emitChange();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return defaultState;
}

// Initialize state from storage
if (typeof window !== 'undefined') {
  state = loadFromStorage();
}

// Actions
function addEntry(entry: Omit<LotteryEntry, 'id' | 'createdAt'>) {
  const newEntry: LotteryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  setState({ entries: [...state.entries, newEntry] });
  return newEntry;
}

function updateEntry(id: string, updates: Partial<LotteryEntry>) {
  setState({
    entries: state.entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
  });
}

function deleteEntry(id: string) {
  setState({ entries: state.entries.filter((e) => e.id !== id) });
}

function duplicateEntry(id: string) {
  const entry = state.entries.find((e) => e.id === id);
  if (entry) {
    addEntry({
      customerId: entry.customerId,
      customerName: entry.customerName,
      customerPhone: entry.customerPhone,
      number: entry.number,
      betType: entry.betType,
      amount: entry.amount,
      note: entry.note,
    });
  }
}

function addCustomer(customer: Omit<Customer, 'id' | 'createdAt'>) {
  const newCustomer: Customer = {
    ...customer,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  setState({ customers: [...state.customers, newCustomer] });
  return newCustomer;
}

function updateCustomer(id: string, updates: Partial<Customer>) {
  setState({
    customers: state.customers.map((c) => (c.id === id ? { ...c, ...updates } : c)),
  });
}

function deleteCustomer(id: string) {
  setState({ customers: state.customers.filter((c) => c.id !== id) });
}

function updateSettings(updates: Partial<AppSettings>) {
  setState({ settings: { ...state.settings, ...updates } });
}

function clearAllData() {
  setState({ entries: [], customers: [] });
}

function exportData(): string {
  return JSON.stringify({
    entries: state.entries,
    customers: state.customers,
    settings: state.settings,
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

function importData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (data.entries && data.customers) {
      setState({
        entries: data.entries,
        customers: data.customers,
        settings: data.settings || state.settings,
      });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Selectors
function getEntriesByCustomer(customerId: string): LotteryEntry[] {
  return state.entries.filter((e) => e.customerId === customerId);
}

function getCustomerTotal(customerId: string): number {
  return state.entries
    .filter((e) => e.customerId === customerId)
    .reduce((sum, e) => sum + e.amount, 0);
}

function getTotalByBetType(betType: BetType): number {
  return state.entries
    .filter((e) => e.betType === betType)
    .reduce((sum, e) => sum + e.amount, 0);
}

function getGrandTotal(): number {
  return state.entries.reduce((sum, e) => sum + e.amount, 0);
}

function getNumberSummaries(): NumberSummary[] {
  const summaryMap = new Map<string, NumberSummary>();
  
  state.entries.forEach((entry) => {
    const key = `${entry.number}-${entry.betType}`;
    const existing = summaryMap.get(key);
    if (existing) {
      existing.totalAmount += entry.amount;
      existing.count += 1;
    } else {
      summaryMap.set(key, {
        number: entry.number,
        betType: entry.betType,
        totalAmount: entry.amount,
        count: 1,
      });
    }
  });
  
  return Array.from(summaryMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
}

function getDailySummaries(): DailySummary[] {
  const summaryMap = new Map<string, DailySummary>();
  
  state.entries.forEach((entry) => {
    const date = entry.createdAt.split('T')[0];
    const existing = summaryMap.get(date);
    if (existing) {
      existing.totalAmount += entry.amount;
      existing.count += 1;
    } else {
      summaryMap.set(date, {
        date,
        totalAmount: entry.amount,
        count: 1,
      });
    }
  });
  
  return Array.from(summaryMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function getTopNumbers(limit: number = 10): NumberSummary[] {
  return getNumberSummaries().slice(0, limit);
}

export function useLotteryStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  
  return {
    // State
    entries: snapshot.entries,
    customers: snapshot.customers,
    settings: snapshot.settings,
    
    // Entry actions
    addEntry: useCallback(addEntry, []),
    updateEntry: useCallback(updateEntry, []),
    deleteEntry: useCallback(deleteEntry, []),
    duplicateEntry: useCallback(duplicateEntry, []),
    
    // Customer actions
    addCustomer: useCallback(addCustomer, []),
    updateCustomer: useCallback(updateCustomer, []),
    deleteCustomer: useCallback(deleteCustomer, []),
    
    // Settings actions
    updateSettings: useCallback(updateSettings, []),
    clearAllData: useCallback(clearAllData, []),
    exportData: useCallback(exportData, []),
    importData: useCallback(importData, []),
    
    // Selectors
    getEntriesByCustomer: useCallback(getEntriesByCustomer, []),
    getCustomerTotal: useCallback(getCustomerTotal, []),
    getTotalByBetType: useCallback(getTotalByBetType, []),
    getGrandTotal: useCallback(getGrandTotal, []),
    getNumberSummaries: useCallback(getNumberSummaries, []),
    getDailySummaries: useCallback(getDailySummaries, []),
    getTopNumbers: useCallback(getTopNumbers, []),
  };
}
