/**
 * Gateway Connection Manager
 * จัดการการเชื่อมต่อ Payment Gateway แบบ robust
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern
 * - Fallback mechanisms
 * - Connection pooling
 */

interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  timeout: number;
}

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

// Circuit breaker states per gateway
const circuitBreakers: Map<string, CircuitBreakerState> = new Map();

// Default retry options
const defaultRetryOptions: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  timeout: 30000, // 30 seconds
};

// Circuit breaker config
const CIRCUIT_BREAKER_THRESHOLD = 5; // failures before opening
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute before half-open

/**
 * Execute a gateway call with retry logic
 */
export async function executeWithRetry<T>(
  gatewayId: string,
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...defaultRetryOptions, ...options };
  
  // Check circuit breaker
  const circuitState = getCircuitBreakerState(gatewayId);
  if (circuitState.state === 'open') {
    // Check if we should try half-open
    if (Date.now() - circuitState.lastFailure > CIRCUIT_BREAKER_TIMEOUT) {
      circuitState.state = 'half-open';
    } else {
      throw new Error(`Circuit breaker open for gateway ${gatewayId}`);
    }
  }
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // Execute with timeout
      const result = await executeWithTimeout(operation, opts.timeout);
      
      // Success - reset circuit breaker
      resetCircuitBreaker(gatewayId);
      
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Record failure
      recordFailure(gatewayId);
      
      // Check if we should retry
      if (attempt < opts.maxRetries) {
        // Calculate delay with exponential backoff
        const delay = Math.min(
          opts.baseDelay * Math.pow(2, attempt),
          opts.maxDelay
        );
        
        // Add jitter (0-25%)
        const jitter = delay * Math.random() * 0.25;
        
        await sleep(delay + jitter);
      }
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
}

/**
 * Execute with timeout
 */
async function executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeout: number
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), timeout)
    ),
  ]);
}

/**
 * Get circuit breaker state
 */
function getCircuitBreakerState(gatewayId: string): CircuitBreakerState {
  if (!circuitBreakers.has(gatewayId)) {
    circuitBreakers.set(gatewayId, {
      failures: 0,
      lastFailure: 0,
      state: 'closed',
    });
  }
  return circuitBreakers.get(gatewayId)!;
}

/**
 * Record a failure
 */
function recordFailure(gatewayId: string): void {
  const state = getCircuitBreakerState(gatewayId);
  state.failures++;
  state.lastFailure = Date.now();
  
  if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    state.state = 'open';
  }
}

/**
 * Reset circuit breaker
 */
function resetCircuitBreaker(gatewayId: string): void {
  const state = getCircuitBreakerState(gatewayId);
  state.failures = 0;
  state.state = 'closed';
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safe gateway call wrapper - won't crash the system
 */
export async function safeGatewayCall<T>(
  gatewayId: string,
  operation: () => Promise<T>,
  fallback: T
): Promise<{ success: boolean; data: T; error?: string }> {
  try {
    const result = await executeWithRetry(gatewayId, operation);
    return { success: true, data: result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Gateway ${gatewayId}] Call failed:`, errorMessage);
    return { success: false, data: fallback, error: errorMessage };
  }
}

/**
 * Batch gateway calls with partial failure handling
 */
export async function batchGatewayCall<T>(
  calls: Array<{ gatewayId: string; operation: () => Promise<T>; fallback: T }>
): Promise<Array<{ gatewayId: string; success: boolean; data: T; error?: string }>> {
  return Promise.all(
    calls.map(async ({ gatewayId, operation, fallback }) => {
      const result = await safeGatewayCall(gatewayId, operation, fallback);
      return { gatewayId, ...result };
    })
  );
}

/**
 * Gateway connection status
 */
export function getGatewayStatus(gatewayId: string): {
  state: 'healthy' | 'degraded' | 'down';
  failures: number;
  lastFailure: number | null;
} {
  const circuitState = getCircuitBreakerState(gatewayId);
  
  let state: 'healthy' | 'degraded' | 'down';
  if (circuitState.state === 'open') {
    state = 'down';
  } else if (circuitState.failures > 0) {
    state = 'degraded';
  } else {
    state = 'healthy';
  }
  
  return {
    state,
    failures: circuitState.failures,
    lastFailure: circuitState.lastFailure || null,
  };
}

/**
 * Reset all circuit breakers (for admin use)
 */
export function resetAllCircuitBreakers(): void {
  circuitBreakers.clear();
}

/**
 * Get all gateway statuses
 */
export function getAllGatewayStatuses(): Record<string, ReturnType<typeof getGatewayStatus>> {
  const statuses: Record<string, ReturnType<typeof getGatewayStatus>> = {};
  
  for (const [gatewayId] of circuitBreakers) {
    statuses[gatewayId] = getGatewayStatus(gatewayId);
  }
  
  return statuses;
}
