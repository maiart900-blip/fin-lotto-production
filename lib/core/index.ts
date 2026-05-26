/**
 * Core Library Index
 * Re-exports all core utilities for easy importing
 */

// Logging
export { createLogger, loggers } from './logger';
export type { Logger, LogLevel, LogContext, LogEntry } from './logger';

// Result types
export {
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  map,
  mapError,
  flatMap,
  tryCatch,
  tryCatchAsync,
  all,
  appError,
  ErrorCodes,
} from './result';
export type { Result, AsyncResult, AppError } from './result';

// Validation
export {
  schemas,
  validate,
  validateAsync,
  businessRules,
  sanitize,
  z,
} from './validation';

// Services
export {
  BaseService,
  CustomerService,
  FinanceService,
  BettingService,
  createServices,
} from './services';
export type { ServiceContext } from './services';

// API Response utilities
export {
  apiSuccess,
  apiCreated,
  apiNoContent,
  apiError,
  apiBadRequest,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiConflict,
  apiInternalError,
  appErrorToResponse,
  parsePagination,
  createPaginationMeta,
  parseBody,
  withErrorHandling,
} from './api-response';
export type { ApiResponse } from './api-response';

// Hooks (client-side only)
export {
  useApi,
  usePaginatedApi,
  useDebounce,
  useLocalStorage,
  useToggle,
  usePrevious,
  useMediaQuery,
  useIsMobile,
  useIsDesktop,
  useAsyncAction,
  useClipboard,
  useCountdown,
} from './hooks';
