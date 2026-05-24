import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('th-TH').format(num)
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Convert slip_url (pathname or full URL) to displayable URL
export function getSlipUrl(slipUrl: string | null | undefined): string | null {
  if (!slipUrl) return null;
  // If it's already a full URL, return as-is
  if (slipUrl.startsWith('http://') || slipUrl.startsWith('https://')) {
    return slipUrl;
  }
  // Otherwise it's a pathname, use the file API
  return `/api/file?pathname=${encodeURIComponent(slipUrl)}`;
}
