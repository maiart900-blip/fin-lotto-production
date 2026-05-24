'use client';

interface ErrorReport {
  title: string;
  message?: string;
  path?: string;
  error_type?: 'error' | 'warning' | 'critical' | 'info';
  stack_trace?: string;
}

export async function reportError(error: Error | ErrorReport): Promise<void> {
  try {
    const report: ErrorReport = error instanceof Error
      ? {
          title: error.name || 'Error',
          message: error.message,
          path: typeof window !== 'undefined' ? window.location.pathname : undefined,
          error_type: 'error',
          stack_trace: error.stack,
        }
      : error;

    // Add user agent
    const user_agent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

    await fetch('/api/error-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...report,
        user_agent,
        path: report.path || (typeof window !== 'undefined' ? window.location.pathname : undefined),
      }),
    });
  } catch (e) {
    console.error('[v0] Failed to report error:', e);
  }
}

// Report 404 errors
export function report404(path: string): void {
  reportError({
    title: 'Page Not Found (404)',
    message: `User tried to access non-existent page: ${path}`,
    path,
    error_type: 'warning',
  });
}

// Report API errors
export function reportApiError(endpoint: string, status: number, message?: string): void {
  reportError({
    title: `API Error (${status})`,
    message: message || `API call to ${endpoint} failed with status ${status}`,
    path: endpoint,
    error_type: status >= 500 ? 'critical' : 'error',
  });
}

// Report data loading errors
export function reportDataError(component: string, message?: string): void {
  reportError({
    title: 'Data Loading Error',
    message: message || `Failed to load data in ${component}`,
    path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    error_type: 'error',
  });
}

// Global error handler setup
export function setupGlobalErrorHandler(): void {
  if (typeof window === 'undefined') return;

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    reportError({
      title: 'Unhandled Promise Rejection',
      message: event.reason?.message || String(event.reason),
      error_type: 'critical',
      stack_trace: event.reason?.stack,
    });
  });

  // Handle global errors
  window.addEventListener('error', (event) => {
    reportError({
      title: 'Uncaught Error',
      message: event.message,
      error_type: 'critical',
      stack_trace: event.error?.stack,
    });
  });
}
