'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  ArrowLeft, 
  Search, 
  TrendingUp, 
  Users, 
  Copy, 
  Star, 
  Crown, 
  Flame,
  Trophy,
  Target,
  Clock,
  ChevronRight,
  Heart,
  Sparkles,
  Zap,
  Eye,
  CheckCircle2,
  ArrowUpRight,
  Loader2,
  UserPlus,
  UserCheck,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Lead user card component
function LeadUserCard({ user, isFollowing, onFollow, onViewProfile }: {
  user: any;
  isFollowing: boolean;
  onFollow: () => void;
  onViewProfile: () => void;
}) {
  const stats = user.lead_user_stats?.[0] || {};
  const winRate = stats.win_rate || 0;
  const totalProfit = stats.total_profit || 0;
  const followersCount = stats.followers_count || 0;
  
  return (
    <Card className="glass-card border-0 overflow-hidden group hover:scale-[1.02] transition-all duration-300">
      {/* Gradient overlay for top performers */}
      {user.is_pinned && (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/5 pointer-events-none" />
      )}
      
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar with badge */}
          <div className="relative">
            <Avatar className="size-14 ring-2 ring-primary/30">
              <AvatarImage src={user.avatar_url} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-cyan-500 text-white text-lg font-bold">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            {user.is_pinned && (
              <div className="absolute -top-1 -right-1 size-5 rounded-full bg-amber-500 flex items-center justify-center">
                <Crown className="size-3 text-white" />
              </div>
            )}
          </div>
          
          {/* User info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white truncate">{user.name}</h3>
              {user.lead_badge && (
                <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-[10px] px-1.5">
                  {user.lead_badge}
                </Badge>
              )}
            </div>
            
            {/* Stats row */}
            <div className="flex items-center gap-3 mt-1.5 text-xs">
              <div className="flex items-center gap-1">
                <Target className="size-3 text-emerald-400" />
                <span className={winRate >= 50 ? 'text-emerald-400' : 'text-[#94A3B8]'}>
                  {winRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="size-3 text-amber-400" />
                <span className={totalProfit >= 0 ? 'text-amber-400' : 'text-red-400'}>
                  {totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="size-3 text-[#64748B]" />
                <span className="text-[#94A3B8]">{followersCount}</span>
              </div>
            </div>
            
            {/* Bio */}
            {user.bio && (
              <p className="text-xs text-[#64748B] mt-1.5 line-clamp-1">{user.bio}</p>
            )}
          </div>
          
          {/* Follow button */}
          <Button
            size="sm"
            variant={isFollowing ? "outline" : "default"}
            className={isFollowing 
              ? "border-primary/50 text-primary hover:bg-primary/10" 
              : "btn-premium"
            }
            onClick={(e) => {
              e.stopPropagation();
              onFollow();
            }}
          >
            {isFollowing ? (
              <>
                <UserCheck className="size-3.5 mr-1" />
                ติดตามแล้ว
              </>
            ) : (
              <>
                <UserPlus className="size-3.5 mr-1" />
                ติดตาม
              </>
            )}
          </Button>
        </div>
        
        {/* View profile button */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-3 text-[#64748B] hover:text-white hover:bg-white/5"
          onClick={onViewProfile}
        >
          ดูโพยทั้งหมด
          <ChevronRight className="size-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

// Public bet card component
function PublicBetCard({ bet, onCopy }: { bet: any; onCopy: () => void }) {
  const user = bet.customers || {};
  const betData = bet.bets || {};
  const items = betData.bet_items || [];
  const lottery = betData.lotteries || {};
  
  // Calculate time ago
  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'เมื่อสักครู่';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} นาทีที่แล้ว`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} ชม.ที่แล้ว`;
    return `${Math.floor(seconds / 86400)} วันที่แล้ว`;
  };
  
  return (
    <Card className="glass-card border-0 overflow-hidden">
      <CardContent className="p-4">
        {/* Header with user info */}
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="size-10">
            <AvatarImage src={user.avatar_url} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-cyan-500 text-white font-bold">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm">{user.name}</span>
              {user.lead_badge && (
                <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-[9px] px-1">
                  {user.lead_badge}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[#64748B]">
              <Clock className="size-3" />
              <span>{timeAgo(bet.created_at)}</span>
              <span>•</span>
              <span>{lottery.name || 'หวย'}</span>
            </div>
          </div>
          
          {/* Amount badge */}
          <Badge className="bg-amber-500/20 text-amber-400 border-0 font-mono">
            {bet.display_amount || '100+'}
          </Badge>
        </div>
        
        {/* Bet numbers preview */}
        <div className="bg-white/5 rounded-xl p-3 mb-3">
          <div className="flex flex-wrap gap-1.5">
            {items.slice(0, 6).map((item: any, i: number) => (
              <Badge 
                key={i}
                variant="outline" 
                className="border-white/20 text-white font-mono text-sm px-2"
              >
                {item.number}
              </Badge>
            ))}
            {items.length > 6 && (
              <Badge variant="outline" className="border-white/20 text-[#64748B]">
                +{items.length - 6}
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-[#64748B] mt-2">
            {items.length} เลข • {betData.total_amount?.toLocaleString() || bet.display_amount} บาท
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            className="flex-1 btn-premium"
            onClick={onCopy}
          >
            <Copy className="size-4 mr-2" />
            แทงตาม
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="border-white/10 text-[#64748B] hover:text-white hover:bg-white/5"
          >
            <Eye className="size-4" />
          </Button>
        </div>
        
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
}

export default function LeadBetsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('featured');
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  
  // Fetch lead users
  const { data: leadUsers, error: leadError, isLoading: leadLoading } = useSWR(
    '/api/lead-users',
    fetcher
  );
  
  // Fetch public bets
  const { data: publicBets, error: betsError, isLoading: betsLoading } = useSWR(
    '/api/public-bets',
    fetcher
  );
  
  // Fetch current user's following list
  const { data: followingData, mutate: mutateFollowing } = useSWR(
    '/api/lead-users/follow',
    fetcher
  );
  
  // Update following IDs when data changes
  useState(() => {
    if (followingData?.following) {
      setFollowingIds(followingData.following.map((f: any) => f.lead_user_id));
    }
  });
  
  const handleFollow = async (userId: string) => {
    const isCurrentlyFollowing = followingIds.includes(userId);
    
    try {
      const res = await fetch('/api/lead-users/follow', {
        method: isCurrentlyFollowing ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_user_id: userId }),
      });
      
      if (!res.ok) throw new Error('Failed to update follow');
      
      if (isCurrentlyFollowing) {
        setFollowingIds(prev => prev.filter(id => id !== userId));
        toast.success('ยกเลิกติดตามแล้ว');
      } else {
        setFollowingIds(prev => [...prev, userId]);
        toast.success('ติดตามสำเร็จ');
      }
      
      mutateFollowing();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };
  
  const handleCopyBet = async (bet: any) => {
    // Navigate to lotto page with copy parameters
    const betData = bet.bets || {};
    const lotteryId = betData.lottery_id;
    
    if (!lotteryId) {
      toast.error('ไม่พบข้อมูลหวย');
      return;
    }
    
    // Store copy data in sessionStorage
    sessionStorage.setItem('copyBet', JSON.stringify({
      publicBetId: bet.id,
      items: betData.bet_items || [],
    }));
    
    router.push(`/c/lotto/${lotteryId}?copy=true`);
    toast.success('กำลังนำไปหน้าแทงหวย');
  };
  
  const filteredUsers = leadUsers?.filter((user: any) => 
    !searchQuery || user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];
  
  const pinnedUsers = filteredUsers.filter((u: any) => u.is_pinned);
  const otherUsers = filteredUsers.filter((u: any) => !u.is_pinned);
  
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
        <div>
          <h1 className="text-xl font-bold text-white">ยูสนำแทง</h1>
          <p className="text-sm text-[#64748B]">ติดตามและแทงตามเซียนหวย</p>
        </div>
      </div>
      
      {/* Hero Banner */}
      <Card className="glass-card border-0 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-transparent to-orange-500/10" />
        <CardContent className="p-5 relative">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
              <Trophy className="size-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white">แทงตามเซียน</h2>
              <p className="text-sm text-[#94A3B8]">
                เลือกติดตามนักแทงมืออาชีพ ดูโพยและแทงตามได้ทันที
              </p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <Star className="size-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-amber-400">เซียนยอดนิยม</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <Zap className="size-3.5 text-emerald-400" />
                  <span className="text-emerald-400">อัพเดทเรียลไทม์</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-[#64748B]" />
        <Input
          placeholder="ค้นหาเซียน..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-[#64748B]"
        />
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full bg-white/5 p-1">
          <TabsTrigger value="featured" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-white">
            <Flame className="size-4 mr-1.5" />
            แนะนำ
          </TabsTrigger>
          <TabsTrigger value="following" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-white">
            <Heart className="size-4 mr-1.5" />
            ติดตาม
          </TabsTrigger>
          <TabsTrigger value="bets" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-white">
            <Copy className="size-4 mr-1.5" />
            โพยล่าสุด
          </TabsTrigger>
        </TabsList>
        
        {/* Featured Tab */}
        <TabsContent value="featured" className="mt-4 space-y-4">
          {leadLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Pinned users */}
              {pinnedUsers.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Crown className="size-4 text-amber-400" />
                    <span className="text-sm font-semibold text-amber-400">เซียนยอดนิยม</span>
                  </div>
                  {pinnedUsers.map((user: any) => (
                    <LeadUserCard
                      key={user.id}
                      user={user}
                      isFollowing={followingIds.includes(user.id)}
                      onFollow={() => handleFollow(user.id)}
                      onViewProfile={() => router.push(`/c/lead-bets/${user.id}`)}
                    />
                  ))}
                </div>
              )}
              
              {/* Other users */}
              {otherUsers.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Users className="size-4 text-[#64748B]" />
                    <span className="text-sm font-semibold text-[#64748B]">เซียนทั้งหมด</span>
                  </div>
                  {otherUsers.map((user: any) => (
                    <LeadUserCard
                      key={user.id}
                      user={user}
                      isFollowing={followingIds.includes(user.id)}
                      onFollow={() => handleFollow(user.id)}
                      onViewProfile={() => router.push(`/c/lead-bets/${user.id}`)}
                    />
                  ))}
                </div>
              )}
              
              {filteredUsers.length === 0 && (
                <div className="text-center py-12">
                  <Users className="size-12 text-[#64748B] mx-auto mb-3" />
                  <p className="text-[#64748B]">ยังไม่มีเซียนในระบบ</p>
                </div>
              )}
            </>
          )}
        </TabsContent>
        
        {/* Following Tab */}
        <TabsContent value="following" className="mt-4 space-y-3">
          {followingIds.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="size-12 text-[#64748B] mx-auto mb-3" />
              <p className="text-[#64748B]">คุณยังไม่ได้ติดตามใคร</p>
              <Button
                variant="outline"
                className="mt-3 border-primary/50 text-primary"
                onClick={() => setActiveTab('featured')}
              >
                เลือกเซียนเพื่อติดตาม
              </Button>
            </div>
          ) : (
            filteredUsers
              .filter((user: any) => followingIds.includes(user.id))
              .map((user: any) => (
                <LeadUserCard
                  key={user.id}
                  user={user}
                  isFollowing={true}
                  onFollow={() => handleFollow(user.id)}
                  onViewProfile={() => router.push(`/c/lead-bets/${user.id}`)}
                />
              ))
          )}
        </TabsContent>
        
        {/* Latest Bets Tab */}
        <TabsContent value="bets" className="mt-4 space-y-3">
          {betsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : publicBets?.length > 0 ? (
            publicBets.map((bet: any) => (
              <PublicBetCard
                key={bet.id}
                bet={bet}
                onCopy={() => handleCopyBet(bet)}
              />
            ))
          ) : (
            <div className="text-center py-12">
              <Copy className="size-12 text-[#64748B] mx-auto mb-3" />
              <p className="text-[#64748B]">ยังไม่มีโพยในขณะนี้</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
