/**
 * Enterprise Centralized Logging System
 * Provides structured logging with levels, context, and production-safe output
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogContext {
  module?: string;
  action?: string;
  userId?: string;
  tenantId?: string;
  requestId?: string;
  duration?: number;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private module: string;
  private static logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  private static isProduction = process.env.NODE_ENV === 'production';
  
  private static levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
  };

  constructor(module: string) {
    this.module = module;
  }

  private shouldLog(level: LogLevel): boolean {
    return Logger.levelPriority[level] >= Logger.levelPriority[Logger.logLevel];
  }

  private formatEntry(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        module: this.module,
        ...context,
      },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: Logger.isProduction ? undefined : error.stack,
      };
    }

    return entry;
  }

  private output(entry: LogEntry): void {
    if (Logger.isProduction) {
      // In production, output as JSON for log aggregation
      const output = JSON.stringify(entry);
      if (entry.level === 'error' || entry.level === 'fatal') {
        console.error(output);
      } else if (entry.level === 'warn') {
        console.warn(output);
      } else {
        console.log(output);
      }
    } else {
      // In development, output human-readable format
      const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${this.module}]`;
      const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
      
      if (entry.level === 'error' || entry.level === 'fatal') {
        console.error(`${prefix} ${entry.message}${contextStr}`);
        if (entry.error?.stack) {
          console.error(entry.error.stack);
        }
      } else if (entry.level === 'warn') {
        console.warn(`${prefix} ${entry.message}${contextStr}`);
      } else {
        console.log(`${prefix} ${entry.message}${contextStr}`);
      }
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      this.output(this.formatEntry('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      this.output(this.formatEntry('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      this.output(this.formatEntry('warn', message, context));
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.output(this.formatEntry('error', message, context, err));
    }
  }

  fatal(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog('fatal')) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.output(this.formatEntry('fatal', message, context, err));
    }
  }

  // Timing helper for performance logging
  time(label: string): () => void {
    const start = performance.now();
    return () => {
      const duration = Math.round(performance.now() - start);
      this.debug(`${label} completed`, { duration, action: 'timing' });
    };
  }

  // Create child logger with additional context
  child(additionalModule: string): Logger {
    return new Logger(`${this.module}:${additionalModule}`);
  }
}

// Factory function for creating loggers
export function createLogger(module: string): Logger {
  return new Logger(module);
}

// Pre-configured loggers for common modules
export const loggers = {
  api: createLogger('api'),
  auth: createLogger('auth'),
  database: createLogger('database'),
  finance: createLogger('finance'),
  betting: createLogger('betting'),
  security: createLogger('security'),
  worker: createLogger('worker'),
  queue: createLogger('queue'),
};

export type { Logger, LogLevel, LogContext, LogEntry };
