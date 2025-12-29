/**
 * Enhanced API Integration Service
 * Implements robust rate limiting, circuit breaker patterns, timeout handling,
 * credit management, and API health monitoring
 * 
 * Requirements: 2.7, 2.8 - Optimize External API Integration
 */

import { ErrorDetail, FailureReason, ProcessingStep } from '../types';
import { createErrorDetail } from './errorHandlingService';

// Circuit Breaker States
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

// API Health Status
export type ApiHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

// Rate Limiting Configuration
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  burstLimit?: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

// Circuit Breaker Configuration
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringWindow: number;
  halfOpenMaxCalls: number;
  successThreshold: number;
}

// Timeout Configuration
export interface TimeoutConfig {
  requestTimeout: number;
  connectionTimeout: number;
  retryTimeout: number;
  maxRetries: number;
}

// Credit Management Configuration
export interface CreditConfig {
  maxCredits: number;
  creditRefillRate: number;
  creditRefillInterval: number;
  lowCreditThreshold: number;
  emergencyReserve: number;
}

// API Service Configuration
export interface ApiServiceConfig {
  name: string;
  baseUrl: string;
  rateLimit: RateLimitConfig;
  circuitBreaker: CircuitBreakerConfig;
  timeout: TimeoutConfig;
  credits?: CreditConfig;
  priority: 'high' | 'medium' | 'low';
  healthCheckEndpoint?: string;
  healthCheckInterval: number;
}

// Request Context
export interface RequestContext {
  serviceId: string;
  operation: string;
  priority: 'high' | 'medium' | 'low';
  retryable: boolean;
  creditsRequired?: number;
  metadata?: Record<string, any>;
}

// API Response
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  responseTime: number;
  creditsUsed?: number;
  rateLimitRemaining?: number;
  retryAfter?: number;
}

// Rate Limiter Implementation
class RateLimiter {
  private requests: number[] = [];
  private burstRequests: number[] = [];

  constructor(private config: RateLimitConfig) { }

  async checkLimit(): Promise<{ allowed: boolean; retryAfter?: number }> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Clean old requests
    this.requests = this.requests.filter(time => time > windowStart);

    // Check regular rate limit
    if (this.requests.length >= this.config.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const retryAfter = oldestRequest + this.config.windowMs - now;
      return { allowed: false, retryAfter };
    }

    // Check burst limit if configured
    if (this.config.burstLimit) {
      const burstWindowStart = now - 1000; // 1 second burst window
      this.burstRequests = this.burstRequests.filter(time => time > burstWindowStart);

      if (this.burstRequests.length >= this.config.burstLimit) {
        return { allowed: false, retryAfter: 1000 };
      }

      this.burstRequests.push(now);
    }

    this.requests.push(now);
    return { allowed: true };
  }

  getStats(): { currentRequests: number; maxRequests: number; resetTime: number } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    this.requests = this.requests.filter(time => time > windowStart);

    const resetTime = this.requests.length > 0 ?
      Math.min(...this.requests) + this.config.windowMs : now;

    return {
      currentRequests: this.requests.length,
      maxRequests: this.config.maxRequests,
      resetTime
    };
  }
}

