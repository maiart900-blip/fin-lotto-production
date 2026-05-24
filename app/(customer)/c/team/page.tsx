'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Copy, Link as LinkIcon, UserPlus, TrendingUp, Gift } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function CustomerTeamPage() {
  const { data: session } = useSWR('/api/customer/auth/session', fetcher);
  const { data: teamData } = useSWR('/api/customer/team', fetcher);
  
  const referralLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/c/register?ref=${session?.customer?.referral_code || ''}` 
    : '';
  
  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('คัดลอกลิงก์แล้ว');
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/c">
            <Button variant="ghost" size="icon" className="text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">ทีมของฉัน</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-0">
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-white/80" />
              <p className="text-3xl font-bold">{teamData?.totalMembers || 0}</p>
              <p className="text-sm text-white/70">สมาชิกทั้งหมด</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-600 to-green-700 border-0">
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-white/80" />
              <p className="text-3xl font-bold">{Number(teamData?.totalCommission || 0).toLocaleString()}</p>
              <p className="text-sm text-white/70">ค่าคอมรวม (บาท)</p>
            </CardContent>
          </Card>
        </div>

        {/* Referral Link */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-yellow-500" />
              ลิงก์แนะนำเพื่อน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-neutral-800 rounded-lg p-3 flex items-center justify-between gap-2">
              <code className="text-xs text-green-400 break-all flex-1">
                {session?.customer?.referral_code || 'กำลังโหลด...'}
              </code>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={copyLink}
                className="flex-shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-yellow-400 mb-2">
                <Gift className="h-5 w-5" />
                <span className="font-semibold">โบนัสแนะนำเพื่อน</span>
              </div>
              <p className="text-sm text-neutral-400">
                รับค่าคอมมิชชั่น {teamData?.commissionRate || 5}% จากยอดแทงของเพื่อนที่สมัครผ่านลิงก์ของคุณ
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-purple-500" />
              รายชื่อสมาชิก
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teamData?.members?.length > 0 ? (
              <div className="space-y-3">
                {teamData.members.map((member: { id: string; username: string; created_at: string; total_bets: number }) => (
                  <div key={member.id} className="bg-neutral-800 rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{member.username}</p>
                      <p className="text-xs text-neutral-500">
                        สมัครเมื่อ {new Date(member.created_at).toLocaleDateString('th-TH')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-green-400">{Number(member.total_bets || 0).toLocaleString()} บาท</p>
                      <p className="text-xs text-neutral-500">ยอดแทงรวม</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-neutral-600 mb-3" />
                <p className="text-neutral-500">ยังไม่มีสมาชิกในทีม</p>
                <p className="text-sm text-neutral-600 mt-1">แชร์ลิงก์ด้านบนเพื่อเชิญเพื่อน</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
