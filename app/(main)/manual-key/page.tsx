'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Keyboard, RefreshCw, Users, FileText, TrendingUp, 
  DollarSign, Clock, CheckCircle, XCircle, ArrowUpRight,
  Wifi, WifiOff
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useBranchRealtime } from '@/hooks/use-branch-realtime';
import { createClient } from '@/lib/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import Link from 'next/link';

interface ManualKeyStats {
  totalCustomers: number;
  totalEntries: number;
  totalAmount: number;
  pendingEntries: number;
  wonEntries: number;
  lostEntries: number;
  todayEntries: number;
  todayAmount: number;
}

interface RecentEntry {
  id: string;
  number: string;
  bet_type: string;
  amount: number;
  status: string;
  created_at: string;
  customer_name?: string;
}

export default function ManualKeyPage() {
  const { branchId, isMasterBranch } = useAuth();
  const [stats, setStats] = useState<ManualKeyStats>({
    totalCustomers: 0,
    totalEntries: 0,
    totalAmount: 0,
    pendingEntries: 0,
    wonEntries: 0,
    lostEntries: 0,
    todayEntries: 0,
    todayAmount: 0,
  });
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Realtime sync
  const { isConnected, connectionQuality } = useBranchRealtime({
    branchId: branchId || null,
    onRealtimeEvent: () => {
      fetchStats();
    },
  });

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = createClient();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch customers count
      let customersQuery = supabase.from('customers').select('id', { count: 'exact', head: true });
      if (!isMasterBranch && branchId) {
        customersQuery = customersQuery.eq('branch_id', branchId);
      }
      const { count: customerCount } = await customersQuery;

      // Fetch entries with stats
      let entriesQuery = supabase
        .from('entries')
        .select(`
          id, number, bet_type, amount, status, created_at,
          bets!inner (branch_id, customers (name))
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!isMasterBranch && branchId) {
        entriesQuery = entriesQuery.eq('bets.branch_id', branchId);
      }

      const { data: entriesData } = await entriesQuery;

      // Calculate stats
      const entries = entriesData || [];
      const totalAmount = entries.reduce((sum, e) => sum + (e.amount || 0), 0);
      const pendingEntries = entries.filter(e => e.status === 'pending').length;
      const wonEntries = entries.filter(e => e.status === 'won').length;
      const lostEntries = entries.filter(e => e.status === 'lost').length;
      
      const todayEntries = entries.filter(e => new Date(e.created_at) >= today);
      const todayAmount = todayEntries.reduce((sum, e) => sum + (e.amount || 0), 0);

      setStats({
        totalCustomers: customerCount || 0,
        totalEntries: entries.length,
        totalAmount,
        pendingEntries,
        wonEntries,
        lostEntries,
        todayEntries: todayEntries.length,
        todayAmount,
      });

      // Format recent entries
      const formatted: RecentEntry[] = entries.slice(0, 5).map((entry: Record<string, unknown>) => {
        const bet = entry.bets as Record<string, unknown> | null;
        const customer = bet?.customers as Record<string, unknown> | null;
        return {
          id: entry.id as string,
          number: entry.number as string,
          bet_type: entry.bet_type as string,
          amount: entry.amount as number,
          status: entry.status as string,
          created_at: entry.created_at as string,
          customer_name: customer?.name as string | undefined,
        };
      });
      setRecentEntries(formatted);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [branchId, isMasterBranch]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('manual-key-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchStats())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchStats]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="size-3 mr-1" />รอผล</Badge>;
      case 'won':
        return <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="size-3 mr-1" />ถูก</Badge>;
      case 'lost':
        return <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="size-3 mr-1" />ไม่ถูก</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Keyboard className="size-6 text-amber-400" />
            ระบบคีย์หวย (Manual Key)
          </h1>
          <p className="text-white/60 mt-1">
            จัดการระบบคีย์หวยสำหรับลูกค้าที่ส่งโพยผ่าน Line/โทรศัพท์
            {isMasterBranch && <span className="text-amber-400 ml-2">(ดูได้ทุกสาขา)</span>}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isConnected ? (
            <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
              <Wifi className="size-3 mr-1" />
              เชื่อมต่อ {connectionQuality !== 'good' && `(${connectionQuality})`}
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
              <WifiOff className="size-3 mr-1" />
              ไม่เชื่อมต่อ
            </Badge>
          )}

          <Button variant="outline" size="sm" onClick={fetchStats} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#0D1321] border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">ลูกค้าคีย์หวย</p>
                <p className="text-2xl font-bold text-amber-400">{stats.totalCustomers}</p>
              </div>
              <Users className="size-8 text-amber-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0D1321] border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">รายการวันนี้</p>
                <p className="text-2xl font-bold text-blue-400">{stats.todayEntries}</p>
              </div>
              <FileText className="size-8 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0D1321] border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">ยอดวันนี้</p>
                <p className="text-2xl font-bold text-green-400">{stats.todayAmount.toLocaleString()}</p>
              </div>
              <DollarSign className="size-8 text-green-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0D1321] border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">รอผล</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.pendingEntries}</p>
              </div>
              <Clock className="size-8 text-yellow-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/manual-key/entries">
          <Card className="bg-[#0D1321] border-amber-500/30 hover:border-amber-400 transition-colors cursor-pointer group">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-amber-500/20">
                  <FileText className="size-6 text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-white">รายการคีย์หวย</p>
                  <p className="text-sm text-white/60">ดูรายการโพยทั้งหมด</p>
                </div>
              </div>
              <ArrowUpRight className="size-5 text-white/40 group-hover:text-amber-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/manual-key/customers">
          <Card className="bg-[#0D1321] border-blue-500/30 hover:border-blue-400 transition-colors cursor-pointer group">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/20">
                  <Users className="size-6 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-white">ลูกค้าคีย์หวย</p>
                  <p className="text-sm text-white/60">จัดการลูกค้า Manual Key</p>
                </div>
              </div>
              <ArrowUpRight className="size-5 text-white/40 group-hover:text-blue-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/manual-key/rates">
          <Card className="bg-[#0D1321] border-green-500/30 hover:border-green-400 transition-colors cursor-pointer group">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/20">
                  <TrendingUp className="size-6 text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-white">ตั้งค่าเรท</p>
                  <p className="text-sm text-white/60">กำหนดอัตราจ่ายคีย์หวย</p>
                </div>
              </div>
              <ArrowUpRight className="size-5 text-white/40 group-hover:text-green-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Entries */}
      <Card className="bg-[#0D1321] border-amber-500/30">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="text-amber-400 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="size-5" />
              รายการล่าสุด
            </span>
            <span className="text-sm text-white/40 font-normal">
              อัพเดท: {formatDistanceToNow(lastUpdate, { addSuffix: true, locale: th })}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-white/60">
              <RefreshCw className="size-8 animate-spin mx-auto mb-2" />
              กำลังโหลด...
            </div>
          ) : recentEntries.length === 0 ? (
            <div className="p-8 text-center text-white/60">
              ยังไม่มีรายการคีย์หวย
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {recentEntries.map((entry) => (
                <div key={entry.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-lg text-amber-400 font-bold">{entry.number}</span>
                    <div>
                      <p className="text-white">{entry.bet_type}</p>
                      <p className="text-sm text-white/60">{entry.customer_name || 'ไม่ระบุชื่อ'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-white font-medium">{entry.amount.toLocaleString()} บ.</span>
                    {getStatusBadge(entry.status)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {recentEntries.length > 0 && (
            <div className="p-4 border-t border-white/10">
              <Link href="/manual-key/entries">
                <Button variant="outline" className="w-full">
                  ดูรายการทั้งหมด
                  <ArrowUpRight className="size-4 ml-2" />
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
