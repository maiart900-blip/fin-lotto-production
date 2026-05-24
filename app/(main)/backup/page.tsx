'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, Download, Upload, RefreshCw, Calendar, HardDrive, CheckCircle, AlertCircle } from 'lucide-react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function BackupPage() {
  const { canAccess } = useAuth();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const { data: backupData, mutate } = useSWR('/api/backup', fetcher);

  if (!canAccess('admin')) {
    return (
      <div className="p-6">
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-red-500">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-slate-500 mt-2">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'manual' }),
      });
      
      if (res.ok) {
        toast.success('สำรองข้อมูลสำเร็จ');
        mutate();
      } else {
        const data = await res.json();
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (backupId: string) => {
    if (!confirm('ยืนยันการกู้คืนข้อมูล? การดำเนินการนี้จะแทนที่ข้อมูลปัจจุบัน')) return;
    
    setIsRestoring(true);
    try {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup_id: backupId }),
      });
      
      if (res.ok) {
        toast.success('กู้คืนข้อมูลสำเร็จ');
        mutate();
      } else {
        const data = await res.json();
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsRestoring(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">สำรองข้อมูล</h1>
          <p className="text-slate-500">จัดการการสำรองและกู้คืนข้อมูลระบบ</p>
        </div>
        <Button 
          onClick={handleBackup} 
          disabled={isBackingUp}
          className="bg-green-600 hover:bg-green-700"
        >
          {isBackingUp ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              กำลังสำรอง...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              สำรองข้อมูลตอนนี้
            </>
          )}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <Database className="h-10 w-10 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{backupData?.totalBackups || 0}</p>
              <p className="text-sm text-slate-500">ไฟล์สำรองทั้งหมด</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <HardDrive className="h-10 w-10 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{formatFileSize(backupData?.totalSize || 0)}</p>
              <p className="text-sm text-slate-500">พื้นที่ใช้งาน</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <Calendar className="h-10 w-10 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">
                {backupData?.lastBackup 
                  ? new Date(backupData.lastBackup).toLocaleDateString('th-TH')
                  : 'ไม่มี'
                }
              </p>
              <p className="text-sm text-slate-500">สำรองล่าสุด</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backup History */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>ประวัติการสำรองข้อมูล</CardTitle>
        </CardHeader>
        <CardContent>
          {backupData?.backups?.length > 0 ? (
            <div className="space-y-3">
              {backupData.backups.map((backup: { id: string; file_name: string; backup_type: string; file_size: number; created_at: string; tables_included: string[] }) => (
                <div key={backup.id} className="bg-slate-100 rounded-lg p-4 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <Database className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="font-semibold">{backup.file_name}</p>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span>{new Date(backup.created_at).toLocaleString('th-TH')}</span>
                        <Badge variant="outline" className="text-xs">
                          {backup.backup_type === 'manual' ? 'Manual' : 'Auto'}
                        </Badge>
                        <span>{formatFileSize(backup.file_size || 0)}</span>
                      </div>
                      {backup.tables_included && (
                        <p className="text-xs text-neutral-500 mt-1">
                          ตาราง: {backup.tables_included.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleRestore(backup.id)}
                      disabled={isRestoring}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      กู้คืน
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Database className="h-12 w-12 mx-auto text-neutral-600 mb-3" />
              <p className="text-neutral-500">ยังไม่มีไฟล์สำรองข้อมูล</p>
              <p className="text-sm text-neutral-600 mt-1">คลิกปุ่มด้านบนเพื่อสำรองข้อมูลครั้งแรก</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="bg-blue-500/10 border-blue-500/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-400">ข้อมูลที่ถูกสำรอง</p>
              <ul className="text-sm text-slate-500 mt-2 space-y-1">
                <li>• ข้อมูลลูกค้าและผู้ใช้</li>
                <li>• โพยหวยและผลรางวัล</li>
                <li>• ธุรกรรมการเงินทั้งหมด</li>
                <li>• การตั้งค่าระบบ</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
