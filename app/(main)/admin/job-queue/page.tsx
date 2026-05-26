'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  RefreshCw, 
  Play, 
  Pause, 
  RotateCcw, 
  XCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Eye,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetcher } from '@/lib/fetcher';

interface JobStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  deadLetter: number;
  todayStats: {
    enqueued: number;
    completed: number;
    failed: number;
    retried: number;
    avgDuration: number;
  };
  byType: Record<string, number>;
  recentErrors: Array<{
    id: string;
    type: string;
    name?: string;
    error?: string;
    failedAt?: string;
    attempts: number;
  }>;
  jobTypes: string[];
}

interface Job {
  id: string;
  type: string;
  name?: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  max_attempts: number;
  priority: number;
  scheduled_at: string;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  error_message?: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  running: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  dead_letter: 'bg-purple-100 text-purple-800 border-purple-200',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" />,
  running: <Loader2 className="h-3 w-3 animate-spin" />,
  completed: <CheckCircle2 className="h-3 w-3" />,
  failed: <AlertCircle className="h-3 w-3" />,
  cancelled: <XCircle className="h-3 w-3" />,
  dead_letter: <Trash2 className="h-3 w-3" />,
};

export default function JobQueuePage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newJobType, setNewJobType] = useState('');
  const [newJobPayload, setNewJobPayload] = useState('{}');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch stats
  const { data: statsData, error: statsError, mutate: mutateStats } = useSWR<{ success: boolean; data: JobStats }>(
    '/api/jobs/stats',
    fetcher,
    { refreshInterval: 5000 }
  );
  
  // Fetch jobs list
  const jobsUrl = `/api/jobs?type=list${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}${typeFilter !== 'all' ? `&jobType=${typeFilter}` : ''}&limit=50`;
  const { data: jobsData, error: jobsError, mutate: mutateJobs } = useSWR<{ success: boolean; data: Job[]; pagination: { total: number } }>(
    jobsUrl,
    fetcher,
    { refreshInterval: 5000 }
  );
  
  const stats = statsData?.data;
  const jobs = jobsData?.data || [];
  const isLoading = !statsData && !statsError;
  
  const handleRefresh = () => {
    mutateStats();
    mutateJobs();
    toast.success('Refreshed');
  };
  
  const handleRetry = async (jobId: string) => {
    try {
      const res = await fetch('/api/jobs/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobId }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.success('Job queued for retry');
        mutateJobs();
        mutateStats();
      } else {
        toast.error(data.error || 'Failed to retry job');
      }
    } catch {
      toast.error('Failed to retry job');
    }
  };
  
  const handleCancel = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this job?')) return;
    
    try {
      const res = await fetch('/api/jobs/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobId }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.success('Job cancelled');
        mutateJobs();
        mutateStats();
      } else {
        toast.error(data.error || 'Failed to cancel job');
      }
    } catch {
      toast.error('Failed to cancel job');
    }
  };
  
  const handleCreateJob = async () => {
    if (!newJobType) {
      toast.error('Please select a job type');
      return;
    }
    
    let payload = {};
    try {
      payload = JSON.parse(newJobPayload);
    } catch {
      toast.error('Invalid JSON payload');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: newJobType,
          payload,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.success('Job created successfully');
        setShowCreateDialog(false);
        setNewJobType('');
        setNewJobPayload('{}');
        mutateJobs();
        mutateStats();
      } else {
        toast.error(data.error || 'Failed to create job');
      }
    } catch {
      toast.error('Failed to create job');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Job Queue Monitor</h1>
          <p className="text-muted-foreground">
            Monitor and manage background jobs
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Job
          </Button>
        </div>
      </div>
      
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Running</p>
                  <p className="text-2xl font-bold">{stats.running}</p>
                </div>
                <Loader2 className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold">{stats.failed}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Dead Letter</p>
                  <p className="text-2xl font-bold">{stats.deadLetter}</p>
                </div>
                <Trash2 className="h-8 w-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Today's Stats */}
      {stats?.todayStats && (
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Enqueued</p>
                <p className="text-xl font-semibold">{stats.todayStats.enqueued}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-xl font-semibold text-green-600">{stats.todayStats.completed}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-xl font-semibold text-red-600">{stats.todayStats.failed}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Retried</p>
                <p className="text-xl font-semibold text-yellow-600">{stats.todayStats.retried}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Duration</p>
                <p className="text-xl font-semibold">{stats.todayStats.avgDuration}ms</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Recent Errors */}
      {stats?.recentErrors && stats.recentErrors.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Recent Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.recentErrors.map((err) => (
                <div key={err.id} className="flex items-start justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{err.type}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {err.name || err.id.slice(0, 8)}
                      </span>
                    </div>
                    <p className="text-sm text-red-600 mt-1">{err.error}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Failed at: {formatDate(err.failedAt)} | Attempts: {err.attempts}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleRetry(err.id)}>
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Jobs List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Jobs</CardTitle>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="dead_letter">Dead Letter</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {stats?.jobTypes?.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono text-xs">
                    {job.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{job.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[job.status] || ''}>
                      <span className="mr-1">{STATUS_ICONS[job.status]}</span>
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{job.priority}</TableCell>
                  <TableCell>{job.attempts}/{job.max_attempts}</TableCell>
                  <TableCell className="text-xs">{formatDate(job.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedJob(job)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {['failed', 'dead_letter', 'cancelled'].includes(job.status) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRetry(job.id)}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      {job.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancel(job.id)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {jobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No jobs found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Job Detail Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Job Details</DialogTitle>
            <DialogDescription>
              ID: {selectedJob?.id}
            </DialogDescription>
          </DialogHeader>
          
          {selectedJob && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">{selectedJob.type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={STATUS_COLORS[selectedJob.status] || ''}>
                    {selectedJob.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Priority</p>
                  <p className="font-medium">{selectedJob.priority}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Attempts</p>
                  <p className="font-medium">{selectedJob.attempts}/{selectedJob.max_attempts}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDate(selectedJob.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                  <p className="font-medium">{formatDate(selectedJob.scheduled_at)}</p>
                </div>
                {selectedJob.started_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Started</p>
                    <p className="font-medium">{formatDate(selectedJob.started_at)}</p>
                  </div>
                )}
                {selectedJob.completed_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="font-medium">{formatDate(selectedJob.completed_at)}</p>
                  </div>
                )}
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-2">Payload</p>
                <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto max-h-40">
                  {JSON.stringify(selectedJob.payload, null, 2)}
                </pre>
              </div>
              
              {selectedJob.error_message && (
                <div>
                  <p className="text-sm text-red-600 mb-2">Error</p>
                  <pre className="bg-red-50 p-3 rounded-lg text-xs text-red-700 overflow-auto max-h-40">
                    {selectedJob.error_message}
                  </pre>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            {selectedJob && ['failed', 'dead_letter', 'cancelled'].includes(selectedJob.status) && (
              <Button onClick={() => { handleRetry(selectedJob.id); setSelectedJob(null); }}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry Job
              </Button>
            )}
            <Button variant="outline" onClick={() => setSelectedJob(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Create Job Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Job</DialogTitle>
            <DialogDescription>
              Create a new background job
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Job Type</label>
              <Select value={newJobType} onValueChange={setNewJobType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select job type" />
                </SelectTrigger>
                <SelectContent>
                  {stats?.jobTypes?.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium">Payload (JSON)</label>
              <textarea
                className="w-full h-32 p-3 border rounded-lg font-mono text-sm"
                value={newJobPayload}
                onChange={(e) => setNewJobPayload(e.target.value)}
                placeholder='{"key": "value"}'
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateJob} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
