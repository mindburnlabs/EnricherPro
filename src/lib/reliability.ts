
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
        onRetry?: (attempt: number, error: any) => void;
        shouldRetry?: (error: any) => boolean;
    } = {}
): Promise<T> {
    const {
        maxRetries = 3,
        baseDelayMs = 1000, // 1s
        maxDelayMs = 10000, // 10s
        onRetry,
        shouldRetry
    } = options;

    let attempt = 0;

    while (true) {
        try {
            return await fn();
        } catch (error) {
            attempt++;

            if (attempt > maxRetries) {
                throw error;
            }

            if (shouldRetry && !shouldRetry(error)) {
                throw error;
            }

            // Exponential Backoff with Jitter
            // delay = base * 2^(attempt-1)
            const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
            // Cap at maxDelay
            const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
            // Add slight jitter (±10%) to prevent thundering herd
            const jitter = cappedDelay * 0.1 * (Math.random() * 2 - 1);
            const finalDelay = Math.max(0, cappedDelay + jitter);

            if (onRetry) {
                onRetry(attempt, error);
            }

            console.warn(`[Retry] Attempt ${attempt}/${maxRetries} failed. Retrying in ${Math.round(finalDelay)}ms...`, (error as Error).message);

            await new Promise(resolve => setTimeout(resolve, finalDelay));
        }
    }
}
