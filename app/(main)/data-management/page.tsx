'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { RouteGuard } from '@/components/security/route-guard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Database,
  HardDrive,
  Trash2,
  Archive,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileImage,
  History,
  Ticket,
  Shield,
  Play,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface RetentionResult {
  table: string;
  action: 'delete' | 'archive';
  recordsProcessed: number;
  success: boolean;
  error?: string;
  duration: number;
}

export default function DataManagementPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<{
    results: RetentionResult[];
    totalRecordsProcessed: number;
    totalDuration: number;
  } | null>(null);

  const { data: stats, mutate, isLoading } = useSWR('/api/system/storage-stats', fetcher, {
    refreshInterval: 60000,
  });

  const runCleanup = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    toast.loading('กำลังรันการล้างข้อมูล...');
    
    try {
      const res = await fetch('/api/cron/data-retention', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        setLastResult({
          results: data.results,
          totalRecordsProcessed: data.summary.totalRecordsProcessed,
          totalDuration: data.summary.totalDuration,
        });
        toast.success(`ล้างข้อมูลสำเร็จ: ${data.summary.totalRecordsProcessed} รายการ`);
        mutate(); // Refresh stats
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (err) {
      toast.error('ไม่สามารถรันการล้างข้อมูลได้');
    } finally {
      setIsRunning(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <RouteGuard requireSuperAdmin>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Database className="h-6 w-6 text-amber-500" />
              จัดการพื้นที่จัดเก็บข้อมูล
            </h1>
            <p className="text-slate-500">
              บริหารจัดการข้อมูลเก่า, Archive และ Cleanup อัตโนมัติ
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutate()}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              รีเฟรช
            </Button>
            <Button
              onClick={runCleanup}
              disabled={isRunning}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              รัน Cleanup ทันที
            </Button>
          </div>
        </div>

        {/* Retention Policies Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Audit Logs */}
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-purple-400" />
                Audit Logs
              </CardTitle>
              <CardDescription>ประวัติการใช้งานระบบ</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">ทั้งหมด</span>
                  <span className="font-mono text-purple-300">
                    {stats?.retention?.auditLogs?.totalRecords?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">เก่ากว่า 90 วัน</span>
                  <span className="font-mono text-orange-400">
                    {stats?.retention?.auditLogs?.oldRecords?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="pt-2 border-t border-purple-500/20">
                  <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                    <Trash2 className="h-3 w-3 mr-1" />
                    ลบหลัง 90 วัน
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lottery Bets */}
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Ticket className="h-5 w-5 text-blue-400" />
                Lottery Bets
              </CardTitle>
              <CardDescription>โพยหวยที่ตรวจผลแล้ว</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">ทั้งหมด</span>
                  <span className="font-mono text-blue-300">
                    {stats?.retention?.lotteryBets?.totalRecords?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">เก่ากว่า 180 วัน</span>
                  <span className="font-mono text-orange-400">
                    {stats?.retention?.lotteryBets?.oldRecords?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="pt-2 border-t border-blue-500/20">
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                    <Archive className="h-3 w-3 mr-1" />
                    Archive หลัง 180 วัน
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Slip Storage */}
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileImage className="h-5 w-5 text-green-400" />
                Slip Images
              </CardTitle>
              <CardDescription>รูปสลิปฝาก-ถอน (Vercel Blob)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">จำนวนไฟล์</span>
                  <span className="font-mono text-green-300">
                    {stats?.storage?.slips?.totalFiles?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">ขนาดทั้งหมด</span>
                  <span className="font-mono text-green-300">
                    {stats?.storage?.slips?.totalSize || '0 Bytes'}
                  </span>
                </div>
                <div className="pt-2 border-t border-green-500/20">
                  <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                    <Trash2 className="h-3 w-3 mr-1" />
                    ลบหลัง 90 วัน
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Storage by Category */}
        {stats?.storage?.byCategory && stats.storage.byCategory.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-slate-400" />
                พื้นที่จัดเก็บตามประเภท
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.storage.byCategory.map((cat: { category: string; count: number; size: string; sizeBytes: number }) => (
                  <div key={cat.category} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{cat.category}</span>
                      <span className="text-slate-400">
                        {cat.count} ไฟล์ ({cat.size})
                      </span>
                    </div>
                    <Progress 
                      value={(cat.sizeBytes / (stats.storage.slips.totalSizeBytes || 1)) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Last Cleanup Result */}
        {lastResult && (
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                ผลการ Cleanup ล่าสุด
              </CardTitle>
              <CardDescription>
                ประมวลผล {lastResult.totalRecordsProcessed.toLocaleString()} รายการ 
                ใน {lastResult.totalDuration}ms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {lastResult.results.map((result, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg",
                      result.success ? "bg-green-500/10" : "bg-red-500/10"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {result.success ? (
                        <CheckCircle2 className="h-5 w-5 text-green-400" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-400" />
                      )}
                      <div>
                        <p className="font-medium">{result.table}</p>
                        <p className="text-sm text-slate-400">
                          {result.action === 'delete' ? 'ลบ' : 'Archive'}: {result.recordsProcessed.toLocaleString()} รายการ
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={result.success ? "border-green-500/30" : "border-red-500/30"}
                    >
                      {result.success ? 'สำเร็จ' : result.error || 'ล้มเหลว'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Schedule Info */}
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber-400" />
              กำหนดการ Cleanup อัตโนมัติ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-800/50">
                <Clock className="h-5 w-5 text-blue-400 mt-0.5" />
                <div>
                  <p className="font-medium">Daily Cleanup</p>
                  <p className="text-sm text-slate-400">ทุกวัน เวลา 03:00 น. (เวลาไทย)</p>
                  <p className="text-xs text-slate-500 mt-1">
                    ลบ Audit Logs เก่ากว่า 90 วัน และ Slip Images เก่ากว่า 90 วัน
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-800/50">
                <Archive className="h-5 w-5 text-amber-400 mt-0.5" />
                <div>
                  <p className="font-medium">Monthly Archive</p>
                  <p className="text-sm text-slate-400">ทุกวันที่ 1 ของเดือน</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Archive Lottery Bets เก่ากว่า 180 วัน ไปตาราง Archive
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-amber-400 mt-0.5" />
              <div>
                <p className="font-medium text-amber-300">หมายเหตุด้านความปลอดภัย</p>
                <p className="text-sm text-slate-400 mt-1">
                  ข้อมูลที่ถูกลบจะไม่สามารถกู้คืนได้ ข้อมูลที่ถูก Archive จะถูกเก็บในตารางแยก
                  และยังสามารถเรียกดูได้ผ่านรายงานประวัติ หน้านี้เข้าถึงได้เฉพาะ Super Admin เท่านั้น
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </RouteGuard>
  );
}
