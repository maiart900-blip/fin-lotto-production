'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Copy, 
  Check, 
  Share2, 
  Users, 
  Banknote, 
  TrendingUp,
  Gift,
  Link as LinkIcon,
  QrCode,
  MessageCircle
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency } from '@/lib/utils'

interface ReferralStats {
  totalReferrals: number
  totalCommission: number
  commissionRate: number
}

interface Referral {
  id: string
  referred_customer_id: string
  commission_percent: number
  created_at: string
  referred?: {
    username: string
    display_name: string
    created_at: string
  }
}

export default function AffiliatePage() {
  const { user } = useAuth()
  const [referralCode, setReferralCode] = useState('')
  const [affiliateLink, setAffiliateLink] = useState('')
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrals: 0,
    totalCommission: 0,
    commissionRate: 5
  })
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAffiliateData()
  }, [user])

  const fetchAffiliateData = async () => {
    if (!user) return
    
    try {
      const response = await fetch('/api/affiliate', {
        headers: {
          'x-user-id': user.id
        }
      })
      const data = await response.json()
      
      if (data.success) {
        setReferralCode(data.data.referralCode)
        setAffiliateLink(data.data.affiliateLink)
        setStats(data.data.stats)
        setReferrals(data.data.referrals)
      }
    } catch (error) {
      console.error('Failed to fetch affiliate data:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const shareToLine = () => {
    const message = encodeURIComponent(
      `สมัครสมาชิก FIN LOTTO R+ รับโบนัสทันที!\n\n${affiliateLink}`
    )
    window.open(`https://line.me/R/msg/text/?${message}`, '_blank')
  }

  const shareToFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(affiliateLink)}`,
      '_blank'
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ลิงก์แนะนำเพื่อน</h1>
          <p className="text-muted-foreground">แชร์ลิงก์และรับค่าคอมมิชชั่น {stats.commissionRate}% จากทุกการฝากเงิน</p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          <Gift className="w-4 h-4 mr-2" />
          รับ {stats.commissionRate}%
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">สมาชิกที่แนะนำ</p>
                <p className="text-3xl font-bold text-amber-500">{stats.totalReferrals}</p>
              </div>
              <Users className="w-10 h-10 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ค่าคอมมิชชั่นรวม</p>
                <p className="text-3xl font-bold text-green-500">{formatCurrency(stats.totalCommission)}</p>
              </div>
              <Banknote className="w-10 h-10 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">อัตราค่าคอมมิชชั่น</p>
                <p className="text-3xl font-bold text-blue-500">{stats.commissionRate}%</p>
              </div>
              <TrendingUp className="w-10 h-10 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referral Link Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            ลิงก์แนะนำของคุณ
          </CardTitle>
          <CardDescription>
            แชร์ลิงก์นี้ให้เพื่อนเพื่อรับค่าคอมมิชชั่น
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Referral Code */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">รหัสแนะนำ</label>
            <div className="flex gap-2">
              <Input 
                value={referralCode} 
                readOnly 
                className="font-mono text-lg font-bold text-center bg-muted"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(referralCode)}
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Affiliate Link */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">ลิงก์แนะนำ</label>
            <div className="flex gap-2">
              <Input 
                value={affiliateLink} 
                readOnly 
                className="font-mono text-sm bg-muted"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(affiliateLink)}
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Share Buttons */}
          <div className="flex flex-wrap gap-2 pt-4">
            <Button 
              onClick={() => copyToClipboard(affiliateLink)}
              className="flex-1 min-w-[140px]"
            >
              <Copy className="w-4 h-4 mr-2" />
              คัดลอกลิงก์
            </Button>
            <Button 
              variant="outline"
              onClick={shareToLine}
              className="flex-1 min-w-[140px] bg-[#00B900] hover:bg-[#00A000] text-white border-0"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              แชร์ LINE
            </Button>
            <Button 
              variant="outline"
              onClick={shareToFacebook}
              className="flex-1 min-w-[140px] bg-[#1877F2] hover:bg-[#166FE5] text-white border-0"
            >
              <Share2 className="w-4 h-4 mr-2" />
              แชร์ Facebook
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Referral History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            ประวัติการแนะนำ
          </CardTitle>
          <CardDescription>
            รายชื่อสมาชิกที่สมัครผ่านลิงก์ของคุณ
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>ยังไม่มีสมาชิกที่สมัครผ่านลิงก์ของคุณ</p>
              <p className="text-sm mt-2">แชร์ลิงก์ด้านบนเพื่อเริ่มรับค่าคอมมิชชั่น</p>
            </div>
          ) : (
            <div className="space-y-3">
              {referrals.map((referral) => (
                <div 
                  key={referral.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {referral.referred?.display_name || referral.referred?.username || 'สมาชิกใหม่'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        สมัครเมื่อ {new Date(referral.created_at).toLocaleDateString('th-TH')}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {referral.commission_percent}% คอมมิชชั่น
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle>วิธีการทำงาน</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                <Share2 className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="font-semibold mb-2">1. แชร์ลิงก์</h3>
              <p className="text-sm text-muted-foreground">
                คัดลอกลิงก์แนะนำและแชร์ให้เพื่อนผ่าน LINE, Facebook หรือช่องทางอื่นๆ
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="font-semibold mb-2">2. เพื่อนสมัครสมาชิก</h3>
              <p className="text-sm text-muted-foreground">
                เมื่อเพื่อนคลิกลิงก์และสมัครสมาชิก ระบบจะบันทึกว่าเป็นคนที่คุณแนะนำ
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                <Banknote className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="font-semibold mb-2">3. รับค่าคอมมิชชั่น</h3>
              <p className="text-sm text-muted-foreground">
                รับค่าคอมมิชชั่น {stats.commissionRate}% จากทุกการฝากเงินของสมาชิกที่คุณแนะนำ
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
