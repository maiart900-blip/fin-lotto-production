'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  TrendingUp, 
  Users, 
  Copy, 
  Star, 
  Crown, 
  Trophy,
  Target,
  Clock,
  ChevronRight,
  Sparkles,
  Eye,
  Loader2,
  UserPlus,
  UserCheck,
  Calendar,
  Percent,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function LeadUserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = use(params);
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState('bets');
  
  // Fetch lead user profile
  const { data: user, error, isLoading } = useSWR(
    `/api/lead-users?id=${userId}`,
    fetcher
  );
  
  // Fetch user's public bets
  const { data: publicBets, isLoading: betsLoading } = useSWR(
    `/api/public-bets?user_id=${userId}`,
    fetcher
  );
  
  // Check if following
  const { data: followingData, mutate: mutateFollowing } = useSWR(
    '/api/lead-users/follow',
    fetcher,
    {
      onSuccess: (data) => {
        if (data?.following) {
          setIsFollowing(data.following.some((f: any) => f.lead_user_id === userId));
        }
      }
    }
  );
  
  const handleFollow = async () => {
    try {
      const res = await fetch('/api/lead-users/follow', {
        method: isFollowing ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_user_id: userId }),
      });
      
      if (!res.ok) throw new Error('Failed');
      
      setIsFollowing(!isFollowing);
      toast.success(isFollowing ? 'ยกเลิกติดตามแล้ว' : 'ติดตามสำเร็จ');
      mutateFollowing();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };
  
  const handleCopyBet = (bet: any) => {
    const betData = bet.bets || {};
    const lotteryId = betData.lottery_id;
    
    if (!lotteryId) {
      toast.error('ไม่พบข้อมูลหวย');
      return;
    }
    
    sessionStorage.setItem('copyBet', JSON.stringify({
      publicBetId: bet.id,
      items: betData.bet_items || [],
    }));
    
    router.push(`/c/lotto/${lotteryId}?copy=true`);
    toast.success('กำลังนำไปหน้าแทงหวย');
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (error || !user) {
    return (
      <div className="text-center py-20">
        <p className="text-[#64748B]">ไม่พบข้อมูลผู้ใช้</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          กลับ
        </Button>
      </div>
    );
  }
  
  const stats = user.lead_user_stats?.[0] || {};
  const winRate = stats.win_rate || 0;
  const totalProfit = stats.total_profit || 0;
  const todayProfit = stats.today_profit || 0;
  const weekProfit = stats.week_profit || 0;
  const monthProfit = stats.month_profit || 0;
  const followersCount = stats.followers_count || 0;
  const totalBets = stats.total_bets || 0;
  const winningBets = stats.winning_bets || 0;
  const copyCount = stats.copy_count || 0;
  
  return (
    <div className="space-y-6 fade-in-up pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.back()}
          className="size-10 rounded-xl bg-white/5 hover:bg-white/10 text-white"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-xl font-bold text-white">โปรไฟล์เซียน</h1>
      </div>
      
      {/* Profile Card */}
      <Card className="glass-card border-0 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-cyan-500/10" />
        <CardContent className="p-5 relative">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="relative">
              <Avatar className="size-20 ring-4 ring-primary/30 shadow-lg">
                <AvatarImage src={user.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-cyan-500 text-white text-2xl font-bold">
                  {user.name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              {user.is_pinned && (
                <div className="absolute -top-1 -right-1 size-7 rounded-full bg-amber-500 flex items-center justify-center ring-2 ring-[#0A1628]">
                  <Crown className="size-4 text-white" />
                </div>
              )}
            </div>
            
            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-white">{user.name}</h2>
                {user.lead_badge && (
                  <Badge className="bg-amber-500/20 text-amber-400 border-0">
                    {user.lead_badge}
                  </Badge>
                )}
              </div>
              
              {user.bio && (
                <p className="text-sm text-[#94A3B8] mb-3">{user.bio}</p>
              )}
              
              {/* Quick stats */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Users className="size-4 text-[#64748B]" />
                  <span className="text-white font-semibold">{followersCount}</span>
                  <span className="text-[#64748B]">ผู้ติดตาม</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Copy className="size-4 text-[#64748B]" />
                  <span className="text-white font-semibold">{copyCount}</span>
                  <span className="text-[#64748B]">แทงตาม</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Follow button */}
          <Button
            className={`w-full mt-4 ${isFollowing ? 'bg-white/10 hover:bg-white/20 text-white' : 'btn-premium'}`}
            onClick={handleFollow}
          >
            {isFollowing ? (
              <>
                <UserCheck className="size-5 mr-2" />
                ติดตามอยู่
              </>
            ) : (
              <>
                <UserPlus className="size-5 mr-2" />
                ติดตาม
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="glass-card border-0">
          <CardContent className="p-4 text-center">
            <div className="size-10 rounded-xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-2">
              <Target className="size-5 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-emerald-400">{winRate.toFixed(1)}%</p>
            <p className="text-xs text-[#64748B]">อัตราถูก</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card border-0">
          <CardContent className="p-4 text-center">
            <div className="size-10 rounded-xl bg-amber-500/20 flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="size-5 text-amber-400" />
            </div>
            <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
              {totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString()}
            </p>
            <p className="text-xs text-[#64748B]">กำไรรวม</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card border-0">
          <CardContent className="p-4 text-center">
            <div className="size-10 rounded-xl bg-purple-500/20 flex items-center justify-center mx-auto mb-2">
              <Trophy className="size-5 text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-white">{winningBets}/{totalBets}</p>
            <p className="text-xs text-[#64748B]">ถูก/แทง</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card border-0">
          <CardContent className="p-4 text-center">
            <div className="size-10 rounded-xl bg-cyan-500/20 flex items-center justify-center mx-auto mb-2">
              <Calendar className="size-5 text-cyan-400" />
            </div>
            <p className={`text-2xl font-bold ${todayProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {todayProfit >= 0 ? '+' : ''}{todayProfit.toLocaleString()}
            </p>
            <p className="text-xs text-[#64748B]">วันนี้</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Profit Timeline */}
      <Card className="glass-card border-0">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-white mb-3">สถิติกำไร</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#64748B]">วันนี้</span>
              <div className="flex items-center gap-2">
                {todayProfit >= 0 ? (
                  <ArrowUpRight className="size-4 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="size-4 text-red-400" />
                )}
                <span className={`font-mono font-semibold ${todayProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {todayProfit >= 0 ? '+' : ''}{todayProfit.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#64748B]">สัปดาห์นี้</span>
              <div className="flex items-center gap-2">
                {weekProfit >= 0 ? (
                  <ArrowUpRight className="size-4 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="size-4 text-red-400" />
                )}
                <span className={`font-mono font-semibold ${weekProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {weekProfit >= 0 ? '+' : ''}{weekProfit.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#64748B]">เดือนนี้</span>
              <div className="flex items-center gap-2">
                {monthProfit >= 0 ? (
                  <ArrowUpRight className="size-4 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="size-4 text-red-400" />
                )}
                <span className={`font-mono font-semibold ${monthProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {monthProfit >= 0 ? '+' : ''}{monthProfit.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Bets Section */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 px-1">โพยล่าสุด</h3>
        
        {betsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : publicBets?.length > 0 ? (
          <div className="space-y-3">
            {publicBets.map((bet: any) => {
              const betData = bet.bets || {};
              const items = betData.bet_items || [];
              const lottery = betData.lotteries || {};
              
              return (
                <Card key={bet.id} className="glass-card border-0">
                  <CardContent className="p-4">
                    {/* Bet header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-white/20 text-[#94A3B8] text-xs">
                          {lottery.name || 'หวย'}
                        </Badge>
                        <span className="text-xs text-[#64748B]">
                          <Clock className="size-3 inline mr-1" />
                          {new Date(bet.created_at).toLocaleDateString('th-TH')}
                        </span>
                      </div>
                      <Badge className="bg-amber-500/20 text-amber-400 border-0 font-mono">
                        {bet.display_amount || '100+'}
                      </Badge>
                    </div>
                    
                    {/* Numbers */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {items.slice(0, 8).map((item: any, i: number) => (
                        <Badge 
                          key={i}
                          variant="outline" 
                          className="border-white/20 text-white font-mono"
                        >
                          {item.number}
                        </Badge>
                      ))}
                      {items.length > 8 && (
                        <Badge variant="outline" className="border-white/20 text-[#64748B]">
                          +{items.length - 8}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Result indicator if available */}
                    {betData.status === 'won' && (
                      <div className="flex items-center gap-2 text-emerald-400 text-sm mb-3">
                        <CheckCircle2 className="size-4" />
                        <span>ถูกรางวัล</span>
                      </div>
                    )}
                    {betData.status === 'lost' && (
                      <div className="flex items-center gap-2 text-[#64748B] text-sm mb-3">
                        <XCircle className="size-4" />
                        <span>ไม่ถูกรางวัล</span>
                      </div>
                    )}
                    
                    {/* Copy button */}
                    {betData.status === 'pending' && (
                      <Button
                        className="w-full btn-premium"
                        onClick={() => handleCopyBet(bet)}
                      >
                        <Copy className="size-4 mr-2" />
                        แทงตาม
                      </Button>
                    )}
                    
                    {/* Copy count */}
                    {bet.copy_count > 0 && (
                      <p className="text-[10px] text-[#64748B] text-center mt-2">
                        <Users className="size-3 inline mr-1" />
                        {bet.copy_count} คนแทงตาม
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <Copy className="size-10 text-[#64748B] mx-auto mb-2" />
            <p className="text-[#64748B] text-sm">ยังไม่มีโพยในขณะนี้</p>
          </div>
        )}
      </div>
    </div>
  );
}
