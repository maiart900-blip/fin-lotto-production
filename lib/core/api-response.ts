/**
 * API Response Utilities
 * Standardizes API responses across all endpoints
 */

import { NextResponse } from 'next/server';
import { createLogger } from './logger';
import { AppError, ErrorCodes } from './result';

const logger = createLogger('api');

// Standard API response structure
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

// Success response helpers
export function apiSuccess<T>(data: T, meta?: ApiResponse['meta']): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    meta,
  });
}

export function apiCreated<T>(data: T): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    { success: true, data },
    { status: 201 }
  );
}

export function apiNoContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

// Error response helpers
export function apiError(
  code: string,
  message: string,
  status: number = 400,
  details?: Record<string, unknown>
): NextResponse<ApiResponse<never>> {
  logger.warn(`API Error: ${code}`, { code, message, status, details });
  
  return NextResponse.json(
    {
      success: false,
      error: { code, message, details },
    },
    { status }
  );
}

export function apiBadRequest(message: string, details?: Record<string, unknown>): NextResponse<ApiResponse<never>> {
  return apiError(ErrorCodes.INVALID_INPUT, message, 400, details);
}

export function apiUnauthorized(message: string = 'Unauthorized'): NextResponse<ApiResponse<never>> {
  return apiError(ErrorCodes.UNAUTHORIZED, message, 401);
}

export function apiForbidden(message: string = 'Forbidden'): NextResponse<ApiResponse<never>> {
  return apiError(ErrorCodes.FORBIDDEN, message, 403);
}

export function apiNotFound(resource: string = 'Resource'): NextResponse<ApiResponse<never>> {
  return apiError(ErrorCodes.NOT_FOUND, `${resource} not found`, 404);
}

export function apiConflict(message: string): NextResponse<ApiResponse<never>> {
  return apiError(ErrorCodes.CONFLICT, message, 409);
}

export function apiInternalError(error?: Error | unknown): NextResponse<ApiResponse<never>> {
  if (error) {
    logger.error('Internal server error', error);
  }
  return apiError(ErrorCodes.INTERNAL_ERROR, 'Internal server error', 500);
}

// Convert AppError to API response
export function appErrorToResponse(error: AppError): NextResponse<ApiResponse<never>> {
  const statusMap: Record<string, number> = {
    [ErrorCodes.UNAUTHORIZED]: 401,
    [ErrorCodes.FORBIDDEN]: 403,
    [ErrorCodes.NOT_FOUND]: 404,
    [ErrorCodes.CONFLICT]: 409,
    [ErrorCodes.ALREADY_EXISTS]: 409,
    [ErrorCodes.VALIDATION_FAILED]: 400,
    [ErrorCodes.INVALID_INPUT]: 400,
    [ErrorCodes.MISSING_REQUIRED]: 400,
    [ErrorCodes.INSUFFICIENT_BALANCE]: 400,
    [ErrorCodes.LIMIT_EXCEEDED]: 400,
    [ErrorCodes.OPERATION_NOT_ALLOWED]: 403,
    [ErrorCodes.DATABASE_ERROR]: 500,
    [ErrorCodes.EXTERNAL_SERVICE_ERROR]: 502,
    [ErrorCodes.INTERNAL_ERROR]: 500,
  };

  const status = statusMap[error.code] || 400;
  return apiError(error.code, error.message, status, error.details);
}

// Pagination helpers
export function parsePagination(searchParams: URLSearchParams): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function createPaginationMeta(
  page: number,
  limit: number,
  total: number
): ApiResponse['meta'] {
  return {
    page,
    limit,
    total,
    hasMore: page * limit < total,
  };
}

// Request body parser with validation
export async function parseBody<T>(
  request: Request,
  validator?: (data: unknown) => T
): Promise<T> {
  try {
    const body = await request.json();
    if (validator) {
      return validator(body);
    }
    return body as T;
  } catch {
    throw new Error('Invalid JSON body');
  }
}

// API handler wrapper with error handling
export function withErrorHandling<T>(
  handler: () => Promise<NextResponse<ApiResponse<T>>>
): Promise<NextResponse<ApiResponse<T>>> {
  return handler().catch((error: unknown) => {
    if (error instanceof Error && error.message === 'Invalid JSON body') {
      return apiBadRequest('Invalid request body');
    }
    return apiInternalError(error);
  });
}
