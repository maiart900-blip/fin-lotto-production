/**
 * Data Retention System
 * ระบบจัดการการเก็บข้อมูลย้อนหลัง
 * 
 * Features:
 * - กำหนด retention policy สำหรับแต่ละประเภทข้อมูล
 * - Auto-archive ข้อมูลเก่า
 * - Auto-delete ข้อมูลหมดอายุ (ตาม policy)
 * - สรุปสถิติการเก็บข้อมูล
 * - Export ข้อมูลก่อนลบ
 */

import { createClient } from '@supabase/supabase-js';
import { logAudit } from './audit-logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Default retention policies (in days)
export const DEFAULT_RETENTION_POLICIES = {
  // Transaction logs - เก็บนาน
  transactions: 365 * 7,          // 7 ปี
  deposits: 365 * 7,              // 7 ปี
  withdrawals: 365 * 7,           // 7 ปี
  
  // Betting records - เก็บนาน
  bets: 365 * 5,                  // 5 ปี
  bet_entries: 365 * 5,           // 5 ปี
  lottery_results: 365 * 10,      // 10 ปี (ผลหวยเก็บนานที่สุด)
  
  // Financial records - เก็บนาน
  daily_closings: 365 * 7,        // 7 ปี
  commission_records: 365 * 7,    // 7 ปี
  agent_settlements: 365 * 7,     // 7 ปี
  
  // Audit logs - เก็บนานมาก
  audit_logs: 365 * 10,           // 10 ปี
  activity_logs: 365 * 3,         // 3 ปี
  
  // System logs - เก็บสั้นกว่า
  error_logs: 365,                // 1 ปี
  api_logs: 90,                   // 90 วัน
  session_logs: 180,              // 180 วัน
  
  // Customer data
  customer_profiles: 365 * 7,     // 7 ปี (หลังปิดบัญชี)
  kyc_documents: 365 * 7,         // 7 ปี
  
  // Media/Files
  slip_images: 365 * 3,           // 3 ปี
  profile_images: 365 * 2,        // 2 ปี
  
  // Temporary
  otp_codes: 1,                   // 1 วัน
  temp_files: 7,                  // 7 วัน
  cache_data: 30,                 // 30 วัน
} as const;

export type DataType = keyof typeof DEFAULT_RETENTION_POLICIES;

export interface RetentionPolicy {
  id: string;
  dataType: DataType;
  tableName: string;
  retentionDays: number;
  archiveBeforeDelete: boolean;
  archiveLocation: string | null;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  deletedCount: number;
  archivedCount: number;
}

export interface RetentionStats {
  dataType: DataType;
  totalRecords: number;
  oldestRecord: string | null;
  newestRecord: string | null;
  recordsToArchive: number;
  recordsToDelete: number;
  estimatedSize: string;
}

/**
 * ดึง retention policies ทั้งหมด
 */
export async function getRetentionPolicies(): Promise<RetentionPolicy[]> {
  const { data, error } = await supabase
    .from('data_retention_policies')
    .select('*')
    .order('data_type');
  
  if (error) throw error;
  return data || [];
}

/**
 * อัปเดต retention policy
 */
export async function updateRetentionPolicy(
  dataType: DataType,
  retentionDays: number,
  archiveBeforeDelete: boolean,
  adminId: string
): Promise<void> {
  const { error } = await supabase
    .from('data_retention_policies')
    .upsert({
      data_type: dataType,
      retention_days: retentionDays,
      archive_before_delete: archiveBeforeDelete,
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    }, {
      onConflict: 'data_type',
    });
  
  if (error) throw error;
  
  await logAudit({
    userId: adminId,
    action: 'update_retention_policy',
    resourceType: 'retention_policy',
    resourceId: dataType,
    details: { retentionDays, archiveBeforeDelete },
    severity: 'high',
  });
}

/**
 * ดึงสถิติข้อมูลสำหรับแต่ละประเภท
 */