// Circuit Breaker Implementation
class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failures: number[] = [];
  private successes: number[] = [];
  private lastFailureTime = 0;
  private halfOpenCalls = 0;

  constructor(private config: CircuitBreakerConfig) { }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.config.recoveryTimeout) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
      this.halfOpenCalls = 0;
    }

    if (this.state === 'HALF_OPEN' && this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      throw new Error('Circuit breaker HALF_OPEN call limit exceeded');
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    const now = Date.now();
    this.successes.push(now);

    if (this.state === 'HALF_OPEN') {
      this.halfOpenCalls++;
      if (this.halfOpenCalls >= this.config.successThreshold) {
        this.state = 'CLOSED';
        this.failures = [];
        this.successes = [];
      }
    }

    // Clean old successes
    const windowStart = now - this.config.monitoringWindow;
    this.successes = this.successes.filter(time => time > windowStart);
  }

  private onFailure(): void {
    const now = Date.now();
    this.failures.push(now);
    this.lastFailureTime = now;

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      return;
    }

    // Clean old failures
    const windowStart = now - this.config.monitoringWindow;
    this.failures = this.failures.filter(time => time > windowStart);

    // Check if we should open the circuit
    if (this.failures.length >= this.config.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getStats(): {
    state: CircuitBreakerState;
    failures: number;
    successes: number;
    nextRetryTime?: number
  } {
    const now = Date.now();
    const windowStart = now - this.config.monitoringWindow;

    this.failures = this.failures.filter(time => time > windowStart);
    this.successes = this.successes.filter(time => time > windowStart);

    return {
      state: this.state,
      failures: this.failures.length,
      successes: this.successes.length,
      nextRetryTime: this.state === 'OPEN' ?
        this.lastFailureTime + this.config.recoveryTimeout : undefined
    };
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failures = [];
    this.successes = [];
    this.halfOpenCalls = 0;
  }
}

// Credit Manager Implementation
class CreditManager {
  private credits: number;
  private lastRefill = Date.now();

  constructor(private config: CreditConfig) {
    this.credits = config.maxCredits;
  }

  async checkCredits(required: number): Promise<{ available: boolean; current: number; refillTime?: number }> {
    this.refillCredits();

    if (this.credits >= required) {
      return { available: true, current: this.credits };
    }

    // Calculate when enough credits will be available
    const creditsNeeded = required - this.credits;
    const refillTime = Math.ceil(creditsNeeded / this.config.creditRefillRate) * this.config.creditRefillInterval;

    return {
      available: false,
      current: this.credits,
      refillTime: Date.now() + refillTime
    };
  }

  consumeCredits(amount: number): boolean {
    this.refillCredits();

    if (this.credits >= amount) {
      this.credits -= amount;
      return true;
    }

    return false;
  }

  private refillCredits(): void {
    const now = Date.now();
    const timeSinceRefill = now - this.lastRefill;
    const refillCycles = Math.floor(timeSinceRefill / this.config.creditRefillInterval);

    if (refillCycles > 0) {
      const creditsToAdd = refillCycles * this.config.creditRefillRate;
      this.credits = Math.min(this.config.maxCredits, this.credits + creditsToAdd);
      this.lastRefill = now;
    }
  }

  getStats(): {
    current: number;
    max: number;
    percentage: number;
    isLow: boolean;
    nextRefillTime: number
  } {
    this.refillCredits();

    return {
      current: this.credits,
      max: this.config.maxCredits,
      percentage: (this.credits / this.config.maxCredits) * 100,
      isLow: this.credits <= this.config.lowCreditThreshold,
      nextRefillTime: this.lastRefill + this.config.creditRefillInterval
    };
  }

  hasEmergencyReserve(): boolean {
    return this.credits >= this.config.emergencyReserve;
  }
}

// API Health Monitor
class ApiHealthMonitor {
  private healthStatus: ApiHealthStatus = 'unknown';
  private lastHealthCheck = 0;
  private responseTimeHistory: number[] = [];
  private errorHistory: { timestamp: number; error: string }[] = [];

  constructor(
    private config: ApiServiceConfig,
    private makeRequest: (url: string, options?: any) => Promise<ApiResponse>
  ) { }

