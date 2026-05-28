'use client';

import { useState, useEffect } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Home, 
  CreditCard, 
  Wallet, 
  Ticket, 
  User, 
  History,
  LogOut,
  Menu,
  X,
  Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface TenantInfo {
  id: string;
  name: string;
  logo_url?: string;
  theme_config?: {
    primary_color?: string;
    secondary_color?: string;
  };
}

interface CustomerInfo {
  id: string;
  name?: string;
  username: string;
  phone: string;
  credit_balance: number;
}

export default function TenantCustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const slug = params.slug as string;
  const basePath = `/t/${slug}`;

  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch tenant info
        const tenantRes = await fetch(`/api/tenant/${slug}`);
        if (tenantRes.ok) {
          const tenantData = await tenantRes.json();
          setTenant(tenantData);
        }

        // Fetch customer info
        const customerRes = await fetch(`/api/tenant/${slug}/customer/me`);
        if (customerRes.ok) {
          const customerData = await customerRes.json();
          setCustomer(customerData);
        } else {
          // Not logged in - redirect to login
          router.push(`${basePath}/login`);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug, basePath, router]);

  const handleLogout = async () => {
    await fetch(`/api/tenant/${slug}/customer/logout`, { method: 'POST' });
    router.push(`${basePath}/login`);
  };

  const navItems = [
    { href: '', icon: Home, label: 'หน้าหลัก' },
    { href: '/bet', icon: Ticket, label: 'แทงหวย' },
    { href: '/deposit', icon: CreditCard, label: 'ฝากเงิน' },
    { href: '/withdraw', icon: Wallet, label: 'ถอนเงิน' },
    { href: '/history', icon: History, label: 'ประวัติ' },
    { href: '/profile', icon: User, label: 'โปรไฟล์' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-[#D4AF37]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 text-gray-900 flex flex-col">
      {/* Header - White with Gold accent */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b-4 border-[#D4AF37] shadow-lg">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo/Name */}
          <Link href={basePath} className="flex items-center gap-3">
            {tenant?.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="h-10 w-10 rounded-lg border-2 border-[#D4AF37]" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center text-white font-bold text-lg shadow-md">
                {tenant?.name?.charAt(0) || 'T'}
              </div>
            )}
            <span className="font-bold text-lg text-gray-800">{tenant?.name}</span>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Credit Display - Gold themed */}
            <div className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] px-4 py-2 rounded-xl shadow-md">
              <span className="text-white font-bold text-sm">
                {customer?.credit_balance?.toLocaleString() || 0}
              </span>
              <span className="text-white/80 text-xs ml-1">บาท</span>
            </div>

            {/* Notification */}
            <Button variant="ghost" size="icon" className="text-[#D4AF37] hover:text-[#B8860B] hover:bg-[#D4AF37]/10">
              <Bell className="h-5 w-5" />
            </Button>

            {/* Mobile Menu */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-[#D4AF37] hover:text-[#B8860B] md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t-2 border-[#D4AF37]/30 py-2 shadow-lg">
            <div className="container mx-auto px-4 space-y-1">
              {navItems.map((item) => {
                const href = `${basePath}${item.href}`;
                const isActive = pathname === href || (item.href && pathname.startsWith(href));
                
                return (
                  <Link
                    key={item.href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                      isActive 
                        ? "bg-[#D4AF37]/20 text-[#B8860B] border-2 border-[#D4AF37]" 
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-all"
              >
                <LogOut className="h-5 w-5" />
                ออกจากระบบ
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content - Full width responsive */}
      <main className="flex-1 pb-24">
        <div className="container mx-auto px-4 py-6">
          {children}
        </div>
      </main>

      {/* Bottom Navigation - White with Gold */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t-4 border-[#D4AF37] z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
        <div className="container mx-auto px-2 h-20 flex items-center justify-around max-w-xl">
          {navItems.slice(0, 5).map((item) => {
            const href = `${basePath}${item.href}`;
            const isActive = pathname === href || (item.href && pathname.startsWith(href));
            
            return (
              <Link
                key={item.href}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all",
                  isActive 
                    ? "text-[#B8860B] bg-[#D4AF37]/20" 
                    : "text-gray-500 hover:text-[#D4AF37]"
                )}
              >
                <item.icon className={cn("h-6 w-6", isActive && "drop-shadow-md")} />
                <span className="text-[11px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
