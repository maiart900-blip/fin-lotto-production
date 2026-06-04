'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { 
  Users, TrendingUp, Wallet, ArrowUpRight, ArrowDownRight,
  Copy, Share2, QrCode, Download, Clock, CheckCircle,
  Crown, Star, Gift, ChevronRight, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Mock data for demonstration
const mockAgentData = {
  code: 'AG-FIN2024',
  name: 'Premium Agent',
  level: 'gold',
  referralLink: 'https://finlotto.com/ref/AG-FIN2024',
  stats: {
    totalDownline: 156,
    activeDownline: 89,
    newThisMonth: 12,
    totalBetVolume: 2850000,
    totalCommission: 142500,
    pendingCommission: 28500,
    withdrawnCommission: 114000,
  },
  recentDownline: [
    { id: '1', username: 'user_gold123', joinDate: '2024-01-15', betVolume: 125000, commission: 6250, level: 'gold' },
    { id: '2', username: 'player_vip', joinDate: '2024-01-14', betVolume: 85000, commission: 4250, level: 'silver' },
    { id: '3', username: 'lucky_star', joinDate: '2024-01-13', betVolume: 45000, commission: 2250, level: 'bronze' },
    { id: '4', username: 'winner_2024', joinDate: '2024-01-12', betVolume: 32000, commission: 1600, level: 'member' },
  ],
  commissionHistory: [
    { date: '2024-01', amount: 45000 },
    { date: '2024-02', amount: 52000 },
    { date: '2024-03', amount: 48000 },
    { date: '2024-04', amount: 62000 },
    { date: '2024-05', amount: 58000 },
    { date: '2024-06', amount: 72000 },
  ],
};

const getLevelConfig = (level: string) => {
  const levels: Record<string, { color: string; name: string; icon: typeof Crown }> = {
    member: { color: '#64748B', name: 'Member', icon: Users },
    bronze: { color: '#CD7F32', name: 'Bronze', icon: Star },
    silver: { color: '#C0C0C0', name: 'Silver', icon: Star },
    gold: { color: '#FFD700', name: 'Gold', icon: Crown },
    platinum: { color: '#E5E4E2', name: 'Platinum', icon: Crown },
    diamond: { color: '#B9F2FF', name: 'Diamond', icon: Crown },
  };
  return levels[level] || levels.member;
};

