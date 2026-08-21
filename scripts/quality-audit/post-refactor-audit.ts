/**
 * Post-Refactor Production Quality Audit
 * Comprehensive analysis of FIN Platform codebase quality
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface AuditResult {
  category: string;
  metric: string;
  value: number | string;
  target: number | string;
  status: 'pass' | 'warn' | 'fail' | 'info';
  details?: string;
}

const results: AuditResult[] = [];

function addResult(result: AuditResult) {
  results.push(result);
}

// ========== CODEBASE METRICS ==========
async function auditCodebaseMetrics() {
  console.log('\n📊 CODEBASE METRICS');
  console.log('═'.repeat(60));

  // Count files by type
  const countFiles = (dir: string, ext: string): number => {
    let count = 0;
    const walk = (d: string) => {
      if (!fs.existsSync(d)) return;
      const files = fs.readdirSync(d);
      for (const file of files) {
        const fullPath = path.join(d, file);
        if (file === 'node_modules' || file === '.next') continue;
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) walk(fullPath);
        else if (file.endsWith(ext)) count++;
      }
    };
    walk(dir);
    return count;
  };

  const tsFiles = countFiles('.', '.ts');
  const tsxFiles = countFiles('.', '.tsx');
  const totalFiles = tsFiles + tsxFiles;

  console.log(`  TypeScript files: ${tsFiles}`);
  console.log(`  TSX files: ${tsxFiles}`);
  console.log(`  Total: ${totalFiles}`);

  addResult({
    category: 'Codebase',
    metric: 'Total Source Files',
    value: totalFiles,
    target: 'N/A',
    status: 'info',
  });

  // Count lines of code
  const countLines = (dir: string): number => {
    let lines = 0;
    const walk = (d: string) => {
      if (!fs.existsSync(d)) return;
      const files = fs.readdirSync(d);
      for (const file of files) {
        const fullPath = path.join(d, file);
        if (file === 'node_modules' || file === '.next') continue;
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) walk(fullPath);
        else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          lines += content.split('\n').length;
        }
      }
    };
    walk(dir);
    return lines;
  };

  const totalLines = countLines('.');
  console.log(`  Total Lines of Code: ${totalLines.toLocaleString()}`);

  addResult({
    category: 'Codebase',
    metric: 'Lines of Code',
    value: totalLines.toLocaleString(),
    target: 'N/A',
    status: 'info',
  });
}

// ========== ERROR BOUNDARY COVERAGE ==========
async function auditErrorBoundaries() {
  console.log('\n🛡️ ERROR BOUNDARY COVERAGE');
  console.log('═'.repeat(60));

  const errorFiles: string[] = [];
  const routeGroups: string[] = [];

  const findErrorFiles = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (file === 'node_modules' || file === '.next') continue;
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (file.startsWith('(') && file.endsWith(')')) {
          routeGroups.push(fullPath);
        }
        findErrorFiles(fullPath);
      } else if (file === 'error.tsx') {
        errorFiles.push(fullPath);
      }
    }
  };

  findErrorFiles('./app');

  console.log(`  Route Groups Found: ${routeGroups.length}`);
  console.log(`  Error Boundaries: ${errorFiles.length}`);
  
  for (const ef of errorFiles) {
    console.log(`    ✓ ${ef}`);
  }

  // Check which route groups are missing error boundaries
  const missingErrorBoundaries: string[] = [];
  for (const rg of routeGroups) {
    const hasError = errorFiles.some(ef => ef.startsWith(rg));
    if (!hasError) {
      missingErrorBoundaries.push(rg);
    }
  }

  if (missingErrorBoundaries.length > 0) {
    console.log(`  Missing Error Boundaries:`);
    for (const m of missingErrorBoundaries) {
      console.log(`    ✗ ${m}`);
    }
  }

  const coverage = routeGroups.length > 0 
    ? Math.round((routeGroups.length - missingErrorBoundaries.length) / routeGroups.length * 100)
    : 100;

  addResult({
    category: 'Error Handling',
    metric: 'Error Boundary Coverage',
    value: `${coverage}%`,
    target: '100%',
    status: coverage === 100 ? 'pass' : coverage >= 75 ? 'warn' : 'fail',
    details: `${errorFiles.length} error boundaries for ${routeGroups.length} route groups`,
  });
}

// ========== API CONSISTENCY ==========
async function auditApiConsistency() {
  console.log('\n🔌 API RESPONSE CONSISTENCY');
  console.log('═'.repeat(60));

  let consistentApis = 0;
  let inconsistentApis = 0;
  const apiFiles: string[] = [];

  const findApiFiles = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (file === 'node_modules' || file === '.next') continue;
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        findApiFiles(fullPath);
      } else if (file === 'route.ts') {
        apiFiles.push(fullPath);
      }
    }
  };

  findApiFiles('./app/api');

  for (const apiFile of apiFiles) {
    const content = fs.readFileSync(apiFile, 'utf-8');
    // Check if using standard response format
    if (content.includes('success:') || content.includes('apiSuccess') || content.includes('apiError')) {
      consistentApis++;
    } else if (content.includes('NextResponse.json')) {
      inconsistentApis++;
    }
  }

  const total = consistentApis + inconsistentApis;
  const consistency = total > 0 ? Math.round(consistentApis / total * 100) : 100;

  console.log(`  Total API Routes: ${apiFiles.length}`);
  console.log(`  Using Standard Format: ${consistentApis}`);
  console.log(`  Need Migration: ${inconsistentApis}`);
  console.log(`  Consistency: ${consistency}%`);

  addResult({
    category: 'API',
    metric: 'Response Format Consistency',
    value: `${consistency}%`,
    target: '100%',
    status: consistency >= 90 ? 'pass' : consistency >= 70 ? 'warn' : 'fail',
    details: `${consistentApis}/${total} APIs use standard format`,
  });
}

// ========== LOGGING AUDIT ==========
async function auditLogging() {
  console.log('\n📝 LOGGING PRACTICES');
  console.log('═'.repeat(60));

  let consoleLogCount = 0;
  let structuredLogCount = 0;

  const countLogs = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (file === 'node_modules' || file === '.next' || file === 'scripts') continue;
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        countLogs(fullPath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        consoleLogCount += (content.match(/console\.(log|debug|info|warn)\(/g) || []).length;
        structuredLogCount += (content.match(/logger\.(debug|info|warn|error|fatal)\(/g) || []).length;
      }
    }
  };

  countLogs('./app');
  countLogs('./lib');

  console.log(`  console.log statements: ${consoleLogCount}`);
  console.log(`  Structured logger calls: ${structuredLogCount}`);

  const total = consoleLogCount + structuredLogCount;
  const structuredPct = total > 0 ? Math.round(structuredLogCount / total * 100) : 0;

  addResult({
    category: 'Logging',
    metric: 'Console.log in Production Code',
    value: consoleLogCount,
    target: '0',
    status: consoleLogCount === 0 ? 'pass' : consoleLogCount < 50 ? 'warn' : 'fail',
    details: `${consoleLogCount} console.log statements in app/lib`,
  });

  addResult({
    category: 'Logging',
    metric: 'Structured Logger Adoption',
    value: `${structuredPct}%`,
    target: '100%',
    status: structuredPct >= 80 ? 'pass' : structuredPct >= 50 ? 'warn' : 'fail',
  });
}

// ========== DATABASE AUDIT ==========
async function auditDatabase() {
  console.log('\n🗄️ DATABASE INTEGRITY');
  console.log('═'.repeat(60));

  // Check table count
  const { data: tables } = await supabase.rpc('exec_sql', {
    sql: `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'`
  }).single();

 const tableCount = typeof tables === 'number' ? tables : 0;
  console.log(`  Total Tables: ${tableCount}`);

  // Check for orphan records
  const { data: orphanCustomers } = await supabase
    .from('customers')
    .select('id', { count: 'exact' })
    .is('tenant_id', null);

  const orphanCount = orphanCustomers?.length || 0;
  console.log(`  Orphan Customers: ${orphanCount}`);

  addResult({
    category: 'Database',
    metric: 'Orphan Records',
    value: orphanCount,
    target: '0',
    status: orphanCount === 0 ? 'pass' : 'fail',
    details: `${orphanCount} customers without tenant_id`,
  });

  // Check revenue share configs
  const { data: revenueConfigs } = await supabase
    .from('revenue_share_configs')
    .select('*');

  let invalidConfigs = 0;
  revenueConfigs?.forEach(config => {
    const total = (config.tenant_share_percent || 0) + 
      (config.platform_share_percent || 0) + 
      (config.provider_share_percent || 0);
    if (Math.abs(total - 100) > 0.01) invalidConfigs++;
  });

  console.log(`  Revenue Configs: ${revenueConfigs?.length || 0}`);
  console.log(`  Invalid Configs: ${invalidConfigs}`);

  addResult({
    category: 'Database',
    metric: 'Revenue Share Integrity',
    value: invalidConfigs === 0 ? 'Valid' : `${invalidConfigs} invalid`,
    target: 'Valid',
    status: invalidConfigs === 0 ? 'pass' : 'fail',
  });
}

// ========== SECURITY AUDIT ==========
async function auditSecurity() {
  console.log('\n🔒 SECURITY POSTURE');
  console.log('═'.repeat(60));

  // Check for security tables
  const securityTables = [
    'roles', 'permissions', 'user_roles', 'user_2fa', 
    'login_attempts', 'active_sessions', 'security_policies',
    'security_incidents', 'api_keys'
  ];

  let existingTables = 0;
  for (const table of securityTables) {
    const { data } = await supabase.from(table).select('id').limit(1);
    if (data !== null) existingTables++;
  }

  console.log(`  Security Tables: ${existingTables}/${securityTables.length}`);

  addResult({
    category: 'Security',
    metric: 'Security Infrastructure',
    value: `${existingTables}/${securityTables.length}`,
    target: `${securityTables.length}/${securityTables.length}`,
    status: existingTables === securityTables.length ? 'pass' : 'warn',
  });

  // Check security policies
  const { data: policies } = await supabase
    .from('security_policies')
    .select('*');

  console.log(`  Security Policies: ${policies?.length || 0}`);

  addResult({
    category: 'Security',
    metric: 'Security Policies Configured',
    value: policies?.length || 0,
    target: '6',
    status: (policies?.length || 0) >= 6 ? 'pass' : 'warn',
  });

  // Check for default permissions
  const { data: perms } = await supabase
    .from('permissions')
    .select('*');

  console.log(`  Permissions Defined: ${perms?.length || 0}`);

  addResult({
    category: 'Security',
    metric: 'RBAC Permissions',
    value: perms?.length || 0,
    target: '29',
    status: (perms?.length || 0) >= 29 ? 'pass' : 'warn',
  });
}

// ========== CORE LIBRARY ADOPTION ==========
async function auditCoreLibrary() {
  console.log('\n📚 CORE LIBRARY ADOPTION');
  console.log('═'.repeat(60));

  // Check if core library files exist
  const coreFiles = [
    'lib/core/logger.ts',
    'lib/core/result.ts',
    'lib/core/validation.ts',
    'lib/core/services.ts',
    'lib/core/api-response.ts',
    'lib/core/hooks.ts',
    'lib/core/index.ts',
  ];

  let existingCoreFiles = 0;
  for (const file of coreFiles) {
    if (fs.existsSync(file)) existingCoreFiles++;
  }

  console.log(`  Core Library Files: ${existingCoreFiles}/${coreFiles.length}`);

  addResult({
    category: 'Architecture',
    metric: 'Core Library Setup',
    value: `${existingCoreFiles}/${coreFiles.length}`,
    target: `${coreFiles.length}/${coreFiles.length}`,
    status: existingCoreFiles === coreFiles.length ? 'pass' : 'warn',
  });

  // Check adoption in codebase
  let coreImports = 0;
  const checkImports = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (file === 'node_modules' || file === '.next' || file === 'core') continue;
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        checkImports(fullPath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (content.includes('@/lib/core') || content.includes('from \'../core\'') || content.includes('from \'./core\'')) {
          coreImports++;
        }
      }
    }
  };

  checkImports('./app');
  checkImports('./lib');

  console.log(`  Files Using Core Library: ${coreImports}`);

  addResult({
    category: 'Architecture',
    metric: 'Core Library Adoption',
    value: coreImports,
    target: '>10',
    status: coreImports >= 10 ? 'pass' : coreImports > 0 ? 'warn' : 'info',
    details: 'New library - adoption in progress',
  });
}

// ========== PRINT SUMMARY ==========
function printSummary() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║          POST-REFACTOR PRODUCTION QUALITY AUDIT SUMMARY            ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  const categories = [...new Set(results.map(r => r.category))];
  
  for (const category of categories) {
    console.log(`\n📋 ${category.toUpperCase()}`);
    console.log('─'.repeat(60));
    
    const categoryResults = results.filter(r => r.category === category);
    for (const r of categoryResults) {
      const icon = r.status === 'pass' ? '✓' : r.status === 'warn' ? '⚠' : r.status === 'fail' ? '✗' : '○';
      const color = r.status === 'pass' ? '\x1b[32m' : r.status === 'warn' ? '\x1b[33m' : r.status === 'fail' ? '\x1b[31m' : '\x1b[36m';
      console.log(`  ${color}${icon}\x1b[0m ${r.metric}: ${r.value} (target: ${r.target})`);
      if (r.details) console.log(`      ${r.details}`);
    }
  }

  // Calculate overall score
  const passed = results.filter(r => r.status === 'pass').length;
  const warned = results.filter(r => r.status === 'warn').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const total = passed + warned + failed;

  const score = total > 0 ? Math.round((passed * 100 + warned * 50) / total) : 0;

  console.log('\n');
  console.log('═'.repeat(60));
  console.log('📈 OVERALL QUALITY SCORE');
  console.log('─'.repeat(60));
  console.log(`  Passed: ${passed}`);
  console.log(`  Warnings: ${warned}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Score: ${score}/100`);

  let status = 'Production Ready';
  if (failed > 0) status = 'Needs Attention - Fix Failed Items';
  else if (warned > 3) status = 'Good - Address Warnings';
  else if (score < 80) status = 'Acceptable - Minor Improvements Needed';

  console.log(`  Status: ${status}`);
  console.log('═'.repeat(60));
}

// ========== MAIN ==========
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║       FIN PLATFORM - POST-REFACTOR PRODUCTION QUALITY AUDIT        ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  await auditCodebaseMetrics();
  await auditErrorBoundaries();
  await auditApiConsistency();
  await auditLogging();
  await auditDatabase();
  await auditSecurity();
  await auditCoreLibrary();
  
  printSummary();
}

main().catch(console.error);