export async function getRetentionStats(dataType: DataType): Promise<RetentionStats> {
  const tableMapping: Record<DataType, string> = {
    transactions: 'transactions',
    deposits: 'deposits',
    withdrawals: 'withdrawals',
    bets: 'bets',
    bet_entries: 'bet_entries',
    lottery_results: 'lottery_results',
    daily_closings: 'daily_closings',
    commission_records: 'commission_records',
    agent_settlements: 'agent_settlements',
    audit_logs: 'audit_logs',
    activity_logs: 'activity_logs',
    error_logs: 'error_logs',
    api_logs: 'api_logs',
    session_logs: 'session_logs',
    customer_profiles: 'customers',
    kyc_documents: 'kyc_documents',
    slip_images: 'slip_images',
    profile_images: 'profile_images',
    otp_codes: 'otp_codes',
    temp_files: 'temp_files',
    cache_data: 'cache_data',
  };
  
  const tableName = tableMapping[dataType];
  const retentionDays = DEFAULT_RETENTION_POLICIES[dataType];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  try {
    // Total count
    const { count: totalRecords } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    // Oldest record
    const { data: oldest } = await supabase
      .from(tableName)
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    
    // Newest record
    const { data: newest } = await supabase
      .from(tableName)
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    // Records to archive/delete
    const { count: toDelete } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .lt('created_at', cutoffDate.toISOString());
    
    return {
      dataType,
      totalRecords: totalRecords || 0,
      oldestRecord: oldest?.created_at || null,
      newestRecord: newest?.created_at || null,
      recordsToArchive: toDelete || 0,
      recordsToDelete: toDelete || 0,
      estimatedSize: formatBytes((totalRecords || 0) * 500), // rough estimate
    };
  } catch (error) {
    console.error(`Error getting stats for ${dataType}:`, error);
    return {
      dataType,
      totalRecords: 0,
      oldestRecord: null,
      newestRecord: null,
      recordsToArchive: 0,
      recordsToDelete: 0,
      estimatedSize: '0 B',
    };
  }
}

/**
 * Archive ข้อมูลเก่า (ย้ายไป archive table)
 */
export async function archiveOldData(
  dataType: DataType,
  adminId: string,
  dryRun: boolean = false
): Promise<{ archivedCount: number; message: string }> {
  const retentionDays = DEFAULT_RETENTION_POLICIES[dataType];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  const tableMapping: Record<string, string> = {
    transactions: 'transactions',
    deposits: 'deposits',
    withdrawals: 'withdrawals',
    bets: 'bets',
    audit_logs: 'audit_logs',
  };
  
  const tableName = tableMapping[dataType];
  if (!tableName) {
    return { archivedCount: 0, message: 'ไม่รองรับการ archive สำหรับประเภทนี้' };
  }
  
  // Get records to archive
  const { data: toArchive, error: fetchError } = await supabase
    .from(tableName)
    .select('*')
    .lt('created_at', cutoffDate.toISOString())
    .limit(10000); // Process in batches
  
  if (fetchError) throw fetchError;
  
  if (!toArchive || toArchive.length === 0) {
    return { archivedCount: 0, message: 'ไม่มีข้อมูลที่ต้อง archive' };
  }
  
  if (dryRun) {
    return { 
      archivedCount: toArchive.length, 
      message: `[Dry Run] จะ archive ${toArchive.length} รายการ` 
    };
  }
  
  // Insert to archive table
  const archiveTableName = `${tableName}_archive`;
  const { error: insertError } = await supabase
    .from(archiveTableName)
    .insert(toArchive.map(record => ({
      ...record,
      archived_at: new Date().toISOString(),
      archived_by: adminId,
    })));
  
  if (insertError) {
    console.error('Archive insert error:', insertError);
    // Continue anyway, data might already exist
  }
  
  // Delete from main table
  const ids = toArchive.map(r => r.id);
  const { error: deleteError } = await supabase
    .from(tableName)
    .delete()
    .in('id', ids);
  
  if (deleteError) throw deleteError;
  
  // Log the operation
  await logAudit({
    userId: adminId,
    action: 'archive_data',
    resourceType: 'retention',
    resourceId: dataType,
    details: { 
      count: toArchive.length, 
      cutoffDate: cutoffDate.toISOString(),
    },
    severity: 'high',
  });
  
  // Update policy last run
  await supabase
    .from('data_retention_policies')
    .update({
      last_run_at: new Date().toISOString(),
      archived_count: supabase.rpc('increment', { row_id: dataType, amount: toArchive.length }),
    })
    .eq('data_type', dataType);
  
  return {
    archivedCount: toArchive.length,
    message: `Archive ${toArchive.length} รายการเรียบร้อย`,
  };
}

