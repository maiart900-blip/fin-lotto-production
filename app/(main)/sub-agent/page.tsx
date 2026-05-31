'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  TrendingUp,
  Wallet,
  DollarSign,
  BarChart3,
  Target,
  Percent,
  Activity,
  FileText,
  Receipt,
  UserPlus,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
};

export default function SubAgentPortalPage() {
  const { user } = useAuth();
  
  // Fetch sub-agent specific data
  const { data: stats } = useSWR('/api/sub-agent/stats', fetcher);
  const { data: recentEntries } = useSWR('/api/entries?limit=5', fetcher);
  
  const statCards = [
    {
      title: 'ยอดแทงวันนี้',
      value: stats?.todayTurnover || 0,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'จำนวนรายการ',
      value: stats?.todayEntries || 0,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      suffix: 'รายการ',
    },
    {
      title: 'ลูกค้า',
      value: stats?.totalCustomers || 0,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      suffix: 'คน',
    },
    {
      title: 'ยอดจ่ายรวมวันนี้',
      value: stats?.todayPayout || 0,
      icon: Wallet,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ];

  const quickActions = [
    {
      title: 'คีย์หวย',
      description: 'บันทึกโพยหวยใหม่',
      icon: Receipt,
      href: '/manual-key',
      color: 'bg-gradient-to-r from-yellow-500 to-amber-500',
    },
    {
      title: 'ลูกค้าของฉัน',
      description: 'จัดการรายชื่อลูกค้า',
      icon: Users,
      href: '/customers',
      color: 'bg-gradient-to-r from-blue-500 to-cyan-500',
    },
    {
      title: 'รายการโพย',
      description: 'ดูรายการโพยทั้งหมด',
      icon: FileText,
      href: '/entries',
      color: 'bg-gradient-to-r from-purple-500 to-pink-500',
    },
    {
      title: 'รายงาน',
      description: 'ดูรายงานสรุป',
      icon: BarChart3,
      href: '/reports',
      color: 'bg-gradient-to-r from-green-500 to-emerald-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Sub-Agent Portal</h1>
          <Badge variant="secondary" className="bg-amber-100 text-amber-700">
            ซับเอเย่นต์
          </Badge>
        </div>
        <p className="text-muted-foreground">
          ยินดีต้อนรับ {user?.displayName || user?.username} - จัดการลูกค้าและคีย์หวยของคุณ
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">
                    {stat.suffix ? (
                      <>
                        {stat.value.toLocaleString()} <span className="text-sm font-normal">{stat.suffix}</span>
                      </>
                    ) : (
                      <>฿{stat.value.toLocaleString()}</>
                    )}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">เมนูด่วน</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action, index) => (
            <Link key={index} href={action.href}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className={`inline-flex p-3 rounded-lg ${action.color} mb-4`}>
                    <action.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{action.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                  <div className="flex items-center gap-1 text-sm text-amber-600 mt-3">
                    <span>เข้าสู่เมนู</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            รายการล่าสุด
          </CardTitle>
          <CardDescription>5 รายการโพยล่าสุดที่คุณคีย์</CardDescription>
        </CardHeader>
        <CardContent>
          {recentEntries?.data?.length > 0 ? (
            <div className="space-y-3">
              {recentEntries.data.map((entry: any) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{entry.customer_name || 'ลูกค้าทั่วไป'}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString('th-TH')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-amber-600">
                      ฿{entry.total_amount?.toLocaleString() || 0}
                    </p>
                    <Badge variant={entry.status === 'active' ? 'default' : 'secondary'}>
                      {entry.status === 'active' ? 'รอผล' : entry.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>ยังไม่มีรายการโพย</p>
              <Link href="/manual-key">
                <Button variant="outline" className="mt-3">
                  <Receipt className="h-4 w-4 mr-2" />
                  คีย์หวยใหม่
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            ข้อมูลบัญชี
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-muted-foreground">รหัสซับเอเย่นต์</p>
              <p className="font-semibold text-lg">{user?.username}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-muted-foreground">% ส่งบริษัท</p>
              <p className="font-semibold text-lg">{user?.share_percent || 0}%</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-muted-foreground">ค่าคอมมิชชั่น</p>
              <p className="font-semibold text-lg">{user?.commission_rate || 0}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
