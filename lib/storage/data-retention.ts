/**
 * DATA RETENTION SERVICE
 * ======================
 * Manages data lifecycle, archiving, and cleanup
 * 
 * Policies:
 * - Audit Logs: Delete after 90 days
 * - Lottery Bets (completed): Archive after 180 days
 * - Slip Images: Cleanup after 90 days
 */

import { createClient } from '@supabase/supabase-js';
import { imageOptimizer } from './image-optimizer';

// Service client for background operations
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing Supabase credentials');
  }
  
  return createClient(supabaseUrl, serviceKey);
}

// =====================================================
// TYPES
// =====================================================

export interface RetentionPolicy {
  table: string;
  retentionDays: number;
  action: 'delete' | 'archive';
  archiveTable?: string;
  conditions?: string; // Additional SQL conditions
}

export interface RetentionResult {
  table: string;
  action: 'delete' | 'archive';
  recordsProcessed: number;
  success: boolean;
  error?: string;
  duration: number;
}

export interface DataStats {
  table: string;
  totalRecords: number;
  oldRecords: number; // Records older than retention period
  estimatedSizeBytes?: number;
}

// =====================================================
// DEFAULT POLICIES
// =====================================================

export const DEFAULT_POLICIES: RetentionPolicy[] = [
  {
    table: 'audit_logs',
    retentionDays: 90,
    action: 'delete',
  },
  {
    table: 'lottery_bets',
    retentionDays: 180,
    action: 'archive',
    archiveTable: 'lottery_bets_archive',
    conditions: "status IN ('won', 'lost', 'cancelled')", // Only completed bets
  },
  {
    table: 'credit_transactions',
    retentionDays: 365, // Keep for 1 year, then archive
    action: 'archive',
    archiveTable: 'credit_transactions_archive',
  },
];

// =====================================================
// AUDIT LOGS CLEANUP
// =====================================================

/**
 * Delete audit logs older than specified days
 */
