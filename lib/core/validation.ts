/**
 * Centralized Validation Utilities
 * Provides reusable validation functions with consistent error messages
 */

import { z } from 'zod';
import { Result, ok, err, AppError, appError, ErrorCodes } from './result';

// Common validation schemas
export const schemas = {
  // UUID validation
  uuid: z.string().uuid('Invalid ID format'),
  
  // Thai phone number
  thaiPhone: z.string().regex(/^0[689]\d{8}$/, 'Invalid Thai phone number'),
  
  // Username
  username: z.string()
    .min(4, 'Username must be at least 4 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  
  // Password
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  
  // Money amount (positive, max 2 decimals)
  amount: z.number()
    .positive('Amount must be positive')
    .multipleOf(0.01, 'Amount can have at most 2 decimal places'),
  
  // Percentage (0-100)
  percentage: z.number()
    .min(0, 'Percentage must be at least 0')
    .max(100, 'Percentage must be at most 100'),
  
  // Thai bank account
  bankAccount: z.string()
    .regex(/^\d{10,15}$/, 'Invalid bank account number'),
  
  // Lottery number (2 digits)
  lotteryNumber2: z.string()
    .regex(/^\d{2}$/, 'Must be exactly 2 digits'),
  
  // Lottery number (3 digits)
  lotteryNumber3: z.string()
    .regex(/^\d{3}$/, 'Must be exactly 3 digits'),
  
  // Date string (ISO format)
  dateString: z.string().datetime('Invalid date format'),
  
  // Pagination
  pagination: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  
  // Search/filter
  searchQuery: z.string().max(100).optional(),
};

// Validate with Result type
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Result<T, AppError> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return ok(result.data);
  }
  
  const errors = result.error.errors.map(e => ({
    path: e.path.join('.'),
    message: e.message,
  }));
  
  return err(appError(
    ErrorCodes.VALIDATION_FAILED,
    'Validation failed',
    { errors }
  ));
}

// Validate async
export async function validateAsync<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<Result<T, AppError>> {
  const result = await schema.safeParseAsync(data);
  
  if (result.success) {
    return ok(result.data);
  }
  
  const errors = result.error.errors.map(e => ({
    path: e.path.join('.'),
    message: e.message,
  }));
  
  return err(appError(
    ErrorCodes.VALIDATION_FAILED,
    'Validation failed',
    { errors }
  ));
}

// Business rule validators
export const businessRules = {
  // Check if amount is within betting limits
  isWithinBettingLimits(amount: number, min: number, max: number): Result<number, AppError> {
    if (amount < min) {
      return err(appError(
        ErrorCodes.VALIDATION_FAILED,
        `Minimum bet is ${min} baht`,
        { amount, min }
      ));
    }
    if (amount > max) {
      return err(appError(
        ErrorCodes.LIMIT_EXCEEDED,
        `Maximum bet is ${max} baht`,
        { amount, max }
      ));
    }
    return ok(amount);
  },

  // Check if customer has sufficient balance
  hasSufficientBalance(balance: number, required: number): Result<void, AppError> {
    if (balance < required) {
      return err(appError(
        ErrorCodes.INSUFFICIENT_BALANCE,
        'Insufficient balance',
        { balance, required, shortage: required - balance }
      ));
    }
    return ok(undefined);
  },

  // Check if within operating hours
  isWithinOperatingHours(
    currentTime: Date,
    openHour: number,
    closeHour: number
  ): Result<void, AppError> {
    const hour = currentTime.getHours();
    if (hour < openHour || hour >= closeHour) {
      return err(appError(
        ErrorCodes.OPERATION_NOT_ALLOWED,
        `Operating hours are ${openHour}:00 - ${closeHour}:00`,
        { currentHour: hour, openHour, closeHour }
      ));
    }
    return ok(undefined);
  },

  // Check daily limit
  isWithinDailyLimit(
    currentTotal: number,
    newAmount: number,
    dailyLimit: number
  ): Result<void, AppError> {
    const newTotal = currentTotal + newAmount;
    if (newTotal > dailyLimit) {
      return err(appError(
        ErrorCodes.LIMIT_EXCEEDED,
        'Daily limit exceeded',
        { currentTotal, newAmount, dailyLimit, remaining: dailyLimit - currentTotal }
      ));
    }
    return ok(undefined);
  },
};

// Sanitization utilities
export const sanitize = {
  // Remove dangerous characters
  text(input: string): string {
    return input
      .replace(/[<>]/g, '')
      .trim();
  },

  // Normalize phone number
  phone(input: string): string {
    return input.replace(/[^0-9]/g, '');
  },

  // Normalize bank account
  bankAccount(input: string): string {
    return input.replace(/[^0-9]/g, '');
  },

  // Format amount to 2 decimal places
  amount(input: number): number {
    return Math.round(input * 100) / 100;
  },
};

export { z };
