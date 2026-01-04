
import { logger } from './logger.js';

interface CacheEntry<T> {
    value: T;
    expiry: number;
}

export class SimpleCache {
    private static instance: SimpleCache;
    private cache: Map<string, CacheEntry<any>> = new Map();
    private defaultTTL = 1000 * 60 * 60; // 1 hour default

    private constructor() { }

    static getInstance(): SimpleCache {
        if (!SimpleCache.instance) {
            SimpleCache.instance = new SimpleCache();
        }
        return SimpleCache.instance;
    }

    set<T>(key: string, value: T, ttlMs: number = this.defaultTTL): void {
        this.cache.set(key, {
            value,
            expiry: Date.now() + ttlMs
        });
        // logger.debug(`Cache SET: ${key.substring(0, 20)}...`);
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }

        logger.debug(`Cache HIT: ${key.substring(0, 20)}...`);
        return entry.value as T;
    }

    generateKey(prefix: string, data: any): string {
        try {
             return `${prefix}_${JSON.stringify(data)}`;
        } catch {
            return `${prefix}_${Date.now()}`;
        }
    }
}

export const cache = SimpleCache.getInstance();
