
/**
 * Simple In-Memory Rate Limiter
 * 
 * Note: In Vercel Serverless, this memory is ephemeral and per-lambda instance. 
 * This is effectively a "per-instance concurrency limit" + "burst protection".
 * For true global rate limiting, we need Redis (Upstash).
 * 
 * This is a placeholder for Phase 1.
 */

type TokenBucket = {
    tokens: number;
    lastRefill: number;
};

export class RateLimiter {
    // 5 Requests per minute per IP
    private static capacity = 5;
    private static refillRate = 60 * 1000 / 5; // Refill every 12s

    private static buckets = new Map<string, TokenBucket>();

    /**
     * Check if IP is allowed. Returns true if allowed, false if limited.
     */
    static check(ip: string): boolean {
        const now = Date.now();
        const bucket = this.buckets.get(ip) || { tokens: this.capacity, lastRefill: now };

        // Refill tokens based on time passed
        const elapsed = now - bucket.lastRefill;
        const tokensToAdd = Math.floor(elapsed / this.refillRate);

        if (tokensToAdd > 0) {
            bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
            bucket.lastRefill = now;
        }

        if (bucket.tokens > 0) {
            bucket.tokens--;
            this.buckets.set(ip, bucket);
            return true;
        }

        // Update timestamp even if failed to ensure we don't over-refill if check is called frequently? 
        // No, standard token bucket doesn't need to updates refill time on fail usually, 
        // but let's keep it simple.
        this.buckets.set(ip, bucket);
        return false;
    }
}
