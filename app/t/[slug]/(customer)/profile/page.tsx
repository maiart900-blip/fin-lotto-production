'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { User, Phone, CreditCard, Building2, Copy, Check, LogOut, Key, Gift, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface CustomerInfo {
  id: string;
  name?: string;
  username: string;
  phone: string;
  credit_balance: number;
  bank_code: string;
  bank_account_number: string;
  bank_account_name: string;
  referral_code: string;
  created_at: string;
}

const BANK_NAMES: Record<string, string> = {
  'KBANK': 'ธนาคารกสิกรไทย',
  'SCB': 'ธนาคารไทยพาณิชย์',
  'KTB': 'ธนาคารกรุงไทย',
  'BBL': 'ธนาคารกรุงเทพ',
  'BAY': 'ธนาคารกรุงศรี',
  'TMB': 'ธนาคารทหารไทยธนชาต',
  'GSB': 'ธนาคารออมสิน',
};

export default function TenantProfilePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchCustomer();
  }, [slug]);

  const fetchCustomer = async () => {
    try {
      const res = await fetch(`/api/tenant/${slug}/customer/me`);
      if (res.ok) {
        const data = await res.json();
        setCustomer(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('คัดลอกแล้ว');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    await fetch(`/api/tenant/${slug}/customer/logout`, { method: 'POST' });
    router.push(`/t/${slug}/login`);
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  const menuItems = [
    { icon: CreditCard, label: 'ฝากเงิน', href: `/t/${slug}/deposit` },
    { icon: Building2, label: 'ถอนเงิน', href: `/t/${slug}/withdraw` },
    { icon: Key, label: 'เปลี่ยนรหัสผ่าน', href: `/t/${slug}/profile/password` },
    { icon: Gift, label: 'แนะนำเพื่อน', href: `/t/${slug}/profile/referral` },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-2xl p-6 text-center">
        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mb-3">
          <User className="h-10 w-10 text-black" />
        </div>
        <h2 className="text-xl font-bold">{customer?.username || customer?.name || 'User'}</h2>
        <p className="text-gray-400 text-sm flex items-center justify-center gap-1">
          <Phone className="h-3 w-3" />
          {customer?.phone}
        </p>
        <div className="mt-4">
          <p className="text-xs text-gray-400">ยอดเครดิต</p>
          <p className="text-3xl font-bold text-amber-400">
            {customer?.credit_balance?.toLocaleString() || 0}
            <span className="text-lg ml-1">บาท</span>
          </p>
        </div>
      </div>

      {/* Referral Code */}
      {customer?.referral_code && (
        <div className="bg-[#1a1a3a] rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">รหัสแนะนำเพื่อน</p>
              <p className="font-mono text-lg font-bold text-amber-400">{customer.referral_code}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(customer.referral_code)}
              className="border-white/20"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Bank Account */}
      <div className="bg-[#1a1a3a] rounded-xl p-4">
        <p className="text-sm text-gray-400 mb-3">บัญชีธนาคาร</p>
        {customer?.bank_account_number ? (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-green-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{BANK_NAMES[customer.bank_code] || customer.bank_code}</p>
              <p className="text-sm text-gray-400">{customer.bank_account_number}</p>
              <p className="text-xs text-gray-500">{customer.bank_account_name}</p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-2">ยังไม่ได้เพิ่มบัญชีธนาคาร</p>
        )}
      </div>

      {/* Menu Items */}
      <div className="bg-[#1a1a3a] rounded-xl overflow-hidden">
        {menuItems.map((item, index) => (
          <button
            key={item.label}
            onClick={() => router.push(item.href)}
            className={`w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors ${
              index !== menuItems.length - 1 ? 'border-b border-white/5' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-5 w-5 text-gray-400" />
              <span>{item.label}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-500" />
          </button>
        ))}
      </div>

      {/* Account Info */}
      <div className="bg-[#1a1a3a] rounded-xl p-4">
        <p className="text-sm text-gray-400 mb-2">ข้อมูลบัญชี</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">วันที่สมัคร</span>
            <span>{customer?.created_at ? new Date(customer.created_at).toLocaleDateString('th-TH') : '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">UID</span>
            <span className="font-mono text-xs">{customer?.id?.slice(0, 8)}</span>
          </div>
        </div>
      </div>

      {/* Logout */}
      <Button
        variant="outline"
        onClick={handleLogout}
        className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
      >
        <LogOut className="h-4 w-4 mr-2" />
        ออกจากระบบ
      </Button>
    </div>
  );
}
