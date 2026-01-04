import { logger } from './logger.js';

interface CircuitBreakerOptions {
  failureThreshold: number; // Number of failures before opening
  resetTimeout: number; // Time in ms to wait before checking half-open
}

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private nextAttempt = Date.now();
  private options: CircuitBreakerOptions;
  private name: string;

  constructor(
    name: string,
    options: CircuitBreakerOptions = { failureThreshold: 5, resetTimeout: 30000 },
  ) {
    this.name = name;
    this.options = options;
  }

  async execute<T>(action: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        this.state = 'HALF_OPEN';
        logger.warn(`Circuit ${this.name} is HALF_OPEN. Testing...`);
      } else {
        const errorMsg = `Circuit ${this.name} is OPEN. Failing fast.`;
        logger.warn(errorMsg);
        throw new Error(errorMsg);
      }
    }

    try {
      const result = await action();
      this.success();
      return result;
    } catch (error) {
      this.failure(error);
      throw error;
    }
  }

  private success() {
    if (this.state !== 'CLOSED') {
      logger.info(`Circuit ${this.name} closed (recovered).`); // Assuming close means recovered
    }
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private failure(error: any) {
    this.failureCount++;
    logger.error(`Circuit ${this.name} recorded failure #${this.failureCount}`, error);

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.options.resetTimeout;
      logger.error(
        `Circuit ${this.name} opened! Halting execution for ${this.options.resetTimeout}ms.`,
      );
    }
  }
}
