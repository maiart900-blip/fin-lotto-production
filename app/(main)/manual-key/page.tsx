'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Keyboard, RefreshCw, Users, FileText, TrendingUp, 
  DollarSign, Clock, CheckCircle, XCircle, ArrowUpRight,
  Wifi, WifiOff, ShieldCheck, UserCog, AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useBranchRealtime } from '@/hooks/use-branch-realtime';
import { createClient } from '@/lib/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import Link from 'next/link';

// =====================================================
// MASTER KEY (MANUAL KEY MANAGEMENT) - ROLE SPECIFIC PAGE
// =====================================================
// This module is STRICTLY for the "Master Key" role:
// - Central hub for monitoring Sub-Agents and Admins keying manual lottery tickets
// - Data fetched ONLY from manual/hand-keyed entry logs (source_type: 'manual_key')
// - Completely separated from automatic API streams
// =====================================================

interface ManualKeyStats {
  totalManualCustomers: number;     // ลูกค้าคีย์หวยทั้งหมด (Manual Key ONLY)
  todayTotalTickets: number;        // โพยคีย์หวยวันนี้ (Manual Key ONLY)
  todayRevenue: number;             // ยอดรับวันนี้ (Manual Key ONLY)
  pendingResults: number;           // รอผลรางวัล (Manual Key ONLY)
  wonTickets: number;               // โพยที่ถูกรางวัล
  lostTickets: number;              // โพยที่ไม่ถูก
  totalKeyStaff: number;            // จำนวน Admin ที่คีย์หวย
  activeKeyStaffToday: number;      // Admin ที่คีย์วันนี้
}

interface RecentEntry {
  id: string;
  number: string;
  bet_type: string;
  amount: number;
  status: string;
  created_at: string;
  customer_name?: string;
  keyed_by_name?: string;           // Admin ที่คีย์โพยนี้
  keyed_by_id?: string;
}

interface KeyStaffActivity {
  id: string;
  name: string;
  ticketCount: number;
  totalAmount: number;
  lastActivity: string;
}