/**
 * ลบข้อมูลที่หมดอายุ (หลัง archive แล้ว)
 */
export async function deleteExpiredData(
  dataType: DataType,
  adminId: string,
  dryRun: boolean = false
): Promise<{ deletedCount: number; message: string }> {
  // Only allow deletion for specific types
  const allowedTypes: DataType[] = [
    'otp_codes',
    'temp_files',
    'cache_data',
    'api_logs',
    'session_logs',
  ];
  
  if (!allowedTypes.includes(dataType)) {
    return { 
      deletedCount: 0, 
      message: 'ประเภทนี้ต้องผ่านการ archive ก่อนลบ' 
    };
  }
  
  const retentionDays = DEFAULT_RETENTION_POLICIES[dataType];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  const tableMapping: Record<string, string> = {
    otp_codes: 'otp_codes',
    temp_files: 'temp_files',
    cache_data: 'cache_data',
    api_logs: 'api_logs',
    session_logs: 'session_logs',
  };
  
  const tableName = tableMapping[dataType];
  
  // Count records to delete
  const { count } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true })
    .lt('created_at', cutoffDate.toISOString());
  
  if (!count || count === 0) {
    return { deletedCount: 0, message: 'ไม่มีข้อมูลที่ต้องลบ' };
  }
  
  if (dryRun) {
    return { 
      deletedCount: count, 
      message: `[Dry Run] จะลบ ${count} รายการ` 
    };
  }
  
  // Delete expired records
  const { error } = await supabase
    .from(tableName)
    .delete()
    .lt('created_at', cutoffDate.toISOString());
  
  if (error) throw error;
  
  await logAudit({
    userId: adminId,
    action: 'delete_expired_data',
    resourceType: 'retention',
    resourceId: dataType,
    details: { 
      count, 
      cutoffDate: cutoffDate.toISOString(),
    },
    severity: 'high',
  });
  
  return {
    deletedCount: count,
    message: `ลบ ${count} รายการเรียบร้อย`,
  };
}

/**
 * รัน retention cleanup ทั้งหมด (สำหรับ cron job)
 */
export async function runRetentionCleanup(
  adminId: string
): Promise<{ results: { dataType: DataType; archived: number; deleted: number }[] }> {
  const results: { dataType: DataType; archived: number; deleted: number }[] = [];
  
  // Archive important data first
  const archiveTypes: DataType[] = [
    'transactions',
    'deposits',
    'withdrawals',
    'bets',
    'audit_logs',
  ];
  
  for (const dataType of archiveTypes) {
    try {
      const archiveResult = await archiveOldData(dataType, adminId);
      results.push({
        dataType,
        archived: archiveResult.archivedCount,
        deleted: 0,
      });
    } catch (error) {
      console.error(`Archive error for ${dataType}:`, error);
    }
  }
  
  // Delete temporary data
  const deleteTypes: DataType[] = [
    'otp_codes',
    'temp_files',
    'cache_data',
  ];
  
  for (const dataType of deleteTypes) {
    try {
      const deleteResult = await deleteExpiredData(dataType, adminId);
      results.push({
        dataType,
        archived: 0,
        deleted: deleteResult.deletedCount,
      });
    } catch (error) {
      console.error(`Delete error for ${dataType}:`, error);
    }
  }
  
  return { results };
}

/**
 * ดึงประวัติ retention operations
 */
export async function getRetentionHistory(
  limit: number = 50
): Promise<any[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .in('action', ['archive_data', 'delete_expired_data', 'update_retention_policy'])
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

// Helper function
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
