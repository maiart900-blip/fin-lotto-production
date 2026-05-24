'use client';

import useSWR from 'swr';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Entry {
  id: string;
  number: string;
  bet_type: string;
  amount: number;
  customer_id?: string;
  lottery_id?: string;
  user_id?: string;
  status?: string;
  payout_rate?: number;
  created_at?: string;
}

interface AddEntriesParams {
  entries: Array<{
    number: string;
    betType: string;
    amount: number;
    payoutRate?: number;
  }>;
  userId?: string;
  lotteryId?: string;
  customerId?: string;
}

export function useEntries(customerId?: string) {
  const url = customerId ? `/api/entries?customer_id=${customerId}` : '/api/entries';
  
  const { data, error, isLoading, mutate } = useSWR<Entry[]>(url, fetcher, {
    revalidateOnFocus: false,
    fallbackData: [],
  });

  const addEntries = async (params: AddEntriesParams) => {
    try {
      const response = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'ไม่สามารถบันทึกโพยได้');
        return { success: false, error: result.error };
      }

      toast.success(result.message || 'บันทึกโพยสำเร็จ', {
        style: {
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          color: '#D4AF37',
        },
      });

      // Refresh entries list
      mutate();

      return { success: true, data: result };
    } catch (err) {
      console.error('[v0] addEntries error:', err);
      toast.error('เกิดข้อผิดพลาดในการบันทึกโพย');
      return { success: false, error: 'เกิดข้อผิดพลาด' };
    }
  };

  const deleteEntries = async (ids: string[]) => {
    try {
      const response = await fetch('/api/entries', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        toast.error('ไม่สามารถลบโพยได้');
        return { success: false };
      }

      toast.success('ลบโพยสำเร็จ');
      mutate();

      return { success: true };
    } catch (err) {
      console.error('[v0] deleteEntries error:', err);
      toast.error('เกิดข้อผิดพลาดในการลบโพย');
      return { success: false };
    }
  };

  return {
    entries: data || [],
    isLoading,
    error,
    mutate,
    addEntries,
    deleteEntries,
  };
}
