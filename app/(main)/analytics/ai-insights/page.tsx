'use client';

import { useState } from 'react';
import { 
  Brain, 
  TrendingUp, 
  Users, 
  AlertTriangle,
  Target,
  Lightbulb,
  RefreshCw,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Minus,
  Shield,
  Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Risk Level Badge
function RiskBadge({ level }: { level: string }) {
  const colors = {
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    critical: 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colors[level as keyof typeof colors] || colors.medium}`}>
      {level === 'critical' ? 'วิกฤต' : level === 'high' ? 'สูง' : level === 'medium' ? 'ปานกลาง' : 'ต่ำ'}
    </span>
  );
}

// Trend Icon
function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'rising') return <ArrowUp className="size-4 text-red-400" />;
  if (trend === 'falling') return <ArrowDown className="size-4 text-green-400" />;
  return <Minus className="size-4 text-[#64748B]" />;
}

export default function AIInsightsPage() {
  const [activeTab, setActiveTab] = useState<'predictions' | 'churn' | 'agents'>('predictions');
  const [selectedLottery, setSelectedLottery] = useState<string>('all');

  const { data: analytics, isLoading, mutate } = useSWR(
    `/api/analytics/ai?lottery=${selectedLottery}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  const { data: lotteries } = useSWR('/api/lotteries', fetcher);

  return (
    <div className="min-h-screen live-midnight-canvas p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#F5E1A4] flex items-center gap-3">
              <Brain className="size-8 text-[#EAB308]" />
              AI Analytics & Insights
            </h1>
            <p className="text-[#64748B] mt-1">ระบบวิเคราะห์ล่วงหน้าด้วย AI</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedLottery}
              onChange={(e) => setSelectedLottery(e.target.value)}
              className="bg-[#1E293B] border border-[#334155] text-[#94A3B8] px-4 py-2 rounded-lg focus:border-[#EAB308] focus:outline-none"
            >
              <option value="all">หวยทั้งหมด</option>
              {lotteries?.map((l: any) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>

            <Button
              onClick={() => mutate()}
              disabled={isLoading}
              className="bg-gradient-to-r from-[#EAB308] to-[#F59E0B] text-[#0F172A] hover:opacity-90"
            >
              <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              อัปเดต
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="ultra-glass-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#64748B] text-sm">เลขเสี่ยงสูง</p>
                <p className="text-2xl font-bold text-[#EF4444]">
                  {analytics?.predictedHotNumbers?.filter((n: any) => n.riskLevel === 'critical' || n.riskLevel === 'high').length || 0}
                </p>
              </div>
              <AlertTriangle className="size-10 text-[#EF4444]/50" />
            </div>
          </div>

          <div className="ultra-glass-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#64748B] text-sm">ลูกค้าเสี่ยงหาย</p>
                <p className="text-2xl font-bold text-[#F59E0B]">
                  {analytics?.churnRiskCustomers?.filter((c: any) => c.riskLevel === 'critical' || c.riskLevel === 'high').length || 0}
                </p>
              </div>
              <Users className="size-10 text-[#F59E0B]/50" />
            </div>
          </div>

          <div className="ultra-glass-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#64748B] text-sm">มูลค่าเสี่ยง</p>
                <p className="text-2xl font-bold text-[#EAB308]">
                  {(analytics?.totalAtRiskValue || 0).toLocaleString()}
                </p>
              </div>
              <Target className="size-10 text-[#EAB308]/50" />
            </div>
          </div>

          <div className="ultra-glass-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#64748B] text-sm">คำแนะนำ AI</p>
                <p className="text-2xl font-bold text-[#22C55E]">
                  {analytics?.recommendations?.length || 0}
                </p>
              </div>
              <Lightbulb className="size-10 text-[#22C55E]/50" />
            </div>
          </div>
        </div>

        {/* AI Recommendations */}
        {analytics?.recommendations?.length > 0 && (
          <div className="ultra-glass-card p-4">
            <h3 className="text-[#F5E1A4] font-semibold mb-3 flex items-center gap-2">
              <Lightbulb className="size-5 text-[#EAB308]" />
              คำแนะนำจาก AI
            </h3>
            <div className="space-y-2">
              {analytics.recommendations.map((rec: string, idx: number) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-[#1E293B]/50 rounded-lg border border-[#EAB308]/20"
                >
                  <ChevronRight className="size-5 text-[#EAB308] mt-0.5 flex-shrink-0" />
                  <p className="text-[#94A3B8]">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-[#334155] pb-2">
          <button
            onClick={() => setActiveTab('predictions')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-all ${
              activeTab === 'predictions'
                ? 'bg-[#EAB308]/20 text-[#EAB308] border-b-2 border-[#EAB308]'
                : 'text-[#64748B] hover:text-[#94A3B8]'
            }`}
          >
            <TrendingUp className="size-4 inline mr-2" />
            Predictive Risk
          </button>
          <button
            onClick={() => setActiveTab('churn')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-all ${
              activeTab === 'churn'
                ? 'bg-[#EAB308]/20 text-[#EAB308] border-b-2 border-[#EAB308]'
                : 'text-[#64748B] hover:text-[#94A3B8]'
            }`}
          >
            <Users className="size-4 inline mr-2" />
            Customer Churn
          </button>
          <button
            onClick={() => setActiveTab('agents')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-all ${
              activeTab === 'agents'
                ? 'bg-[#EAB308]/20 text-[#EAB308] border-b-2 border-[#EAB308]'
                : 'text-[#64748B] hover:text-[#94A3B8]'
            }`}
          >
            <Crown className="size-4 inline mr-2" />
            Agent Churn
          </button>
        </div>

        {/* Tab Content */}
        <div className="ultra-glass-card p-6">
          {activeTab === 'predictions' && (
            <div className="space-y-4">
              <h3 className="text-[#F5E1A4] font-semibold flex items-center gap-2">
                <TrendingUp className="size-5 text-[#EAB308]" />
                เลขที่คาดว่าจะมียอดแทงสูง (งวดถัดไป)
              </h3>

              {isLoading ? (
                <div className="text-center py-8 text-[#64748B]">กำลังวิเคราะห์...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#334155]">
                        <th className="text-left py-3 px-4 text-[#64748B] font-medium">เลข</th>
                        <th className="text-right py-3 px-4 text-[#64748B] font-medium">คาดการณ์ยอด</th>
                        <th className="text-right py-3 px-4 text-[#64748B] font-medium">เฉลี่ยที่ผ่านมา</th>
                        <th className="text-center py-3 px-4 text-[#64748B] font-medium">แนวโน้ม</th>
                        <th className="text-center py-3 px-4 text-[#64748B] font-medium">ความเสี่ยง</th>
                        <th className="text-right py-3 px-4 text-[#64748B] font-medium">Limit แนะนำ</th>
                        <th className="text-left py-3 px-4 text-[#64748B] font-medium">เหตุผล</th>
                        <th className="text-center py-3 px-4 text-[#64748B] font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics?.predictedHotNumbers?.map((num: any, idx: number) => (
                        <tr key={num.number} className="border-b border-[#1E293B] hover:bg-[#1E293B]/50">
                          <td className="py-3 px-4">
                            <span className="font-mono text-xl font-bold text-[#FDE047]">{num.number}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-[#F5E1A4] font-semibold">{num.predictedVolume.toLocaleString()}</span>
                          </td>
                          <td className="py-3 px-4 text-right text-[#94A3B8]">
                            {num.historicalAvg.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <TrendIcon trend={num.trend} />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <RiskBadge level={num.riskLevel} />
                          </td>
                          <td className="py-3 px-4 text-right text-[#94A3B8]">
                            {num.suggestedLimit.toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {num.reasons.slice(0, 2).map((r: string, i: number) => (
                                <span key={i} className="text-xs bg-[#1E293B] text-[#64748B] px-2 py-0.5 rounded">
                                  {r}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-[#EAB308] text-[#EAB308] hover:bg-[#EAB308]/20"
                            >
                              <Shield className="size-3 mr-1" />
                              อั้น
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'churn' && (
            <div className="space-y-4">
              <h3 className="text-[#F5E1A4] font-semibold flex items-center gap-2">
                <Users className="size-5 text-[#EAB308]" />
                ลูกค้าที่เสี่ยงจะหายไป
              </h3>

              {isLoading ? (
                <div className="text-center py-8 text-[#64748B]">กำลังวิเคราะห์...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#334155]">
                        <th className="text-left py-3 px-4 text-[#64748B] font-medium">ลูกค้า</th>
                        <th className="text-center py-3 px-4 text-[#64748B] font-medium">Risk Score</th>
                        <th className="text-center py-3 px-4 text-[#64748B] font-medium">ระดับ</th>
                        <th className="text-right py-3 px-4 text-[#64748B] font-medium">วันที่ไม่มีกิจกรรม</th>
                        <th className="text-right py-3 px-4 text-[#64748B] font-medium">Lifetime Value</th>
                        <th className="text-left py-3 px-4 text-[#64748B] font-medium">คำแนะนำ</th>
                        <th className="text-center py-3 px-4 text-[#64748B] font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics?.churnRiskCustomers?.map((customer: any) => (
                        <tr key={customer.customerId} className="border-b border-[#1E293B] hover:bg-[#1E293B]/50">
                          <td className="py-3 px-4">
                            <span className="text-[#F5E1A4] font-medium">{customer.customerName}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-2 bg-[#1E293B] rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    customer.riskScore >= 70 ? 'bg-red-500' :
                                    customer.riskScore >= 50 ? 'bg-orange-500' :
                                    customer.riskScore >= 30 ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${customer.riskScore}%` }}
                                />
                              </div>
                              <span className="text-[#94A3B8] text-sm">{customer.riskScore}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <RiskBadge level={customer.riskLevel} />
                          </td>
                          <td className="py-3 px-4 text-right text-[#94A3B8]">
                            {customer.daysSinceLastBet} วัน
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-[#EAB308] font-semibold">
                              {customer.totalLifetimeValue.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs text-[#64748B]">{customer.suggestedAction}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button
                              size="sm"
                              className="bg-gradient-to-r from-[#EAB308] to-[#F59E0B] text-[#0F172A]"
                            >
                              ส่งโปรโมชั่น
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="space-y-4">
              <h3 className="text-[#F5E1A4] font-semibold flex items-center gap-2">
                <Crown className="size-5 text-[#EAB308]" />
                Agent ที่เสี่ยงจะหยุดทำงาน
              </h3>

              {isLoading ? (
                <div className="text-center py-8 text-[#64748B]">กำลังวิเคราะห์...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#334155]">
                        <th className="text-left py-3 px-4 text-[#64748B] font-medium">Agent</th>
                        <th className="text-center py-3 px-4 text-[#64748B] font-medium">Risk Score</th>
                        <th className="text-center py-3 px-4 text-[#64748B] font-medium">ระดับ</th>
                        <th className="text-right py-3 px-4 text-[#64748B] font-medium">ยอดเปลี่ยนแปลง</th>
                        <th className="text-left py-3 px-4 text-[#64748B] font-medium">คำแนะนำ</th>
                        <th className="text-center py-3 px-4 text-[#64748B] font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics?.churnRiskAgents?.map((agent: any) => (
                        <tr key={agent.agentId} className="border-b border-[#1E293B] hover:bg-[#1E293B]/50">
                          <td className="py-3 px-4">
                            <span className="text-[#F5E1A4] font-medium">{agent.agentName}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-2 bg-[#1E293B] rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    agent.riskScore >= 60 ? 'bg-red-500' :
                                    agent.riskScore >= 40 ? 'bg-orange-500' :
                                    agent.riskScore >= 20 ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${agent.riskScore}%` }}
                                />
                              </div>
                              <span className="text-[#94A3B8] text-sm">{agent.riskScore}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <RiskBadge level={agent.riskLevel} />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={agent.monthlyVolumeChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {agent.monthlyVolumeChange >= 0 ? '+' : ''}{agent.monthlyVolumeChange}%
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs text-[#64748B]">{agent.suggestedAction}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-[#EAB308] text-[#EAB308] hover:bg-[#EAB308]/20"
                            >
                              ติดต่อ
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
