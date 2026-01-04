/**
 * Executes a promise-returning function with exponential backoff retries.
 *
 * @param fn The async function to execute
 * @param options Configuration for retries
 * @returns The result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: any, delayMs: number) => void;
    shouldRetry?: (error: any) => boolean;
  } = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000, // 1s
    maxDelayMs = 10000, // 10s
    onRetry,
    shouldRetry,
  } = options;

  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;

      if (attempt > maxRetries) {
        throw error;
      }

      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }

      // SMART RATE LIMITING (Firecrawl / General)
      let finalDelay = 0;
      const status = error.status || error.statusCode;

      if (status === 429) {
        // 1. Try to parse "resets at <DATE>" from Firecrawl error message
        // Example: "... resets at Fri Jan 02 2026 11:14:12 GMT+0000 ..."
        const resetMatch = error.message?.match(/resets at (.*?)(\.|$)/);
        if (resetMatch && resetMatch[1]) {
          const resetDate = new Date(resetMatch[1]);
          if (!isNaN(resetDate.getTime())) {
            const now = new Date();
            const timeToWait = resetDate.getTime() - now.getTime();
            if (timeToWait > 0) {
              // Add small buffer (1s) to be safe
              finalDelay = timeToWait + 1000;
              console.warn(
                `[Smart Rate Limit] Hit 429. Pause until ${resetDate.toISOString()} (${Math.round(finalDelay / 1000)}s)...`,
              );
            }
          }
        }

        // 2. If no date, try generic "retry after X seconds"
        if (finalDelay === 0) {
          const retryAfterMatch = error.message?.match(/retry after (\d+)s/i);
          if (retryAfterMatch && retryAfterMatch[1]) {
            finalDelay = parseInt(retryAfterMatch[1], 10) * 1000 + 1000;
            console.warn(
              `[Smart Rate Limit] Hit 429. Retry after ${retryAfterMatch[1]}s detected.`,
            );
          }
        }

        // 3. Last Desperation: Parse headers if available (standard HTTP)
        if (finalDelay === 0 && error.response?.headers) {
          const retryAfter =
            error.response.headers.get('retry-after') || error.response.headers['retry-after'];
          if (retryAfter) {
            if (/^\d+$/.test(retryAfter)) {
              finalDelay = parseInt(retryAfter, 10) * 1000 + 1000;
            } else {
              const date = new Date(retryAfter);
              if (!isNaN(date.getTime())) {
                finalDelay = date.getTime() - Date.now() + 1000;
              }
            }
            if (finalDelay > 0)
              console.warn(
                `[Smart Rate Limit] Hit 429. Retry-After header: ${Math.round(finalDelay / 1000)}s`,
              );
          }
        }
      }

      // Fallback to Exponential if no smart delay found
      if (finalDelay === 0) {
        const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
        const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
        const jitter = cappedDelay * 0.1 * (Math.random() * 2 - 1);
        finalDelay = Math.max(0, cappedDelay + jitter);
      }

      if (onRetry) {
        onRetry(attempt, error, finalDelay);
      }

      // If it's a standard retry, use debug log. If it was a 429, we already warned.
      if (status !== 429) {
        console.warn(
          `[Retry] Attempt ${attempt}/${maxRetries} failed. Retrying in ${Math.round(finalDelay)}ms...`,
          error.message,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, finalDelay));
    }
  }
}