  async checkHealth(): Promise<ApiHealthStatus> {
    if (!this.config.healthCheckEndpoint) {
      return this.healthStatus;
    }

    const now = Date.now();
    if (now - this.lastHealthCheck < this.config.healthCheckInterval) {
      return this.healthStatus;
    }

    try {
      const startTime = Date.now();
      const response = await this.makeRequest(this.config.healthCheckEndpoint, {
        timeout: this.config.timeout.connectionTimeout
      });
      const responseTime = Date.now() - startTime;

      this.responseTimeHistory.push(responseTime);
      this.responseTimeHistory = this.responseTimeHistory.slice(-10); // Keep last 10

      if (response.success) {
        this.healthStatus = this.calculateHealthStatus(responseTime);
      } else {
        this.healthStatus = 'unhealthy';
        this.errorHistory.push({ timestamp: now, error: response.error || 'Unknown error' });
      }
    } catch (error) {
      this.healthStatus = 'unhealthy';
      this.errorHistory.push({
        timestamp: now,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    this.lastHealthCheck = now;
    this.cleanOldErrors();

    return this.healthStatus;
  }

  private calculateHealthStatus(responseTime: number): ApiHealthStatus {
    const avgResponseTime = this.responseTimeHistory.reduce((a, b) => a + b, 0) / this.responseTimeHistory.length;

    if (avgResponseTime < 1000) {
      return 'healthy';
    } else if (avgResponseTime < 3000) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  private cleanOldErrors(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.errorHistory = this.errorHistory.filter(error => error.timestamp > oneHourAgo);
  }

  getHealthStats(): {
    status: ApiHealthStatus;
    averageResponseTime: number;
    recentErrors: number;
    lastCheckTime: number;
  } {
    const avgResponseTime = this.responseTimeHistory.length > 0 ?
      this.responseTimeHistory.reduce((a, b) => a + b, 0) / this.responseTimeHistory.length : 0;

    return {
      status: this.healthStatus,
      averageResponseTime: avgResponseTime,
      recentErrors: this.errorHistory.length,
      lastCheckTime: this.lastHealthCheck
    };
  }
}

// Main API Integration Service
export class ApiIntegrationService {
  private services = new Map<string, {
    config: ApiServiceConfig;
    rateLimiter: RateLimiter;
    circuitBreaker: CircuitBreaker;
    creditManager?: CreditManager;
    healthMonitor: ApiHealthMonitor;
  }>();

  private requestQueue: Array<{
    context: RequestContext;
    resolve: (value: ApiResponse) => void;
    reject: (error: Error) => void;
    operation: () => Promise<ApiResponse>;
    queuedAt: number;
  }> = [];

  private processing = false;

  constructor() {
    // Start queue processor
    this.processQueue();

    // Start health monitoring
    setInterval(() => this.monitorAllServices(), 30000); // Every 30 seconds
  }

  /**
   * Register an API service with its configuration
   */
  registerService(config: ApiServiceConfig): void {
    const rateLimiter = new RateLimiter(config.rateLimit);
    const circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    const creditManager = config.credits ? new CreditManager(config.credits) : undefined;

    const makeRequest = async (url: string, options?: any): Promise<ApiResponse> => {
      return this.makeHttpRequest(url, options);
    };

    const healthMonitor = new ApiHealthMonitor(config, makeRequest);

    this.services.set(config.name, {
      config,
      rateLimiter,
      circuitBreaker,
      creditManager,
      healthMonitor
    });

    console.log(`Registered API service: ${config.name}`);
  }

  /**
   * Make an API request with full optimization features
   */
  async makeRequest<T = any>(
    context: RequestContext,
    operation: () => Promise<ApiResponse<T>>
  ): Promise<ApiResponse<T>> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        context,
        resolve: resolve as (value: ApiResponse) => void,
        reject,
        operation: operation as () => Promise<ApiResponse>,
        queuedAt: Date.now()
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the request queue with priority handling
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      // Sort queue by priority and queue time
      this.requestQueue.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.context.priority] - priorityOrder[a.context.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.queuedAt - b.queuedAt; // FIFO for same priority
      });

      while (this.requestQueue.length > 0) {
        const request = this.requestQueue.shift()!;

        try {
          const response = await this.executeRequest(request);
          request.resolve(response);
        } catch (error) {
          request.reject(error as Error);
        }

        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Execute a single request with all optimizations
   */
  private async executeRequest(request: {
    context: RequestContext;
    operation: () => Promise<ApiResponse>;
  }, retryCount: number = 0): Promise<ApiResponse> {
    const service = this.services.get(request.context.serviceId);
    if (!service) {
      throw new Error(`Service not found: ${request.context.serviceId}`);
    }

    const startTime = Date.now();

    try {
      // Check rate limiting
      const rateLimitCheck = await service.rateLimiter.checkLimit();
      if (!rateLimitCheck.allowed) {
        if (rateLimitCheck.retryAfter) {
          await this.exponentialBackoff(rateLimitCheck.retryAfter);
          return this.executeRequest(request, retryCount); // Retry after backoff
        }
        throw new Error('Rate limit exceeded');
      }

      // Check credit availability
      if (service.creditManager && request.context.creditsRequired) {
        const creditCheck = await service.creditManager.checkCredits(request.context.creditsRequired);
        if (!creditCheck.available) {
          if (creditCheck.refillTime) {
            const waitTime = creditCheck.refillTime - Date.now();
            if (waitTime > 0 && waitTime < 60000) { // Wait up to 1 minute
              await new Promise(resolve => setTimeout(resolve, waitTime));
              return this.executeRequest(request, retryCount); // Retry after credits refill
            }
          }
          throw new Error('Insufficient credits');
        }
      }

      // Execute through circuit breaker
      const response = await service.circuitBreaker.execute(async () => {
        const result = await this.executeWithTimeout(request.operation, service.config.timeout);

        // Consume credits if successful
        if (service.creditManager && request.context.creditsRequired && result.success) {
          service.creditManager.consumeCredits(request.context.creditsRequired);
        }

        return result;
      });

      response.responseTime = Date.now() - startTime;
      return response;

    } catch (error) {
      const errorResponse: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime
      };

      // Handle retryable errors with exponential backoff
      // Check if we haven't exceeded retry limit
      const maxRetries = service.config.timeout.maxRetries;

      if (request.context.retryable && this.isRetryableError(error) && retryCount < maxRetries) {
        const backoffTime = this.calculateBackoffTime(service.config.rateLimit, retryCount + 1);
        console.warn(`Request failed for ${request.context.serviceId}, retrying (attempt ${retryCount + 1}/${maxRetries}) in ${backoffTime}ms... Error: ${errorResponse.error}`);
        await this.exponentialBackoff(backoffTime);
        return this.executeRequest(request, retryCount + 1); // Retry with incremented count
      }

      return errorResponse;
    }
  }

  /**
   * Execute operation with timeout handling
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutConfig: TimeoutConfig
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Request timeout after ${timeoutConfig.requestTimeout}ms`));
      }, timeoutConfig.requestTimeout);

      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Exponential backoff implementation
   */
  private async exponentialBackoff(baseDelay: number): Promise<void> {
    const jitter = Math.random() * 0.1; // Add 10% jitter
    const delay = baseDelay * (1 + jitter);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Calculate backoff time based on rate limit configuration
   */
  private calculateBackoffTime(rateLimitConfig: RateLimitConfig, retryCount: number): number {
    const baseDelay = 1000;
    const exponentialDelay = baseDelay * Math.pow(rateLimitConfig.backoffMultiplier, retryCount);
    return Math.min(
      exponentialDelay,
      rateLimitConfig.maxBackoffMs
    );
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('timeout') ||
        message.includes('network') ||
        message.includes('rate limit') ||
        message.includes('503') ||
        message.includes('502') ||
        message.includes('504');
    }
    return false;
  }

  /**
   * Make HTTP request (to be implemented based on your HTTP client)
   */
  private async makeHttpRequest(url: string, options?: any): Promise<ApiResponse> {
    // This is a placeholder - implement with your preferred HTTP client
    // (fetch, axios, etc.)
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(options?.timeout || 10000)
      });

      return {
        success: response.ok,
        data: response.ok ? await response.json() : undefined,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        statusCode: response.status,
        responseTime: 0 // Will be set by caller
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: 0
      };
    }
  }

  /**
   * Monitor all registered services
   */
  private async monitorAllServices(): Promise<void> {
    for (const [serviceName, service] of this.services) {
      try {
        await service.healthMonitor.checkHealth();
      } catch (error) {
        console.warn(`Health check failed for service ${serviceName}:`, error);
      }
    }
  }

  /**
   * Get comprehensive service statistics
   */
  getServiceStats(serviceName: string): {
    rateLimit: ReturnType<RateLimiter['getStats']>;
    circuitBreaker: ReturnType<CircuitBreaker['getStats']>;
    credits?: ReturnType<CreditManager['getStats']>;
    health: ReturnType<ApiHealthMonitor['getHealthStats']>;
  } | null {
    const service = this.services.get(serviceName);
    if (!service) return null;

    return {
      rateLimit: service.rateLimiter.getStats(),
      circuitBreaker: service.circuitBreaker.getStats(),
      credits: service.creditManager?.getStats(),
      health: service.healthMonitor.getHealthStats()
    };
  }

  /**
   * Get all services status for monitoring dashboard
   */
  getAllServicesStatus(): Record<string, {
    name: string;
    priority: string;
    health: ApiHealthStatus;
    rateLimitUsage: number;
    circuitBreakerState: CircuitBreakerState;
    creditsRemaining?: number;
    queueLength: number;
  }> {
    const status: Record<string, any> = {};

    for (const [serviceName, service] of this.services) {
      const rateLimitStats = service.rateLimiter.getStats();
      const circuitBreakerStats = service.circuitBreaker.getStats();
      const creditStats = service.creditManager?.getStats();
      const healthStats = service.healthMonitor.getHealthStats();

      status[serviceName] = {
        name: serviceName,
        priority: service.config.priority,
        health: healthStats.status,
        rateLimitUsage: (rateLimitStats.currentRequests / rateLimitStats.maxRequests) * 100,
        circuitBreakerState: circuitBreakerStats.state,
        creditsRemaining: creditStats?.current,
        queueLength: this.requestQueue.filter(r => r.context.serviceId === serviceName).length
      };
    }

    return status;
  }

  /**
   * Reset circuit breaker for a service (emergency recovery)
   */
  resetCircuitBreaker(serviceName: string): boolean {
    const service = this.services.get(serviceName);
    if (!service) return false;

    service.circuitBreaker.reset();
    console.log(`Circuit breaker reset for service: ${serviceName}`);
    return true;
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    totalQueued: number;
    byPriority: Record<string, number>;
    averageWaitTime: number;
    oldestRequest: number;
  } {
    const now = Date.now();
    const byPriority = { high: 0, medium: 0, low: 0 };
    let totalWaitTime = 0;
    let oldestRequest = 0;

    for (const request of this.requestQueue) {
      byPriority[request.context.priority]++;
      const waitTime = now - request.queuedAt;
      totalWaitTime += waitTime;
      if (waitTime > oldestRequest) {
        oldestRequest = waitTime;
      }
    }

    return {
      totalQueued: this.requestQueue.length,
      byPriority,
      averageWaitTime: this.requestQueue.length > 0 ? totalWaitTime / this.requestQueue.length : 0,
      oldestRequest
    };
  }
}

