'use client';

import { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';

interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  domain: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  is_active: boolean;
}

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}).then(data => {
  if (data.error) throw new Error(data.error);
  return data;
});

export default function TenantLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const slug = params.slug as string;
  
  const { data: tenant, isLoading, error } = useSWR<TenantSettings>(
    `/api/tenant/${slug}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-amber-500 mb-2">ไม่พบเว็บไซต์</h1>
          <p className="text-gray-400">เว็บไซต์นี้ไม่มีอยู่หรือถูกปิดใช้งาน</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen"
      style={{
        '--tenant-primary': tenant.primary_color || '#f59e0b',
        '--tenant-secondary': tenant.secondary_color || '#1a1a2e',
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
