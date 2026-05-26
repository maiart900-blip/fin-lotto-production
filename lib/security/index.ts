/**
 * Enterprise Security Module
 * Comprehensive security system for FIN Platform
 */

// RBAC (Role-Based Access Control)
export {
  hasPermission,
  getUserPermissionContext,
  assignRole,
  revokeRole,
  grantPermission,
  denyPermission,
  getAllPermissions,
  getAllRoles,
  createCustomRole,
  type UserType,
  type Permission,
  type Role,
  type UserPermissionContext
} from './enterprise-rbac';

// Two-Factor Authentication
export {
  generateTOTPSecret,
  verifyTOTP,
  generateBackupCodes,
  initializeTwoFactor,
  verifyAndEnableTwoFactor,
  verifyTwoFactorCode,
  getTwoFactorStatus,
  disableTwoFactor,
  regenerateBackupCodes,
  isTwoFactorRequired,
  type TwoFactorMethod,
  type TwoFactorSetup,
  type TwoFactorStatus
} from './enterprise-2fa';

// Session Management
export {
  createSession,
  validateSession,
  refreshSession,
  terminateSession,
  terminateAllUserSessions,
  getUserSessions,
  cleanupExpiredSessions,
  detectSuspiciousActivity,
  type SessionInfo,
  type CreateSessionOptions
} from './enterprise-session';

// Security Monitoring
export {
  recordLoginAttempt,
  blacklistIP,
  isIPBlacklisted,
  isIPWhitelisted,
  createSecurityIncident,
  updateIncidentStatus,
  getActiveIncidents,
  logDataAccess,
  validatePassword,
  checkRateLimit,
  logAPIKeyUsage,
  type IncidentType,
  type IncidentSeverity,
  type SecurityIncident,
  type LoginAttemptRecord
} from './enterprise-monitor';
