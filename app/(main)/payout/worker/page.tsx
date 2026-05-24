'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { 
  Play, 
  Pause, 
  Trash2, 
  RefreshCw, 
  Zap, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Activity,
  Server,
  Layers,
  TrendingUp,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}

interface PayoutJob {
  id: string;
  lottery_id: string;
  round_id: string;
  total_winners: number;
  processed_count: number;
  total_payout: number;
  status: string;
  started_at: string;
  completed_at: string;
}

interface QueueData {
  payoutQueue: QueueStats;
  batchQueue: QueueStats;
  combined: {
    totalWaiting: number;
    totalActive: number;
    totalCompleted: number;
    totalFailed: number;
  };
  recentJobs: PayoutJob[];
}

// Stats Card Component
function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  color = 'gold' 
}: { 
  title: string; 
  value: number | string; 
  icon: any; 
  trend?: string;
  color?: 'gold' | 'green' | 'red' | 'blue';
}) {
  const colorClasses = {
    gold: 'text-[#EAB308] border-[#EAB308]/30',
    green: 'text-emerald-500 border-emerald-500/30',
    red: 'text-red-500 border-red-500/30',
    blue: 'text-blue-500 border-blue-500/30',
  };

  return (
    <div className={`gold-stats-card p-5 border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[#64748B] text-sm font-medium">{title}</span>
        <Icon className={`size-5 ${colorClasses[color].split(' ')[0]}`} />
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {trend && (
          <span className="text-xs text-[#64748B] mb-1">{trend}</span>
        )}
      </div>
    </div>
  );
}

// Queue Progress Component
function QueueProgress({ stats, title }: { stats: QueueStats; title: string }) {
  const total = stats.waiting + stats.active + stats.completed + stats.failed;
  const completedPercent = total > 0 ? (stats.completed / total) * 100 : 0;
  const failedPercent = total > 0 ? (stats.failed / total) * 100 : 0;
  
  return (
    <div className="ultra-glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">{title}</h3>
        <Badge variant="outline" className="border-[#EAB308]/50 text-[#EAB308]">
          {stats.active > 0 ? 'Processing' : stats.waiting > 0 ? 'Queued' : 'Idle'}
        </Badge>
      </div>
      
      <div className="grid grid-cols-5 gap-3 text-center">
        <div>
          <div className="text-2xl font-bold text-yellow-500">{stats.waiting}</div>
          <div className="text-xs text-[#64748B]">Waiting</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-blue-500">{stats.active}</div>
          <div className="text-xs text-[#64748B]">Active</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-emerald-500">{stats.completed}</div>
          <div className="text-xs text-[#64748B]">Done</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
          <div className="text-xs text-[#64748B]">Failed</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-[#64748B]">{stats.delayed}</div>
          <div className="text-xs text-[#64748B]">Delayed</div>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-[#64748B]">
          <span>Progress</span>
          <span>{completedPercent.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-[#1E293B] rounded-full overflow-hidden flex">
          <div 
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${completedPercent}%` }}
          />
          <div 
            className="h-full bg-red-500 transition-all duration-500"
            style={{ width: `${failedPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Job Status Badge
function JobStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { color: string; label: string }> = {
    pending: { color: 'bg-yellow-500/20 text-yellow-500', label: 'Pending' },
    processing: { color: 'bg-blue-500/20 text-blue-500', label: 'Processing' },
    completed: { color: 'bg-emerald-500/20 text-emerald-500', label: 'Completed' },
    failed: { color: 'bg-red-500/20 text-red-500', label: 'Failed' },
  };
  
  const config = statusConfig[status] || statusConfig.pending;
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

export default function PayoutWorkerDashboard() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const { data, error, isLoading, mutate } = useSWR<QueueData>(
    '/api/payout/queue',
    fetcher,
    { refreshInterval: 2000 } // Refresh every 2 seconds
  );

  // Handle queue actions
  const handleQueueAction = async (action: 'pause' | 'resume' | 'clean') => {
    setActionLoading(action);
    try {
      const res = await fetch('/api/payout/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      
      if (res.ok) {
        mutate();
      }
    } catch (error) {
      console.error('Queue action failed:', error);
    } finally {
      setActionLoading(null);
    }
  };

  // Calculate throughput
  const throughput = data?.combined 
    ? Math.round((data.combined.totalCompleted / Math.max(1, data.combined.totalCompleted + data.combined.totalFailed)) * 100)
    : 0;

  return (
    <div className="live-midnight-canvas min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#EAB308] to-[#FDE047]">
              Payout Worker Dashboard
            </h1>
            <p className="text-[#64748B] mt-1">
              High-Performance BullMQ Payout Processing System
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutate()}
              className="border-[#334155] text-[#94A3B8] hover:bg-[#1E293B]"
            >
              <RefreshCw className="size-4 mr-2" />
              Refresh
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQueueAction('pause')}
              disabled={actionLoading === 'pause'}
              className="border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10"
            >
              {actionLoading === 'pause' ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Pause className="size-4 mr-2" />
              )}
              Pause
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQueueAction('resume')}
              disabled={actionLoading === 'resume'}
              className="border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10"
            >
              {actionLoading === 'resume' ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Play className="size-4 mr-2" />
              )}
              Resume
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQueueAction('clean')}
              disabled={actionLoading === 'clean'}
              className="border-red-500/50 text-red-500 hover:bg-red-500/10"
            >
              {actionLoading === 'clean' ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="size-4 mr-2" />
              )}
              Clean
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4">
          <StatsCard
            title="Total Waiting"
            value={data?.combined?.totalWaiting || 0}
            icon={Clock}
            color="gold"
          />
          <StatsCard
            title="Active Processing"
            value={data?.combined?.totalActive || 0}
            icon={Activity}
            color="blue"
          />
          <StatsCard
            title="Completed"
            value={data?.combined?.totalCompleted || 0}
            icon={CheckCircle2}
            color="green"
          />
          <StatsCard
            title="Failed"
            value={data?.combined?.totalFailed || 0}
            icon={XCircle}
            color="red"
          />
        </div>

        {/* Queue Progress */}
        <div className="grid grid-cols-2 gap-6">
          {data?.payoutQueue && (
            <QueueProgress stats={data.payoutQueue} title="Payout Queue" />
          )}
          {data?.batchQueue && (
            <QueueProgress stats={data.batchQueue} title="Batch Processing Queue" />
          )}
        </div>

        {/* Throughput Metrics */}
        <div className="ultra-glass-card p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="size-5 text-[#EAB308]" />
            Performance Metrics
          </h3>
          
          <div className="grid grid-cols-4 gap-6">
            <div className="text-center">
              <div className="relative w-24 h-24 mx-auto">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="#1E293B"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="#EAB308"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${throughput * 2.51} 251`}
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">{throughput}%</span>
                </div>
              </div>
              <p className="text-[#64748B] text-sm mt-2">Success Rate</p>
            </div>
            
            <div className="flex flex-col justify-center">
              <div className="text-4xl font-bold text-[#EAB308]">1M+</div>
              <div className="text-[#64748B] text-sm">Records Capacity</div>
            </div>
            
            <div className="flex flex-col justify-center">
              <div className="text-4xl font-bold text-emerald-500">1000</div>
              <div className="text-[#64748B] text-sm">Batch Size</div>
            </div>
            
            <div className="flex flex-col justify-center">
              <div className="text-4xl font-bold text-blue-500">10x</div>
              <div className="text-[#64748B] text-sm">Concurrency</div>
            </div>
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="ultra-glass-card p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Layers className="size-5 text-[#EAB308]" />
            Recent Payout Jobs
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#334155]">
                  <th className="text-left py-3 px-4 text-[#64748B] font-medium text-sm">Job ID</th>
                  <th className="text-left py-3 px-4 text-[#64748B] font-medium text-sm">Lottery</th>
                  <th className="text-right py-3 px-4 text-[#64748B] font-medium text-sm">Winners</th>
                  <th className="text-right py-3 px-4 text-[#64748B] font-medium text-sm">Processed</th>
                  <th className="text-right py-3 px-4 text-[#64748B] font-medium text-sm">Total Payout</th>
                  <th className="text-center py-3 px-4 text-[#64748B] font-medium text-sm">Status</th>
                  <th className="text-right py-3 px-4 text-[#64748B] font-medium text-sm">Started</th>
                </tr>
              </thead>
              <tbody>
                {data?.recentJobs?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[#64748B]">
                      No payout jobs yet
                    </td>
                  </tr>
                )}
                {data?.recentJobs?.map((job) => (
                  <tr key={job.id} className="border-b border-[#334155]/50 hover:bg-[#1E293B]/50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono text-sm text-[#EAB308]">
                        {job.id.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="py-3 px-4 text-white">{job.lottery_id}</td>
                    <td className="py-3 px-4 text-right text-white font-mono">
                      {job.total_winners?.toLocaleString() || 0}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-emerald-500 font-mono">
                        {job.processed_count?.toLocaleString() || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-[#FDE047] font-mono font-bold">
                        {job.total_payout?.toLocaleString() || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <JobStatusBadge status={job.status} />
                    </td>
                    <td className="py-3 px-4 text-right text-[#64748B] text-sm">
                      {job.started_at ? new Date(job.started_at).toLocaleString('th-TH') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Worker Status */}
        <div className="grid grid-cols-2 gap-6">
          <div className="luxury-stats-panel p-6 relative overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-white font-semibold">Payout Worker</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-[#64748B]">
                <span>Status</span>
                <span className="text-emerald-500">Running</span>
              </div>
              <div className="flex justify-between text-[#64748B]">
                <span>Concurrency</span>
                <span className="text-white">1 (Sequential)</span>
              </div>
              <div className="flex justify-between text-[#64748B]">
                <span>Rate Limit</span>
                <span className="text-white">10 jobs/sec</span>
              </div>
            </div>
          </div>
          
          <div className="luxury-stats-panel p-6 relative overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-white font-semibold">Batch Worker</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-[#64748B]">
                <span>Status</span>
                <span className="text-emerald-500">Running</span>
              </div>
              <div className="flex justify-between text-[#64748B]">
                <span>Concurrency</span>
                <span className="text-white">10 (Parallel)</span>
              </div>
              <div className="flex justify-between text-[#64748B]">
                <span>Rate Limit</span>
                <span className="text-white">100 batches/sec</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
