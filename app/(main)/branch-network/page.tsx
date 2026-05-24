'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Network, RefreshCw, Wifi, WifiOff, Building2, 
  ArrowRight, TrendingUp, Users, DollarSign, Activity,
  Send, Bell
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useBranchRealtime } from '@/hooks/use-branch-realtime';
import { createClient } from '@/lib/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

interface BranchStatus {
  id: string;
  code: string;
  name: string;
  branch_type: string;
  is_active: boolean;
  parent_branch_id?: string;
  is_online: boolean;
  last_seen_at?: string;
  connection_quality: string;
  pending_sync_count: number;
  today_bets: number;
  today_amount: number;
  today_customers: number;
}

export default function BranchNetworkPage() {
  const { user, branchId, isMasterBranch } = useAuth();
  const [branches, setBranches] = useState<BranchStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [broadcastMessage, setBroadcastMessage] = useState('');

  // Realtime connection
  const { 
    isConnected, 
    broadcastToChildren,
    createEvent 
  } = useBranchRealtime({
    branchId: branchId || null,
    onSyncEvent: () => {
      fetchBranches();
    },
  });

  // Fetch all branch statuses
  const fetchBranches = useCallback(async () => {
    if (!isMasterBranch) return;

    try {
      setIsLoading(true);
      const supabase = createClient();

      // Get all branches under this master
      const { data: branchesData, error } = await supabase
        .from('branches')
        .select(`
          id, code, name, branch_type, is_active, parent_branch_id,
          branch_connection_status (is_online, last_seen_at, connection_quality, pending_sync_count)
        `)
        .or(`id.eq.${branchId},parent_branch_id.eq.${branchId}`)
        .order('name');

      if (error) {
        console.error('Error fetching branches:', error);
        return;
      }

      // Get today's stats for each branch
      const today = new Date().toISOString().split('T')[0];
      const branchIds = (branchesData || []).map(b => b.id);

      const { data: statsData } = await supabase
        .from('bets')
        .select('branch_id, id, total_amount, customer_id')
        .in('branch_id', branchIds)
        .gte('created_at', today);

      // Aggregate stats by branch
      const statsMap: Record<string, { bets: number; amount: number; customers: Set<string> }> = {};
      (statsData || []).forEach((bet: Record<string, unknown>) => {
        const bid = bet.branch_id as string;
        if (!statsMap[bid]) {
          statsMap[bid] = { bets: 0, amount: 0, customers: new Set() };
        }
        statsMap[bid].bets++;
        statsMap[bid].amount += (bet.total_amount as number) || 0;
        if (bet.customer_id) {
          statsMap[bid].customers.add(bet.customer_id as string);
        }
      });

      const formattedBranches: BranchStatus[] = (branchesData || []).map((branch: Record<string, unknown>) => {
        const connectionStatus = branch.branch_connection_status as Record<string, unknown> | null;
        const stats = statsMap[branch.id as string] || { bets: 0, amount: 0, customers: new Set() };

        return {
          id: branch.id as string,
          code: branch.code as string,
          name: branch.name as string,
          branch_type: branch.branch_type as string,
          is_active: branch.is_active as boolean,
          parent_branch_id: branch.parent_branch_id as string | undefined,
          is_online: (connectionStatus?.is_online as boolean) || false,
          last_seen_at: connectionStatus?.last_seen_at as string | undefined,
          connection_quality: (connectionStatus?.connection_quality as string) || 'unknown',
          pending_sync_count: (connectionStatus?.pending_sync_count as number) || 0,
          today_bets: stats.bets,
          today_amount: stats.amount,
          today_customers: stats.customers.size,
        };
      });

      setBranches(formattedBranches);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Fetch branches error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [branchId, isMasterBranch]);

  // Initial fetch
  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  // Auto refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchBranches, 10000);
    return () => clearInterval(interval);
  }, [fetchBranches]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase
      .channel('branch-network')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'branch_connection_status' },
        () => {
          fetchBranches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBranches]);

  // Broadcast to all branches
  const handleBroadcast = async () => {
    if (!broadcastMessage.trim()) return;

    const success = await broadcastToChildren('announcement', {
      message: broadcastMessage,
      from: user?.displayName || 'เว็บแม่',
      timestamp: new Date().toISOString(),
    }, 'ประกาศจากเว็บแม่');

    if (success) {
      setBroadcastMessage('');
      alert('ส่งประกาศไปทุกสาขาสำเร็จ');
    }
  };

  // Send refresh command to all branches
  const handleRefreshAll = async () => {
    await createEvent('command', 'system', {
      command: 'refresh_data',
      timestamp: new Date().toISOString(),
    }, { broadcastToChildren: true });

    alert('ส่งคำสั่ง Refresh ไปทุกสาขาแล้ว');
  };

  // Calculate totals
  const onlineCount = branches.filter(b => b.is_online).length;
  const totalBets = branches.reduce((sum, b) => sum + b.today_bets, 0);
  const totalAmount = branches.reduce((sum, b) => sum + b.today_amount, 0);
  const totalCustomers = branches.reduce((sum, b) => sum + b.today_customers, 0);

  if (!isMasterBranch) {
    return (
      <div className="p-6">
        <Card className="bg-[#0D1321] border-red-500/30">
          <CardContent className="p-8 text-center">
            <Network className="size-12 mx-auto mb-4 text-red-400" />
            <h2 className="text-xl font-bold text-white mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-white/60">หน้านี้สำหรับเว็บแม่เท่านั้น</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Network className="size-6 text-blue-400" />
            เครือข่ายสาขา
          </h1>
          <p className="text-white/60 mt-1">
            ดูสถานะและควบคุมสาขาทั้งหมดแบบ Realtime
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className={isConnected 
            ? "bg-green-500/20 text-green-400 border-green-500/30"
            : "bg-red-500/20 text-red-400 border-red-500/30"
          }>
            {isConnected ? <Wifi className="size-3 mr-1" /> : <WifiOff className="size-3 mr-1" />}
            {isConnected ? 'Realtime ON' : 'Offline'}
          </Badge>

          <Button variant="outline" size="sm" onClick={handleRefreshAll}>
            <Send className="size-4 mr-2" />
            Refresh ทุกสาขา
          </Button>

          <Button variant="outline" size="sm" onClick={fetchBranches} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Broadcast Section */}
      <Card className="bg-[#0D1321] border-blue-500/30">
        <CardHeader>
          <CardTitle className="text-blue-400 flex items-center gap-2">
            <Bell className="size-5" />
            ประกาศถึงทุกสาขา
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <input
              type="text"
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="พิมพ์ข้อความประกาศ..."
              className="flex-1 bg-white/10 border border-blue-500/30 rounded-md px-4 py-2 text-white placeholder:text-white/50 focus:border-blue-400 focus:outline-none"
            />
            <Button onClick={handleBroadcast} disabled={!broadcastMessage.trim()}>
              <Send className="size-4 mr-2" />
              ส่งประกาศ
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-[#0D1321] border-blue-500/30">
          <CardContent className="p-4">
            <div className="text-white/60 text-sm">สาขาทั้งหมด</div>
            <div className="text-2xl font-bold text-white">{branches.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0D1321] border-green-500/30">
          <CardContent className="p-4">
            <div className="text-white/60 text-sm">ออนไลน์</div>
            <div className="text-2xl font-bold text-green-400">{onlineCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0D1321] border-amber-500/30">
          <CardContent className="p-4">
            <div className="text-white/60 text-sm">โพยวันนี้</div>
            <div className="text-2xl font-bold text-amber-400">{totalBets}</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0D1321] border-purple-500/30">
          <CardContent className="p-4">
            <div className="text-white/60 text-sm">ยอดวันนี้</div>
            <div className="text-2xl font-bold text-purple-400">{totalAmount.toLocaleString()} บ.</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0D1321] border-cyan-500/30">
          <CardContent className="p-4">
            <div className="text-white/60 text-sm">ลูกค้าวันนี้</div>
            <div className="text-2xl font-bold text-cyan-400">{totalCustomers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Branch List */}
      <Card className="bg-[#0D1321] border-blue-500/30">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="text-blue-400 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Building2 className="size-5" />
              สาขาในเครือข่าย
            </span>
            <span className="text-sm text-white/40 font-normal">
              อัพเดท: {formatDistanceToNow(lastUpdate, { addSuffix: true, locale: th })}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && branches.length === 0 ? (
            <div className="p-8 text-center text-white/60">
              <RefreshCw className="size-8 animate-spin mx-auto mb-2" />
              กำลังโหลด...
            </div>
          ) : branches.length === 0 ? (
            <div className="p-8 text-center text-white/60">
              ไม่พบสาขา
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {branches.map((branch) => (
                <div key={branch.id} className="p-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Status Indicator */}
                      <div className={`size-3 rounded-full ${
                        branch.is_online 
                          ? branch.connection_quality === 'good' 
                            ? 'bg-green-400' 
                            : 'bg-yellow-400'
                          : 'bg-red-400'
                      }`} />

                      {/* Branch Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{branch.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {branch.code}
                          </Badge>
                          {branch.branch_type === 'master' && (
                            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                              เว็บแม่
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-white/60 mt-1">
                          {branch.is_online ? (
                            <span className="text-green-400">ออนไลน์</span>
                          ) : (
                            <span className="text-red-400">
                              ออฟไลน์ {branch.last_seen_at && `(${formatDistanceToNow(new Date(branch.last_seen_at), { addSuffix: true, locale: th })})`}
                            </span>
                          )}
                          {branch.pending_sync_count > 0 && (
                            <span className="text-amber-400 ml-2">
                              {branch.pending_sync_count} รอ sync
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Branch Stats */}
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-lg font-bold text-white">{branch.today_bets}</div>
                        <div className="text-xs text-white/40">โพย</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-amber-400">{branch.today_amount.toLocaleString()}</div>
                        <div className="text-xs text-white/40">ยอด</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-cyan-400">{branch.today_customers}</div>
                        <div className="text-xs text-white/40">ลูกค้า</div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <ArrowRight className="size-4" />
                      </Button>
                    </div>
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
