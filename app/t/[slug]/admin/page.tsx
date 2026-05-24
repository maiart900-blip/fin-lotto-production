'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  FileText,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface DashboardStats {
  totalCustomers: number;
  newCustomersToday: number;
  totalBetsToday: number;
  totalBetsAmount: number;
  totalPayoutToday: number;
  profitToday: number;
  pendingSettlement: number;
}

interface Tenant {
  id: string;
  name: string;
}

export default function TenantAdminDashboard() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    newCustomersToday: 0,
    totalBetsToday: 0,
    totalBetsAmount: 0,
    totalPayoutToday: 0,
    profitToday: 0,
    pendingSettlement: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch tenant
        const tenantRes = await fetch(`/api/tenant/${slug}`);
        if (tenantRes.ok) {
          const tenantData = await tenantRes.json();
          setTenant(tenantData);
          
          // Fetch stats
          const statsRes = await fetch(`/api/tenant/${slug}/admin/stats`);
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            setStats(statsData);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'ลูกค้าทั้งหมด',
      value: stats.totalCustomers.toLocaleString(),
      subtitle: `+${stats.newCustomersToday} วันนี้`,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      trend: stats.newCustomersToday > 0 ? 'up' : 'neutral',
    },
    {
      title: 'ยอดแทงวันนี้',
      value: `฿${stats.totalBetsAmount.toLocaleString()}`,
      subtitle: `${stats.totalBetsToday} รายการ`,
      icon: FileText,
      color: 'from-green-500 to-green-600',
      trend: 'up',
    },
    {
      title: 'จ่ายออกวันนี้',
      value: `฿${stats.totalPayoutToday.toLocaleString()}`,
      subtitle: 'รางวัลที่จ่าย',
      icon: Wallet,
      color: 'from-orange-500 to-orange-600',
      trend: 'down',
    },
    {
      title: 'กำไร/ขาดทุน',
      value: `${stats.profitToday >= 0 ? '+' : ''}฿${stats.profitToday.toLocaleString()}`,
      subtitle: 'วันนี้',
      icon: stats.profitToday >= 0 ? TrendingUp : TrendingDown,
      color: stats.profitToday >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-red-500 to-red-600',
      trend: stats.profitToday >= 0 ? 'up' : 'down',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-amber-400">แดชบอร์ด</h1>
        <p className="text-muted-foreground">ภาพรวมของ {tenant?.name || 'เว็บลูก'}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="bg-[#0d0d24] border-white/10">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {stat.trend === 'up' && <ArrowUpRight className="h-3 w-3 text-green-500" />}
                    {stat.trend === 'down' && <ArrowDownRight className="h-3 w-3 text-red-500" />}
                    <span className="text-xs text-muted-foreground">{stat.subtitle}</span>
                  </div>
                </div>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.color}`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Settlement Alert */}
      {stats.pendingSettlement > 0 && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-amber-400" />
                <div>
                  <p className="font-medium text-amber-400">ยอดรอส่ง</p>
                  <p className="text-sm text-muted-foreground">
                    คุณมียอดค้าง ฿{stats.pendingSettlement.toLocaleString()} ที่ต้องส่งเว็บกลาง
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[#0d0d24] border-white/10">
          <CardHeader>
            <CardTitle className="text-lg">ลูกค้าล่าสุด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>ยังไม่มีลูกค้าใหม่วันนี้</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0d0d24] border-white/10">
          <CardHeader>
            <CardTitle className="text-lg">รายการแทงล่าสุด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>ยังไม่มีรายการแทงวันนี้</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
