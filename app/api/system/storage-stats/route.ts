/**
 * STORAGE STATS API
 * =================
 * Get statistics about data storage and retention
 */

import { NextRequest, NextResponse } from 'next/server';
import { dataRetention } from '@/lib/storage/data-retention';
import { imageOptimizer } from '@/lib/storage/image-optimizer';

export async function GET(request: NextRequest) {
  try {
    // Get retention stats
    const retentionStats = await dataRetention.getStats();
    
    // Get storage stats
    const storageStats = await imageOptimizer.getStats();
    
    // Format sizes
    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      retention: {
        auditLogs: {
          ...retentionStats.auditLogs,
          retentionPolicy: '90 days',
          cleanupAction: 'delete',
        },
        lotteryBets: {
          ...retentionStats.lotteryBets,
          retentionPolicy: '180 days',
          cleanupAction: 'archive',
        },
      },
      storage: {
        slips: {
          totalFiles: storageStats.totalFiles,
          totalSize: formatBytes(storageStats.totalSizeBytes),
          totalSizeBytes: storageStats.totalSizeBytes,
          retentionPolicy: '90 days',
          cleanupAction: 'delete',
        },
        byCategory: Object.entries(storageStats.byCategory).map(([category, data]) => ({
          category,
          count: data.count,
          size: formatBytes(data.sizeBytes),
          sizeBytes: data.sizeBytes,
        })),
      },
      policies: dataRetention.DEFAULT_POLICIES,
    });
  } catch (error) {
    console.error('[Storage Stats] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