export default function MasterKeyPage() {
  const { branchId, isMasterBranch, isAdmin, isSuperAdmin } = useAuth();
  const [stats, setStats] = useState<ManualKeyStats>({
    totalManualCustomers: 0,
    todayTotalTickets: 0,
    todayRevenue: 0,
    pendingResults: 0,
    wonTickets: 0,
    lostTickets: 0,
    totalKeyStaff: 0,
    activeKeyStaffToday: 0,
  });
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [keyStaffActivities, setKeyStaffActivities] = useState<KeyStaffActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Realtime sync
  const { isConnected, connectionQuality } = useBranchRealtime({
    branchId: branchId || null,
    onRealtimeEvent: () => {
      fetchManualKeyStats();
    },
  });

  const fetchManualKeyStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = createClient();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // =====================================================
      // STRICT DATA ISOLATION: ONLY source_type = 'manual_key'
      // =====================================================

      // 1. Count Manual Key Customers ONLY
      let customersQuery = supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('source', 'manual_key'); // STRICT: Only manual key customers
      
      if (!isMasterBranch && branchId) {
        customersQuery = customersQuery.eq('branch_id', branchId);
      }
      const { count: manualCustomerCount } = await customersQuery;

      // 2. Fetch Manual Key Entries ONLY (source_type = 'manual_key')
      let entriesQuery = supabase
        .from('bets')
        .select(`
          id, total_amount, status, is_checked, created_by, created_at,
          bet_items(id, status, win_amount)
        `)
        .eq('source_type', 'manual_key') // STRICT: Only manual key entries
        .gte('created_at', todayISO)
        .order('created_at', { ascending: false });

      if (!isMasterBranch && branchId) {
        entriesQuery = entriesQuery.eq('branch_id', branchId);
      }

      const { data: todayBets, error: betsError } = await entriesQuery;

      if (betsError) {
        console.error('[MasterKey] Fetch bets error:', betsError);
      }

      // 3. Calculate Manual Key Stats
      const bets = todayBets || [];
      const todayTotalTickets = bets.length;
      const todayRevenue = bets.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
      
      // Count pending results
      const pendingResults = bets.filter(b => !b.is_checked).length;
      
      // Count won/lost from bet_items
      let wonTickets = 0;
      let lostTickets = 0;
      bets.forEach(bet => {
        if (bet.is_checked) {
          const hasWon = (bet.bet_items || []).some((item: { status: string }) => item.status === 'won');
          if (hasWon) wonTickets++;
          else lostTickets++;
        }
      });

      // 4. Count Key Staff (Admins who key manual tickets)
      const { count: totalKeyStaff } = await supabase
        .from('admin_users')
        .select('id', { count: 'exact', head: true })
        .eq('can_key_lottery', true);

      // 5. Count Active Key Staff Today (unique created_by in today's manual bets)
      const uniqueKeyStaff = new Set(bets.map(b => b.created_by).filter(Boolean));
      const activeKeyStaffToday = uniqueKeyStaff.size;

      // 6. Get Key Staff Activity breakdown
      const staffActivityMap = new Map<string, { count: number; amount: number; lastTime: string }>();
      bets.forEach(bet => {
        if (bet.created_by) {
          const existing = staffActivityMap.get(bet.created_by) || { count: 0, amount: 0, lastTime: bet.created_at };
          staffActivityMap.set(bet.created_by, {
            count: existing.count + 1,
            amount: existing.amount + (Number(bet.total_amount) || 0),
            lastTime: bet.created_at > existing.lastTime ? bet.created_at : existing.lastTime,
          });
        }
      });

      // Fetch staff names
      const staffIds = Array.from(staffActivityMap.keys());
      let staffNames: Record<string, string> = {};
      if (staffIds.length > 0) {
        const { data: staffData } = await supabase
          .from('admin_users')
          .select('id, display_name, username')
          .in('id', staffIds);
        
        (staffData || []).forEach((staff: { id: string; display_name?: string; username?: string }) => {
          staffNames[staff.id] = staff.display_name || staff.username || 'Unknown';
        });
      }

      const keyStaffActivityList: KeyStaffActivity[] = Array.from(staffActivityMap.entries())
        .map(([id, data]) => ({
          id,
          name: staffNames[id] || `Admin ${id.slice(0, 8)}`,
          ticketCount: data.count,
          totalAmount: data.amount,
          lastActivity: data.lastTime,
        }))
        .sort((a, b) => b.ticketCount - a.ticketCount);

      setKeyStaffActivities(keyStaffActivityList);

      setStats({
        totalManualCustomers: manualCustomerCount || 0,
        todayTotalTickets,
        todayRevenue,
        pendingResults,
        wonTickets,
        lostTickets,
        totalKeyStaff: totalKeyStaff || 0,
        activeKeyStaffToday,
      });

      // 7. Fetch Recent Entries with keyed_by info
      const { data: recentBets } = await supabase
        .from('bets')
        .select(`
          id, customer_name, total_amount, status, is_checked, created_by, created_at,
          bet_items(number, bet_type, amount_top, status)
        `)
        .eq('source_type', 'manual_key')
        .order('created_at', { ascending: false })
        .limit(5);

      const formatted: RecentEntry[] = (recentBets || []).map((bet: Record<string, unknown>) => {
        const items = bet.bet_items as Array<{ number: string; bet_type: string; amount_top: number; status: string }> | null;
        const firstItem = items?.[0];
        return {
          id: bet.id as string,
          number: firstItem?.number || '-',
          bet_type: firstItem?.bet_type || '-',
          amount: Number(bet.total_amount) || 0,
          status: bet.is_checked ? (items?.some(i => i.status === 'won') ? 'won' : 'lost') : 'pending',
          created_at: bet.created_at as string,
          customer_name: bet.customer_name as string,
          keyed_by_id: bet.created_by as string,
          keyed_by_name: staffNames[bet.created_by as string] || undefined,
        };
      });
      setRecentEntries(formatted);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('[MasterKey] Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [branchId, isMasterBranch]);

  useEffect(() => {
    fetchManualKeyStats();
  }, [fetchManualKeyStats]);

  // Realtime subscription - ONLY for manual_key source
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('master-key-overview')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bets',
        filter: 'source_type=eq.manual_key' // STRICT: Only manual key changes
      }, () => fetchManualKeyStats())
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'customers',
        filter: 'source=eq.manual_key' // STRICT: Only manual key customers
      }, () => fetchManualKeyStats())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchManualKeyStats]);

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
      {/* Header with Role Badge */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Keyboard className="size-6 text-amber-400" />
              Master Key Dashboard
            </h1>
            <Badge className="bg-amber-600 text-white">
              <ShieldCheck className="size-3 mr-1" />
              Manual Key Only
            </Badge>
          </div>
          <p className="text-white/60">
            ศูนย์กลางจัดการระบบคีย์หวย - ข้อมูลจากการคีย์มือเท่านั้น (ไม่รวม Auto API)
          </p>
          {isMasterBranch && (
            <p className="text-amber-400 text-sm mt-1">
              <AlertTriangle className="size-3 inline mr-1" />
              Mode: Super Admin - ดูข้อมูลทุกสาขา
            </p>
          )}
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

          <Button variant="outline" size="sm" onClick={fetchManualKeyStats} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Data Isolation Alert */}
      <Alert className="bg-amber-500/10 border-amber-500/30">
        <AlertTriangle className="size-4 text-amber-400" />
        <AlertDescription className="text-amber-200">
          <strong>Data Isolation Mode:</strong> ข้อมูลทั้งหมดในหน้านี้มาจากระบบคีย์หวยมือ (Manual Key) เท่านั้น 
          ไม่มีการปนเปื้อนจากระบบ Auto API หรือ External Integration
        </AlertDescription>
      </Alert>

      {/* Stats Grid - Manual Key Data ONLY */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#0D1321] border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">ลูกค้าคีย์หวย</p>
                <p className="text-2xl font-bold text-amber-400">{stats.totalManualCustomers.toLocaleString()}</p>
                <p className="text-xs text-white/40">Manual Key Only</p>
              </div>
              <Users className="size-8 text-amber-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0D1321] border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">โพยวันนี้</p>
                <p className="text-2xl font-bold text-blue-400">{stats.todayTotalTickets.toLocaleString()}</p>
                <p className="text-xs text-white/40">Manual Key Only</p>
              </div>
              <FileText className="size-8 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0D1321] border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">ยอดรับวันนี้</p>
                <p className="text-2xl font-bold text-green-400">{stats.todayRevenue.toLocaleString()}</p>
                <p className="text-xs text-white/40">Manual Key Only</p>
              </div>
              <DollarSign className="size-8 text-green-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0D1321] border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">รอผลรางวัล</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.pendingResults.toLocaleString()}</p>
                <p className="text-xs text-white/40">Manual Key Only</p>
              </div>
              <Clock className="size-8 text-yellow-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Key Staff Activity */}
      <Card className="bg-[#0D1321] border-purple-500/30">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="text-purple-400 flex items-center gap-2">
            <UserCog className="size-5" />
            Admin Activity Monitor
          </CardTitle>
          <CardDescription className="text-white/50">
            ติดตามการคีย์หวยของ Admin แต่ละคน (วันนี้: {stats.activeKeyStaffToday} คนจากทั้งหมด {stats.totalKeyStaff} คน)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {keyStaffActivities.length === 0 ? (
            <p className="text-center text-white/60 py-4">ยังไม่มี Admin คีย์หวยวันนี้</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {keyStaffActivities.slice(0, 6).map((staff) => (
                <div key={staff.id} className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white">{staff.name}</span>
                    <Badge variant="outline" className="bg-purple-500/20 text-purple-400">
                      {staff.ticketCount} โพย
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">ยอดรับ:</span>
                    <span className="text-green-400 font-medium">{staff.totalAmount.toLocaleString()} บ.</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-white/60">ล่าสุด:</span>
                    <span className="text-white/40">{formatDistanceToNow(new Date(staff.lastActivity), { addSuffix: true, locale: th })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link href="/manual-key/entries">
          <Card className="bg-[#0D1321] border-amber-500/30 hover:border-amber-400 transition-colors cursor-pointer group">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-amber-500/20">
                  <FileText className="size-6 text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-white">รายการโพย</p>
                  <p className="text-sm text-white/60">ดูโพยคีย์หวยทั้งหมด</p>
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
                  <p className="text-sm text-white/60">จัดการลูกค้า Manual</p>
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
                  <p className="text-sm text-white/60">อัตราจ่ายคีย์หวย</p>
                </div>
              </div>
              <ArrowUpRight className="size-5 text-white/40 group-hover:text-green-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/manual-key-agents">
          <Card className="bg-[#0D1321] border-purple-500/30 hover:border-purple-400 transition-colors cursor-pointer group">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-purple-500/20">
                  <UserCog className="size-6 text-purple-400" />
                </div>
                <div>
                  <p className="font-medium text-white">จัดการ Admin</p>
                  <p className="text-sm text-white/60">Admin คีย์หวย</p>
                </div>
              </div>
              <ArrowUpRight className="size-5 text-white/40 group-hover:text-purple-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Entries - with Admin Trace */}
      <Card className="bg-[#0D1321] border-amber-500/30">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="text-amber-400 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="size-5" />
              รายการล่าสุด (Manual Key Only)
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
                    {/* Admin who keyed this ticket */}
                    {entry.keyed_by_name && (
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-500/30">
                        <UserCog className="size-3 mr-1" />
                        {entry.keyed_by_name}
                      </Badge>
                    )}
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