export async function purgeAuditLogs(olderThanDays: number = 90): Promise<RetentionResult> {
  const startTime = Date.now();
  const supabase = getServiceClient();
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffISO = cutoffDate.toISOString();
    
    // First, count records to be deleted
    const { count: recordCount } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', cutoffISO);
    
    if (!recordCount || recordCount === 0) {
      return {
        table: 'audit_logs',
        action: 'delete',
        recordsProcessed: 0,
        success: true,
        duration: Date.now() - startTime,
      };
    }
    
    // Delete in batches to avoid timeout
    const batchSize = 1000;
    let totalDeleted = 0;
    
    while (totalDeleted < recordCount) {
      const { error } = await supabase
        .from('audit_logs')
        .delete()
        .lt('created_at', cutoffISO)
        .limit(batchSize);
      
      if (error) throw error;
      
      totalDeleted += batchSize;
      
      // Prevent infinite loop
      if (totalDeleted >= recordCount) break;
    }
    
    return {
      table: 'audit_logs',
      action: 'delete',
      recordsProcessed: recordCount,
      success: true,
      duration: Date.now() - startTime,
    };
  } catch (err) {
    return {
      table: 'audit_logs',
      action: 'delete',
      recordsProcessed: 0,
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

// =====================================================
// LOTTERY BETS ARCHIVING
// =====================================================

/**
 * Archive completed lottery bets older than specified days
 */
export async function archiveLotteryBets(olderThanDays: number = 180): Promise<RetentionResult> {
  const startTime = Date.now();
  const supabase = getServiceClient();
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffISO = cutoffDate.toISOString();
    
    // First, ensure archive table exists (create if not)
    // Note: In production, create this table via migration
    
    // Count records to be archived
    const { count: recordCount, error: countError } = await supabase
      .from('lottery_bets')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', cutoffISO)
      .in('status', ['won', 'lost', 'cancelled']);
    
    if (countError) {
      // Table might not exist, which is fine
      return {
        table: 'lottery_bets',
        action: 'archive',
        recordsProcessed: 0,
        success: true,
        duration: Date.now() - startTime,
      };
    }
    
    if (!recordCount || recordCount === 0) {
      return {
        table: 'lottery_bets',
        action: 'archive',
        recordsProcessed: 0,
        success: true,
        duration: Date.now() - startTime,
      };
    }
    
    // Archive in batches
    const batchSize = 500;
    let totalArchived = 0;
    
    while (totalArchived < recordCount) {
      // Select batch of records to archive
      const { data: records, error: selectError } = await supabase
        .from('lottery_bets')
        .select('*')
        .lt('created_at', cutoffISO)
        .in('status', ['won', 'lost', 'cancelled'])
        .limit(batchSize);
      
      if (selectError || !records || records.length === 0) break;
      
      // Insert into archive table
      const { error: insertError } = await supabase
        .from('lottery_bets_archive')
        .insert(records.map(r => ({
          ...r,
          archived_at: new Date().toISOString(),
        })));
      
      // If archive table doesn't exist, skip archiving
      if (insertError) {
        console.log('Archive table may not exist, skipping archive step');
        break;
      }
      
      // Delete from main table
      const recordIds = records.map(r => r.id);
      const { error: deleteError } = await supabase
        .from('lottery_bets')
        .delete()
        .in('id', recordIds);
      
      if (deleteError) throw deleteError;
      
      totalArchived += records.length;
    }
    
    return {
      table: 'lottery_bets',
      action: 'archive',
      recordsProcessed: totalArchived,
      success: true,
      duration: Date.now() - startTime,
    };
  } catch (err) {
    return {
      table: 'lottery_bets',
      action: 'archive',
      recordsProcessed: 0,
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

// =====================================================
// DATA STATISTICS
// =====================================================

/**
 * Get statistics about data that can be cleaned up
 */
export async function getRetentionStats(): Promise<{
  auditLogs: DataStats;
  lotteryBets: DataStats;
  slipStorage: { totalFiles: number; totalSizeBytes: number; oldFiles: number };
}> {
  const supabase = getServiceClient();
  
  // Audit logs stats
  const auditCutoff = new Date();
  auditCutoff.setDate(auditCutoff.getDate() - 90);
  
  const { count: auditTotal } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true });
  
  const { count: auditOld } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .lt('created_at', auditCutoff.toISOString());
  
  // Lottery bets stats
  const betsCutoff = new Date();
  betsCutoff.setDate(betsCutoff.getDate() - 180);
  
  const { count: betsTotal } = await supabase
    .from('lottery_bets')
    .select('*', { count: 'exact', head: true })
    .catch(() => ({ count: 0 }));
  
  const { count: betsOld } = await supabase
    .from('lottery_bets')
    .select('*', { count: 'exact', head: true })
    .lt('created_at', betsCutoff.toISOString())
    .in('status', ['won', 'lost', 'cancelled'])
    .catch(() => ({ count: 0 }));
  
  // Storage stats
  const storageStats = await imageOptimizer.getStats();
  
  return {
    auditLogs: {
      table: 'audit_logs',
      totalRecords: auditTotal || 0,
      oldRecords: auditOld || 0,
    },
    lotteryBets: {
      table: 'lottery_bets',
      totalRecords: betsTotal || 0,
      oldRecords: betsOld || 0,
    },
    slipStorage: {
      totalFiles: storageStats.totalFiles,
      totalSizeBytes: storageStats.totalSizeBytes,
      oldFiles: 0, // Would need to iterate to count
    },
  };
}

// =====================================================
// FULL CLEANUP
// =====================================================

/**
 * Run all retention policies
 */
export async function runFullCleanup(): Promise<{
  results: RetentionResult[];
  totalRecordsProcessed: number;
  totalDuration: number;
}> {
  const startTime = Date.now();
  const results: RetentionResult[] = [];
  
  // 1. Purge audit logs (90 days)
  results.push(await purgeAuditLogs(90));
  
  // 2. Archive lottery bets (180 days)
  results.push(await archiveLotteryBets(180));
  
  // 3. Cleanup old slip images (90 days)
  const slipCleanup = await imageOptimizer.cleanupOld(90);
  results.push({
    table: 'blob_storage (slips)',
    action: 'delete',
    recordsProcessed: slipCleanup.deleted,
    success: slipCleanup.errors === 0,
    error: slipCleanup.errors > 0 ? `${slipCleanup.errors} errors during cleanup` : undefined,
    duration: 0,
  });
  
  return {
    results,
    totalRecordsProcessed: results.reduce((sum, r) => sum + r.recordsProcessed, 0),
    totalDuration: Date.now() - startTime,
  };
}

export const dataRetention = {
  purgeAuditLogs,
  archiveLotteryBets,
  getStats: getRetentionStats,
  runFullCleanup,
  DEFAULT_POLICIES,
};
