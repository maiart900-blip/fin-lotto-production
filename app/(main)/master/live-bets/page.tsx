'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRealtimeBets, useRealtimeCredit } from '@/hooks/use-realtime-bets';
import { useAuth } from '@/hooks/use-auth';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import Link from 'next/link';
import {
  Activity,
  Wifi,
  WifiOff,
  Bell,
  RefreshCw,
  Crown,
  ArrowLeft,
  Search,
  Filter,
  Clock,
  TrendingUp,
  DollarSign,
  Users,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';

const BET_TYPE_LABELS: Record<string, string> = {
  '3top': '3 ตัวบน',
  '3tod': '3 โต๊ด',
  '2top': '2 ตัวบน',
  '2bot': '2 ตัวล่าง',
  'run_top': 'วิ่งบน',
  'run_bot': 'วิ่งล่าง',
};

export default function LiveBetsPage() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const { 
    bets, 
    isConnected, 
    lastUpdate, 
    newBetCount, 
    resetNewBetCount,
    refresh 
  } = useRealtimeBets({
    agentId: selectedAgent !== 'all' ? selectedAgent : undefined,
    enabled: true,
    limit: 100,
  });

  const { credit } = useRealtimeCredit();

  // Play notification sound when new bet arrives
  useEffect(() => {
    if (newBetCount > 0 && soundEnabled) {
      // Play notification sound
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Ignore audio play errors
      });
    }
  }, [newBetCount, soundEnabled]);

  // Calculate summary stats
  const todayTotal = bets.reduce((sum, bet) => sum + bet.amount, 0);
  const uniqueAgents = new Set(bets.map(b => b.agent_id)).size;

  // Filter bets
  const filteredBets = bets.filter(bet => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        bet.number.includes(search) ||
        bet.customer_name.toLowerCase().includes(search) ||
        bet.agent_name?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // RBAC: If not admin, redirect or show limited view
  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="p-6 bg-[#F8FAFC] min-h-screen">
        <Card className="bg-white border-red-500/30">
          <CardContent className="py-12 text-center">
            <XCircle className="size-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-[#0F172A] mb-2">Access Denied</h2>
            <p className="text-[#64748B]">คุณไม่มีสิทธิ์เข้าถึงหน้านี้ เฉพาะ Master เท่านั้น</p>
            <Button asChild className="mt-4">
              <Link href="/entry">กลับไปหน้าคีย์เลข</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-[#F8FAFC] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild className="border-[#EAB308]">
            <Link href="/auto-system">
              <ArrowLeft className="size-4 text-[#B8860B]" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
              <Activity className="size-6 text-[#EAB308]" />
              Live Betting Dashboard
            </h1>
            <p className="text-[#64748B]">Real-time betting updates from all agents</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <Badge 
            variant="outline" 
            className={isConnected 
              ? 'border-green-500 text-green-600 bg-green-50' 
              : 'border-red-500 text-red-600 bg-red-50'
            }
          >
            {isConnected ? (
              <>
                <Wifi className="size-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <WifiOff className="size-3 mr-1" />
                Disconnected
              </>
            )}
          </Badge>

          {/* New Bets Notification */}
          {newBetCount > 0 && (
            <Badge 
              className="bg-gradient-to-r from-[#EAB308] to-[#B8860B] text-white cursor-pointer animate-pulse"
              onClick={resetNewBetCount}
            >
              <Bell className="size-3 mr-1" />
              {newBetCount} New
            </Badge>
          )}

          {/* Sound Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={soundEnabled ? 'border-green-500 text-green-600' : 'border-gray-300'}
          >
            {soundEnabled ? '🔔' : '🔕'}
          </Button>

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            className="border-[#EAB308] text-[#B8860B]"
          >
            <RefreshCw className="size-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-[rgba(234,179,8,0.2)]">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-[#EAB308] to-[#B8860B]">
                <Zap className="size-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-[#64748B]">รายการทั้งหมด</p>
                <p className="text-2xl font-bold text-[#0F172A]">{bets.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-[rgba(234,179,8,0.2)]">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-[#22C55E] to-[#16A34A]">
                <DollarSign className="size-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-[#64748B]">ยอดรวมวันนี้</p>
                <p className="text-2xl font-bold text-[#0F172A]">฿{todayTotal.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-[rgba(234,179,8,0.2)]">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#2563EB]">
                <Users className="size-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-[#64748B]">เอเย่นต์ Active</p>
                <p className="text-2xl font-bold text-[#0F172A]">{uniqueAgents}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-[rgba(234,179,8,0.2)]">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED]">
                <Clock className="size-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-[#64748B]">อัพเดทล่าสุด</p>
                <p className="text-lg font-medium text-[#0F172A]">
                  {lastUpdate 
                    ? formatDistanceToNow(lastUpdate, { addSuffix: true, locale: th })
                    : '-'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white border-[rgba(234,179,8,0.2)]">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#94A3B8]" />
                <Input
                  placeholder="ค้นหาเลข, ชื่อลูกค้า, เอเย่นต์..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="เลือกเอเย่นต์" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกเอเย่นต์</SelectItem>
                {/* Add agent list dynamically */}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Live Bets Table */}
      <Card className="bg-white border-[rgba(234,179,8,0.2)]">
        <CardHeader>
          <CardTitle className="text-[#B8860B] flex items-center gap-2">
            <Activity className="size-5 animate-pulse" />
            Live Bets Stream
            <Badge variant="outline" className="ml-2 border-green-500 text-green-600">
              Real-time
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E2E8F0]">
                  <th className="text-left py-3 px-2 text-[#64748B] text-sm font-medium">เวลา</th>
                  <th className="text-left py-3 px-2 text-[#64748B] text-sm font-medium">เลข</th>
                  <th className="text-left py-3 px-2 text-[#64748B] text-sm font-medium">ประเภท</th>
                  <th className="text-right py-3 px-2 text-[#64748B] text-sm font-medium">ราคา</th>
                  <th className="text-left py-3 px-2 text-[#64748B] text-sm font-medium">ลูกค้า</th>
                  <th className="text-left py-3 px-2 text-[#64748B] text-sm font-medium">เอเย่นต์</th>
                  <th className="text-left py-3 px-2 text-[#64748B] text-sm font-medium">หวย</th>
                  <th className="text-center py-3 px-2 text-[#64748B] text-sm font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {filteredBets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-[#94A3B8]">
                      <Activity className="size-8 mx-auto mb-2 opacity-50" />
                      รอรับข้อมูล...
                    </td>
                  </tr>
                ) : (
                  filteredBets.map((bet, index) => (
                    <tr 
                      key={bet.id} 
                      className={`border-b border-[#F1F5F9] hover:bg-[#FEFCE8] transition-colors ${
                        index === 0 && newBetCount > 0 ? 'bg-[#FEF9C3] animate-pulse' : ''
                      }`}
                    >
                      <td className="py-3 px-2 text-sm text-[#64748B]">
                        {formatDistanceToNow(new Date(bet.created_at), { addSuffix: true, locale: th })}
                      </td>
                      <td className="py-3 px-2">
                        <span className="font-mono font-bold text-lg text-[#0F172A] bg-[#F8FAFC] px-2 py-1 rounded">
                          {bet.number}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="border-[#EAB308] text-[#B8860B]">
                          {BET_TYPE_LABELS[bet.bet_type] || bet.bet_type}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-right font-semibold text-[#0F172A]">
                        ฿{bet.amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-sm text-[#0F172A]">
                        {bet.customer_name}
                      </td>
                      <td className="py-3 px-2 text-sm">
                        <div className="flex items-center gap-1">
                          <div className="size-2 rounded-full bg-green-500"></div>
                          <span className="text-[#0F172A]">{bet.agent_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-sm text-[#64748B]">
                        {bet.lottery_name}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {bet.status === 'confirmed' && (
                          <CheckCircle className="size-4 text-green-500 mx-auto" />
                        )}
                        {bet.status === 'pending' && (
                          <AlertCircle className="size-4 text-yellow-500 mx-auto" />
                        )}
                        {bet.status === 'cancelled' && (
                          <XCircle className="size-4 text-red-500 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
