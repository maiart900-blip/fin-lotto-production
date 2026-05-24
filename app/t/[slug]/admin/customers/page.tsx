'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Phone, Wallet } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string;
  username: string;
  credit_balance: number;
  is_active: boolean;
  created_at: string;
}

export default function TenantCustomersPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await fetch(`/api/tenant/${slug}/admin/customers?search=${search}`);
        if (res.ok) {
          const data = await res.json();
          setCustomers(data.customers || []);
        }
      } catch (error) {
        console.error('Error fetching customers:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, [slug, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-amber-400">จัดการลูกค้า</h1>
          <p className="text-muted-foreground">รายชื่อลูกค้าทั้งหมดของเว็บ</p>
        </div>
      </div>

      {/* Search */}
      <Card className="bg-[#0d0d24] border-white/10">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อ, เบอร์โทร, username..."
              className="pl-9 bg-white/5 border-white/10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#0d0d24] border-white/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Users className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{customers.length}</p>
              <p className="text-xs text-muted-foreground">ลูกค้าทั้งหมด</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer List */}
      <Card className="bg-[#0d0d24] border-white/10">
        <CardHeader>
          <CardTitle className="text-lg">รายชื่อลูกค้า</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>ยังไม่มีลูกค้า</p>
            </div>
          ) : (
            <div className="space-y-3">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-bold">
                      {(customer.name || customer.username || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{customer.name || customer.username}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {customer.phone}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <Wallet className="h-3 w-3 text-amber-400" />
                        <span className="font-medium">฿{customer.credit_balance?.toLocaleString() || 0}</span>
                      </div>
                    </div>
                    <Badge variant={customer.is_active ? 'default' : 'secondary'}>
                      {customer.is_active ? 'ใช้งาน' : 'ระงับ'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
