/**
 * Result Type Pattern
 * Provides type-safe error handling without exceptions
 */

export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

// Factory functions
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

// Type guards
export function isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success === true;
}

export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

// Utility functions
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.data;
  }
  throw result.error;
}

export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.data;
  }
  return defaultValue;
}

export function map<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.data));
  }
  return result;
}

export function mapError<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  if (isErr(result)) {
    return err(fn(result.error));
  }
  return result;
}

export function flatMap<T, U, E>(result: Result<T, E>, fn: (data: T) => Result<U, E>): Result<U, E> {
  if (isOk(result)) {
    return fn(result.data);
  }
  return result;
}

// Try-catch wrapper
export function tryCatch<T>(fn: () => T): Result<T, Error> {
  try {
    return ok(fn());
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function tryCatchAsync<T>(fn: () => Promise<T>): AsyncResult<T, Error> {
  try {
    return ok(await fn());
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

// Combine multiple results
export function all<T extends readonly Result<unknown, unknown>[]>(
  results: T
): Result<
  { [K in keyof T]: T[K] extends Result<infer U, unknown> ? U : never },
  T[number] extends Result<unknown, infer E> ? E : never
> {
  const data: unknown[] = [];
  for (const result of results) {
    if (isErr(result)) {
      return result as Result<never, T[number] extends Result<unknown, infer E> ? E : never>;
    }
    data.push(result.data);
  }
  return ok(data as { [K in keyof T]: T[K] extends Result<infer U, unknown> ? U : never });
}

// Domain-specific error types
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export function appError(code: string, message: string, details?: Record<string, unknown>): AppError {
  return { code, message, details };
}

// Common error codes
export const ErrorCodes = {
  // Auth errors
  UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  FORBIDDEN: 'AUTH_FORBIDDEN',
  INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  
  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_INPUT: 'VALIDATION_INVALID_INPUT',
  MISSING_REQUIRED: 'VALIDATION_MISSING_REQUIRED',
  
  // Resource errors
  NOT_FOUND: 'RESOURCE_NOT_FOUND',
  ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  CONFLICT: 'RESOURCE_CONFLICT',
  
  // Business logic errors
  INSUFFICIENT_BALANCE: 'BUSINESS_INSUFFICIENT_BALANCE',
  LIMIT_EXCEEDED: 'BUSINESS_LIMIT_EXCEEDED',
  OPERATION_NOT_ALLOWED: 'BUSINESS_OPERATION_NOT_ALLOWED',
  
  // System errors
  DATABASE_ERROR: 'SYSTEM_DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'SYSTEM_EXTERNAL_SERVICE_ERROR',
  INTERNAL_ERROR: 'SYSTEM_INTERNAL_ERROR',
} as const;