// Default service configurations
export const DEFAULT_CONFIGS: Record<string, ApiServiceConfig> = {
  openrouter: {
    name: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    priority: 'high',
    rateLimit: {
      maxRequests: 100,
      windowMs: 60000, // 1 minute
      burstLimit: 20,
      backoffMultiplier: 1.5,
      maxBackoffMs: 15000
    },
    circuitBreaker: {
      failureThreshold: 3,
      recoveryTimeout: 30000,
      monitoringWindow: 180000, // 3 minutes
      halfOpenMaxCalls: 2,
      successThreshold: 2
    },
    timeout: {
      requestTimeout: 45000,
      connectionTimeout: 10000,
      retryTimeout: 3000,
      maxRetries: 2
    },
    healthCheckInterval: 180000 // 3 minutes
  },

  firecrawl: {
    name: 'firecrawl',
    baseUrl: 'https://api.firecrawl.dev',
    priority: 'high',
    rateLimit: {
      maxRequests: 10,
      windowMs: 60000, // 1 minute
      burstLimit: 3,
      backoffMultiplier: 2,
      maxBackoffMs: 30000
    },
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      monitoringWindow: 300000, // 5 minutes
      halfOpenMaxCalls: 3,
      successThreshold: 2
    },
    timeout: {
      requestTimeout: 30000,
      connectionTimeout: 10000,
      retryTimeout: 5000,
      maxRetries: 3
    },
    credits: {
      maxCredits: 100,
      creditRefillRate: 10,
      creditRefillInterval: 60000, // 1 minute
      lowCreditThreshold: 20,
      emergencyReserve: 10
    },
    healthCheckInterval: 300000 // 5 minutes
  },

  gemini: {
    name: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    priority: 'high',
    rateLimit: {
      maxRequests: 15, // Reduced from 60 to avoid 429s
      windowMs: 60000, // 1 minute
      burstLimit: 2,   // Reduced from 10 to strictly throttle bursts
      backoffMultiplier: 2, // Increased backoff multiplier
      maxBackoffMs: 60000 // Increased max backoff to 1 minute
    },
    circuitBreaker: {
      failureThreshold: 3,
      recoveryTimeout: 30000,
      monitoringWindow: 180000, // 3 minutes
      halfOpenMaxCalls: 1, // Reduced to be more cautious during recovery
      successThreshold: 2
    },
    timeout: {
      requestTimeout: 60000,
      connectionTimeout: 10000,
      retryTimeout: 3000,
      maxRetries: 3 // Allow one more retry with proper backoff
    },
    healthCheckInterval: 180000 // 3 minutes
  },

  nix: {
    name: 'nix',
    baseUrl: 'https://nix.ru',
    priority: 'medium',
    rateLimit: {
      maxRequests: 30,
      windowMs: 60000, // 1 minute
      burstLimit: 5,
      backoffMultiplier: 2,
      maxBackoffMs: 60000
    },
    circuitBreaker: {
      failureThreshold: 4,
      recoveryTimeout: 120000,
      monitoringWindow: 600000, // 10 minutes
      halfOpenMaxCalls: 2,
      successThreshold: 3
    },
    timeout: {
      requestTimeout: 20000,
      connectionTimeout: 8000,
      retryTimeout: 4000,
      maxRetries: 3
    },
    healthCheckEndpoint: 'https://nix.ru',
    healthCheckInterval: 600000 // 10 minutes
  }
};

// Global instance
export const apiIntegrationService = new ApiIntegrationService();

// Initialize default services
Object.values(DEFAULT_CONFIGS).forEach(config => {
  apiIntegrationService.registerService(config);
});

/**
 * Helper function to create error details for API integration failures
 */
export function createApiIntegrationError(
  serviceName: string,
  operation: string,
  error: any,
  step: ProcessingStep
): ErrorDetail {
  let reason: FailureReason = 'external_service_timeout';

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('rate limit')) {
      reason = 'api_rate_limit_exceeded';
    } else if (message.includes('timeout')) {
      reason = 'external_service_timeout';
    } else if (message.includes('network') || message.includes('connection')) {
      reason = 'network_connectivity_error';
    } else if (message.includes('auth')) {
      reason = 'authentication_failed';
    }
  }

  return createErrorDetail(
    reason,
    `API integration error in ${serviceName}.${operation}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    {
      serviceName,
      operation,
      errorType: error?.constructor?.name,
      timestamp: new Date().toISOString()
    },
    step,
    error instanceof Error ? error.stack : undefined
  );
}