import { FailureReason } from './error';

export interface RetryConfig {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    retryableErrors: FailureReason[];
}

export interface RussianSourceConfig {
    name: string;
    baseUrl: string;
    priority: number;
    isOfficial: boolean;
    searchPatterns: string[];
}

export interface RuMarketFilterConfig {
    minSourcesForVerification: number;
    russianSources: RussianSourceConfig[];
    officialDistributorBonus: number;
    confidenceThreshold: number;
}
