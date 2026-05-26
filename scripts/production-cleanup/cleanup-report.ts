/**
 * FIN Platform - Production Cleanup & Optimization Report
 * Comprehensive scan for development artifacts and production readiness
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CleanupIssue {
  category: 'critical' | 'warning' | 'info';
  type: string;
  file?: string;
  line?: number;
  description: string;
  autoFixable: boolean;
  recommendation: string;
}

interface CleanupReport {
  timestamp: string;
  issues: CleanupIssue[];
  stats: {
    totalFiles: number;
    totalIssues: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    autoFixableCount: number;
  };
  categories: Record<string, number>;
}

const issues: CleanupIssue[] = [];

// Helper to scan files recursively
function scanDirectory(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) return files;
  
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!['node_modules', '.next', '.git', 'dist', 'coverage'].includes(item)) {
        files.push(...scanDirectory(fullPath, extensions));
      }
    } else if (extensions.some(ext => item.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// 1. Check for console.log statements in production code
function checkConsoleLogs(files: string[]) {
  console.log('\n📋 Checking for console.log statements...');
  
  const productionDirs = ['app/', 'components/', 'lib/'];
  const allowedDirs = ['scripts/', 'tests/', '__tests__/'];
  
  let count = 0;
  for (const file of files) {
    // Skip allowed directories
    if (allowedDirs.some(d => file.includes(d))) continue;
    // Only check production directories
    if (!productionDirs.some(d => file.includes(d))) continue;
    
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, idx) => {
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
      
      // Check for console statements
      const match = line.match(/console\.(log|debug|info|warn)\(/);
      if (match) {
        // Allow console.error for real errors
        if (match[1] === 'warn' && line.includes('console.warn')) return;
        
        count++;
        issues.push({
          category: 'warning',
          type: 'console_log',
          file: file.replace(process.cwd() + '/', ''),
          line: idx + 1,
          description: `Console.${match[1]} statement found`,
          autoFixable: true,
          recommendation: 'Remove or replace with proper logging'
        });
      }
    });
  }
  
  console.log(`   Found ${count} console statements in production code`);
}

// 2. Check for TODO/FIXME comments
function checkTodoComments(files: string[]) {
  console.log('\n📋 Checking for TODO/FIXME comments...');
  
  let count = 0;
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, idx) => {
      const match = line.match(/\/\/\s*(TODO|FIXME|HACK|XXX|TEMP)[\s:]/i);
      if (match) {
        count++;
        const priority = ['FIXME', 'HACK', 'XXX'].includes(match[1].toUpperCase()) 
          ? 'warning' : 'info';
        
        issues.push({
          category: priority,
          type: 'todo_comment',
          file: file.replace(process.cwd() + '/', ''),
          line: idx + 1,
          description: `${match[1].toUpperCase()}: ${line.trim().substring(0, 80)}...`,
          autoFixable: false,
          recommendation: 'Review and resolve or document as known limitation'
        });
      }
    });
  }
  
  console.log(`   Found ${count} TODO/FIXME comments`);
}

// 3. Check for hardcoded secrets
function checkHardcodedSecrets(files: string[]) {
  console.log('\n📋 Checking for potential hardcoded secrets...');
  
  const patterns = [
    { regex: /password\s*[:=]\s*['"][^'"]+['"]/gi, type: 'password' },
    { regex: /secret\s*[:=]\s*['"][^'"]+['"]/gi, type: 'secret' },
    { regex: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi, type: 'api_key' },
    { regex: /token\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/gi, type: 'token' },
    { regex: /bearer\s+[A-Za-z0-9_\-\.]{20,}/gi, type: 'bearer_token' },
  ];
  
  // Whitelist patterns (mock data, examples, env references)
  const whitelist = [
    /process\.env\./,
    /['"]password['"]\s*:/,  // Object key named password
    /password.*input/i,
    /type.*password/i,
    /name.*password/i,
    /placeholder/i,
    /example/i,
    /mock/i,
    /test/i,
    /demo/i,
    /\*{4,}/,  // Masked values like ****
    /formData\.password/i,  // Form validation
    /errors\.password/i,    // Error messages
    /newErrors\.password/i, // Validation errors
    /MOCK_/i,               // Mock data constants
    /_xxxxx/i,              // Placeholder API keys
    /confirmPassword/i,     // Password confirmation checks
    /sk_live_.*Math\.random/i, // API key generation
    /defaultSecret/i,       // Fallback secret patterns
    /Math\.random\(\)\.toString/i, // Generated values
  ];
  
  let count = 0;
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, idx) => {
      // Skip if whitelisted
      if (whitelist.some(w => w.test(line))) return;
      
      for (const pattern of patterns) {
        if (pattern.regex.test(line)) {
          count++;
          issues.push({
            category: 'critical',
            type: 'hardcoded_secret',
            file: file.replace(process.cwd() + '/', ''),
            line: idx + 1,
            description: `Potential hardcoded ${pattern.type} detected`,
            autoFixable: false,
            recommendation: 'Move to environment variable'
          });
          break; // Only report once per line
        }
      }
    });
  }
  
  console.log(`   Found ${count} potential hardcoded secrets`);
}

// 4. Check for unused imports
function checkUnusedImports(files: string[]) {
  console.log('\n📋 Checking for unused imports...');
  
  let count = 0;
  for (const file of files) {
    if (!file.endsWith('.tsx') && !file.endsWith('.ts')) continue;
    
    const content = fs.readFileSync(file, 'utf-8');
    
    // Simple heuristic: find imports and check if they're used
    const importRegex = /import\s+(?:{([^}]+)}|(\w+))\s+from/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const imports = (match[1] || match[2] || '').split(',').map(i => i.trim().split(' as ')[0]);
      
      for (const imp of imports) {
        if (!imp || imp === 'type') continue;
        
        // Check if import is used (simple check - might have false positives)
        const restOfFile = content.substring(match.index + match[0].length);
        const usageRegex = new RegExp(`\\b${imp}\\b`, 'g');
        const usages = restOfFile.match(usageRegex);
        
        if (!usages || usages.length === 0) {
          count++;
          issues.push({
            category: 'info',
            type: 'unused_import',
            file: file.replace(process.cwd() + '/', ''),
            description: `Potentially unused import: ${imp}`,
            autoFixable: true,
            recommendation: 'Remove unused import'
          });
        }
      }
    }
  }
  
  console.log(`   Found ${count} potentially unused imports`);
}

// 5. Check for large files
function checkLargeFiles(files: string[]) {
  console.log('\n📋 Checking for large files...');
  
  const LINE_THRESHOLD = 500;
  let count = 0;
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lineCount = content.split('\n').length;
    
    if (lineCount > LINE_THRESHOLD) {
      count++;
      issues.push({
        category: lineCount > 1000 ? 'warning' : 'info',
        type: 'large_file',
        file: file.replace(process.cwd() + '/', ''),
        description: `File has ${lineCount} lines (threshold: ${LINE_THRESHOLD})`,
        autoFixable: false,
        recommendation: 'Consider splitting into smaller components'
      });
    }
  }
  
  console.log(`   Found ${count} large files`);
}

// 6. Check for missing error boundaries
function checkErrorBoundaries(files: string[]) {
  console.log('\n📋 Checking for error handling...');
  
  const pageFiles = files.filter(f => f.includes('/page.tsx'));
  const errorFiles = files.filter(f => f.includes('error.tsx'));
  
  // Check if each route segment has an error boundary
  const routeSegments = new Set<string>();
  pageFiles.forEach(f => {
    const dir = path.dirname(f);
    routeSegments.add(dir);
  });
  
  let missingCount = 0;
  routeSegments.forEach(segment => {
    const hasError = errorFiles.some(e => e.startsWith(segment));
    if (!hasError) {
      // Only warn for main route groups
      if (segment.includes('/(main)') || segment.includes('/(customer)')) {
        missingCount++;
        issues.push({
          category: 'info',
          type: 'missing_error_boundary',
          file: segment.replace(process.cwd() + '/', ''),
          description: 'Route segment missing error.tsx boundary',
          autoFixable: true,
          recommendation: 'Add error.tsx for graceful error handling'
        });
      }
    }
  });
  
  console.log(`   Found ${missingCount} route segments without error boundaries`);
}

// 7. Check database for orphan records
async function checkDatabaseIntegrity() {
  console.log('\n📋 Checking database integrity...');
  
  try {
    // Check for orphan customers (no tenant)
    const { data: orphanCustomers } = await supabase
      .from('customers')
      .select('id')
      .is('tenant_id', null);
    
    if (orphanCustomers && orphanCustomers.length > 0) {
      issues.push({
        category: 'critical',
        type: 'orphan_records',
        description: `${orphanCustomers.length} customers without tenant_id`,
        autoFixable: false,
        recommendation: 'Assign customers to valid tenants'
      });
    }
    
    // Check for invalid statuses
    const { data: invalidStatuses } = await supabase
      .from('entries')
      .select('id, status')
      .not('status', 'in', '("pending","confirmed","won","lost","cancelled","refunded")');
    
    if (invalidStatuses && invalidStatuses.length > 0) {
      issues.push({
        category: 'warning',
        type: 'invalid_status',
        description: `${invalidStatuses.length} entries with invalid status`,
        autoFixable: false,
        recommendation: 'Review and fix entry statuses'
      });
    }
    
    // Check revenue share configs
    const { data: revenueConfigs } = await supabase
      .from('revenue_share_configs')
      .select('*');
    
    let invalidConfigs = 0;
    revenueConfigs?.forEach(config => {
      const total = (config.tenant_share_percent || 0) + 
        (config.platform_share_percent || 0) + 
        (config.provider_share_percent || 0);
      if (Math.abs(total - 100) > 0.01) {
        invalidConfigs++;
      }
    });
    
    if (invalidConfigs > 0) {
      issues.push({
        category: 'critical',
        type: 'invalid_revenue_share',
        description: `${invalidConfigs} revenue share configs don't sum to 100%`,
        autoFixable: false,
        recommendation: 'Fix revenue share percentages'
      });
    }
    
    console.log('   Database integrity check complete');
  } catch (error) {
    console.log('   Database check skipped (connection issue)');
  }
}

// 8. Check for duplicate code patterns
function checkDuplicatePatterns(files: string[]) {
  console.log('\n📋 Checking for code duplication patterns...');
  
  // Look for repeated fetch patterns that could be abstracted
  const fetchPatterns: Record<string, string[]> = {};
  
  for (const file of files) {
    if (!file.includes('/api/')) continue;
    
    const content = fs.readFileSync(file, 'utf-8');
    
    // Check for repeated Supabase queries
    const queryMatch = content.match(/supabase\.from\(['"](\w+)['"]\)/g);
    if (queryMatch) {
      queryMatch.forEach(q => {
        const table = q.match(/from\(['"](\w+)['"]\)/)?.[1];
        if (table) {
          if (!fetchPatterns[table]) fetchPatterns[table] = [];
          fetchPatterns[table].push(file);
        }
      });
    }
  }
  
  // Report tables accessed from many files (might need abstraction)
  Object.entries(fetchPatterns).forEach(([table, files]) => {
    if (files.length > 5) {
      issues.push({
        category: 'info',
        type: 'code_duplication',
        description: `Table '${table}' accessed directly in ${files.length} API routes`,
        autoFixable: false,
        recommendation: 'Consider creating a shared service/repository pattern'
      });
    }
  });
  
  console.log('   Duplication check complete');
}

// 9. Security headers check
function checkSecurityHeaders() {
  console.log('\n📋 Checking security configuration...');
  
  // Check next.config.js for security headers
  const nextConfigPath = path.join(process.cwd(), 'next.config.js');
  const nextConfigMjsPath = path.join(process.cwd(), 'next.config.mjs');
  const nextConfigTsPath = path.join(process.cwd(), 'next.config.ts');
  
  let configContent = '';
  if (fs.existsSync(nextConfigPath)) {
    configContent = fs.readFileSync(nextConfigPath, 'utf-8');
  } else if (fs.existsSync(nextConfigMjsPath)) {
    configContent = fs.readFileSync(nextConfigMjsPath, 'utf-8');
  } else if (fs.existsSync(nextConfigTsPath)) {
    configContent = fs.readFileSync(nextConfigTsPath, 'utf-8');
  }
  
  const securityHeaders = [
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Strict-Transport-Security',
    'Content-Security-Policy',
  ];
  
  securityHeaders.forEach(header => {
    if (!configContent.includes(header)) {
      issues.push({
        category: 'warning',
        type: 'missing_security_header',
        description: `Missing security header: ${header}`,
        autoFixable: true,
        recommendation: 'Add security header to next.config.js'
      });
    }
  });
  
  // Check for CORS configuration
  if (!configContent.includes('Access-Control-Allow-Origin')) {
    issues.push({
      category: 'info',
      type: 'cors_config',
      description: 'CORS configuration not found in next.config',
      autoFixable: false,
      recommendation: 'Review CORS policy for API routes'
    });
  }
  
  console.log('   Security configuration check complete');
}

// 10. Environment variables check
function checkEnvironmentVariables() {
  console.log('\n📋 Checking environment variables...');
  
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];
  
  const missingVars: string[] = [];
  requiredEnvVars.forEach(v => {
    if (!process.env[v]) {
      missingVars.push(v);
    }
  });
  
  if (missingVars.length > 0) {
    issues.push({
      category: 'critical',
      type: 'missing_env_var',
      description: `Missing required environment variables: ${missingVars.join(', ')}`,
      autoFixable: false,
      recommendation: 'Add missing environment variables'
    });
  }
  
  // Check for .env files in git
  if (fs.existsSync('.env') || fs.existsSync('.env.local')) {
    const gitignoreContent = fs.existsSync('.gitignore') 
      ? fs.readFileSync('.gitignore', 'utf-8') : '';
    
    if (!gitignoreContent.includes('.env')) {
      issues.push({
        category: 'critical',
        type: 'env_not_gitignored',
        description: '.env files might not be gitignored',
        autoFixable: true,
        recommendation: 'Add .env* to .gitignore'
      });
    }
  }
  
  console.log('   Environment check complete');
}

// Generate report
function generateReport(): CleanupReport {
  const stats = {
    totalFiles: 0,
    totalIssues: issues.length,
    criticalCount: issues.filter(i => i.category === 'critical').length,
    warningCount: issues.filter(i => i.category === 'warning').length,
    infoCount: issues.filter(i => i.category === 'info').length,
    autoFixableCount: issues.filter(i => i.autoFixable).length,
  };
  
  const categories: Record<string, number> = {};
  issues.forEach(i => {
    categories[i.type] = (categories[i.type] || 0) + 1;
  });
  
  return {
    timestamp: new Date().toISOString(),
    issues,
    stats,
    categories,
  };
}

// Print report
function printReport(report: CleanupReport) {
  console.log('\n');
  console.log('═'.repeat(70));
  console.log('  FIN PLATFORM - PRODUCTION CLEANUP REPORT');
  console.log('═'.repeat(70));
  console.log(`  Generated: ${report.timestamp}`);
  console.log('─'.repeat(70));
  
  // Summary
  console.log('\n📊 SUMMARY');
  console.log('─'.repeat(40));
  console.log(`  Total Issues:     ${report.stats.totalIssues}`);
  console.log(`  🔴 Critical:      ${report.stats.criticalCount}`);
  console.log(`  🟡 Warnings:      ${report.stats.warningCount}`);
  console.log(`  🔵 Info:          ${report.stats.infoCount}`);
  console.log(`  🔧 Auto-fixable:  ${report.stats.autoFixableCount}`);
  
  // By category
  console.log('\n📋 ISSUES BY TYPE');
  console.log('─'.repeat(40));
  Object.entries(report.categories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type.padEnd(25)} ${count}`);
    });
  
  // Critical issues detail
  const criticalIssues = report.issues.filter(i => i.category === 'critical');
  if (criticalIssues.length > 0) {
    console.log('\n🔴 CRITICAL ISSUES (Must Fix)');
    console.log('─'.repeat(40));
    criticalIssues.forEach((issue, idx) => {
      console.log(`  ${idx + 1}. ${issue.description}`);
      if (issue.file) console.log(`     File: ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
      console.log(`     Fix: ${issue.recommendation}`);
    });
  }
  
  // Warning issues (first 10)
  const warningIssues = report.issues.filter(i => i.category === 'warning');
  if (warningIssues.length > 0) {
    console.log('\n🟡 WARNINGS (Should Fix)');
    console.log('─'.repeat(40));
    warningIssues.slice(0, 10).forEach((issue, idx) => {
      console.log(`  ${idx + 1}. ${issue.description}`);
      if (issue.file) console.log(`     File: ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
    });
    if (warningIssues.length > 10) {
      console.log(`  ... and ${warningIssues.length - 10} more warnings`);
    }
  }
  
  // Production readiness score (weighted by severity)
  // Critical: -20 each, Warning: -0.5 each (max 50 penalty), Info: ignored
  const warningPenalty = Math.min(50, report.stats.warningCount * 0.5);
  const score = Math.max(0, 100 - (report.stats.criticalCount * 20) - warningPenalty);
  console.log('\n📈 PRODUCTION READINESS SCORE');
  console.log('─'.repeat(40));
  console.log(`  Score: ${score.toFixed(0)}/100`);
  
  let status = 'Ready for Production';
  if (report.stats.criticalCount > 0) status = 'NOT Ready - Critical Issues';
  else if (score < 60) status = 'Needs Improvement';
  else if (score < 80) status = 'Good - Minor Issues';
  else if (score < 95) status = 'Production Ready - Minor Cleanup';
  
  console.log(`  Status: ${status}`);
  
  console.log('\n' + '═'.repeat(70));
}

// Main execution
async function main() {
  console.log('🔍 FIN Platform Production Cleanup Scanner');
  console.log('─'.repeat(50));
  
  const codeFiles = scanDirectory('.', ['.ts', '.tsx', '.js', '.jsx']);
  console.log(`\nScanning ${codeFiles.length} files...`);
  
  // Run all checks
  checkConsoleLogs(codeFiles);
  checkTodoComments(codeFiles);
  checkHardcodedSecrets(codeFiles);
  checkUnusedImports(codeFiles);
  checkLargeFiles(codeFiles);
  checkErrorBoundaries(codeFiles);
  await checkDatabaseIntegrity();
  checkDuplicatePatterns(codeFiles);
  checkSecurityHeaders();
  checkEnvironmentVariables();
  
  // Generate and print report
  const report = generateReport();
  printReport(report);
  
  // Save report to file
  const reportPath = './scripts/production-cleanup/cleanup-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Full report saved to: ${reportPath}`);
}

main().catch(console.error);
