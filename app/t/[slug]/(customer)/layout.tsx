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
      <div className="min-h-screen bg-gradient-to-b from-[#0a2e3d] to-[#051d2a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a2e3d] to-[#051d2a] text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a2e3d]/95 backdrop-blur border-b border-white/10">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo/Name */}
          <Link href={basePath} className="flex items-center gap-2">
            {tenant?.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="h-8 w-8 rounded" />
            ) : (
              <div className="h-8 w-8 rounded bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                {tenant?.name?.charAt(0) || 'T'}
              </div>
            )}
            <span className="font-semibold text-sm">{tenant?.name}</span>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Credit Display */}
            <div className="bg-emerald-500/20 px-3 py-1.5 rounded-lg">
              <span className="text-emerald-400 font-semibold text-sm">
                {customer?.credit_balance?.toLocaleString() || 0}
              </span>
              <span className="text-emerald-400/70 text-xs ml-1">บาท</span>
            </div>

            {/* Notification */}
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
              <Bell className="h-5 w-5" />
            </Button>

            {/* Mobile Menu */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-gray-400 hover:text-white md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0a2e3d] border-t border-white/10 py-2">
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
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                      isActive 
                        ? "bg-emerald-500/20 text-emerald-400" 
                        : "text-gray-400 hover:bg-white/5"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 w-full"
              >
                <LogOut className="h-4 w-4" />
                ออกจากระบบ
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content - Full width responsive */}
      <main className="flex-1 pb-20">
        <div className="container mx-auto px-4 py-4">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0a2e3d]/95 backdrop-blur border-t border-white/10 z-50">
        <div className="container mx-auto px-2 h-16 flex items-center justify-around max-w-xl">
          {navItems.slice(0, 5).map((item) => {
            const href = `${basePath}${item.href}`;
            const isActive = pathname === href || (item.href && pathname.startsWith(href));
            
            return (
              <Link
                key={item.href}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                  isActive 
                    ? "text-emerald-400" 
                    : "text-gray-500 hover:text-gray-300"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px]">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