export default function AgentPortalPage() {
  const [copied, setCopied] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const copyReferralLink = () => {
    navigator.clipboard.writeText(mockAgentData.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWithdraw = async () => {
    setIsWithdrawing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsWithdrawing(false);
    alert('คำขอถอนเงินสำเร็จ');
  };

  return (
    <div className="page-midnight min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-[#EAB308]">Agent Portal</h1>
              <span className="badge-gold">
                <Crown className="size-3" />
                {mockAgentData.code}
              </span>
            </div>
            <p className="text-[#94A3B8] mt-1">ยินดีต้อนรับ, {mockAgentData.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="btn-gold-outline">
              <QrCode className="size-4 mr-2" />
              QR Code
            </Button>
            <Button className="btn-gold">
              <Download className="size-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Referral Link Card */}
        <div className="ultra-glass-card p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#EAB308]/10 rounded-xl">
                <Share2 className="size-6 text-[#EAB308]" />
              </div>
              <div>
                <p className="text-sm text-[#64748B]">ลิงก์แนะนำสมาชิก</p>
                <p className="text-[#F1F5F9] font-mono">{mockAgentData.referralLink}</p>
              </div>
            </div>
            <Button 
              onClick={copyReferralLink}
              className={copied ? 'bg-green-600 hover:bg-green-700' : 'btn-gold'}
            >
              {copied ? (
                <>
                  <CheckCircle className="size-4 mr-2" />
                  คัดลอกแล้ว
                </>
              ) : (
                <>
                  <Copy className="size-4 mr-2" />
                  คัดลอกลิงก์
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Downline */}
          <div className="card-midnight p-6 shimmer-gold">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Users className="size-6 text-blue-400" />
              </div>
              <span className="flex items-center gap-1 text-green-400 text-sm">
                <ArrowUpRight className="size-4" />
                +{mockAgentData.stats.newThisMonth} เดือนนี้
              </span>
            </div>
            <div className="mt-4">
              <p className="text-[#64748B] text-sm">สายงานทั้งหมด</p>
              <p className="text-3xl font-bold text-[#F1F5F9]">{mockAgentData.stats.totalDownline.toLocaleString()}</p>
              <p className="text-sm text-[#94A3B8]">Active: {mockAgentData.stats.activeDownline}</p>
            </div>
          </div>

          {/* Total Bet Volume */}
          <div className="card-midnight p-6 shimmer-gold">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-purple-500/10 rounded-xl">
                <TrendingUp className="size-6 text-purple-400" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-[#64748B] text-sm">ยอดแทงรวม</p>
              <p className="text-3xl font-bold text-[#F1F5F9]">{mockAgentData.stats.totalBetVolume.toLocaleString()}</p>
              <p className="text-sm text-[#94A3B8]">บาท</p>
            </div>
          </div>

          {/* Total Commission */}
          <div className="card-midnight p-6 shimmer-gold">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-[#EAB308]/10 rounded-xl">
                <Gift className="size-6 text-[#EAB308]" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-[#64748B] text-sm">คอมมิชชันสะสม</p>
              <p className="text-3xl font-bold text-[#EAB308]">{mockAgentData.stats.totalCommission.toLocaleString()}</p>
              <p className="text-sm text-[#94A3B8]">บาท</p>
            </div>
          </div>

          {/* Pending Commission */}
          <div className="card-midnight p-6 border-2 border-[#EAB308]/50">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-green-500/10 rounded-xl">
                <Wallet className="size-6 text-green-400" />
              </div>
              <span className="text-xs text-[#94A3B8]">พร้อมถอน</span>
            </div>
            <div className="mt-4">
              <p className="text-[#64748B] text-sm">ยอดรอถอน</p>
              <p className="text-3xl font-bold text-green-400">{mockAgentData.stats.pendingCommission.toLocaleString()}</p>
            </div>
            <Button 
              onClick={handleWithdraw}
              disabled={isWithdrawing || mockAgentData.stats.pendingCommission === 0}
              className="btn-gold w-full mt-4"
            >
              {isWithdrawing ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                'ถอนเงินเข้ากระเป๋า'
              )}
            </Button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Downline */}
          <div className="lg:col-span-2 card-midnight p-6">
            <div className="section-header-midnight">
              <h2>สมาชิกในสายงานล่าสุด</h2>
              <Button variant="ghost" className="text-[#EAB308] hover:text-[#FDE047]">
                ดูทั้งหมด <ChevronRight className="size-4 ml-1" />
              </Button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="table-midnight">
                <thead>
                  <tr>
                    <th>ชื่อผู้ใช้</th>
                    <th>วันที่สมัคร</th>
                    <th>ยอดแทง</th>
                    <th>คอมมิชชัน</th>
                    <th>ระดับ</th>
                  </tr>
                </thead>
                <tbody>
                  {mockAgentData.recentDownline.map((member) => {
                    const levelConfig = getLevelConfig(member.level);
                    return (
                      <tr key={member.id}>
                        <td className="font-medium text-[#F1F5F9]">{member.username}</td>
                        <td>{new Date(member.joinDate).toLocaleDateString('th-TH')}</td>
                        <td>{member.betVolume.toLocaleString()}</td>
                        <td className="text-[#EAB308] font-semibold">+{member.commission.toLocaleString()}</td>
                        <td>
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
                            style={{ 
                              backgroundColor: `${levelConfig.color}20`,
                              color: levelConfig.color,
                              border: `1px solid ${levelConfig.color}40`
                            }}
                          >
                            <levelConfig.icon className="size-3" />
                            {levelConfig.name}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Commission Summary */}
          <div className="card-midnight p-6">
            <div className="section-header-midnight">
              <h2>สรุปคอมมิชชัน</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#1E293B] rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <CheckCircle className="size-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-[#64748B]">ถอนแล้ว</p>
                    <p className="text-lg font-bold text-[#F1F5F9]">
                      {mockAgentData.stats.withdrawnCommission.toLocaleString()} บาท
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#1E293B] rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#EAB308]/10 rounded-lg">
                    <Clock className="size-5 text-[#EAB308]" />
                  </div>
                  <div>
                    <p className="text-sm text-[#64748B]">รอถอน</p>
                    <p className="text-lg font-bold text-[#EAB308]">
                      {mockAgentData.stats.pendingCommission.toLocaleString()} บาท
                    </p>
                  </div>
                </div>
              </div>

              <div className="divider-gold" />

              {/* Monthly Breakdown */}
              <div>
                <p className="text-sm text-[#64748B] mb-3">รายได้ 6 เดือนล่าสุด</p>
                <div className="space-y-2">
                  {mockAgentData.commissionHistory.slice().reverse().map((item, idx) => (
                    <div key={item.date} className="flex items-center justify-between">
                      <span className="text-[#94A3B8]">{item.date}</span>
                      <span className="text-[#EAB308] font-semibold">
                        +{item.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
