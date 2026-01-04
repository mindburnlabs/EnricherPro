/**
 * useEdgeAI - React hook for Edge AI functionality
 *
 * Provides client-side embedding and similarity scoring
 * with automatic initialization and status tracking.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  EdgeAIService,
  InferenceBackend,
  EmbeddingResult,
} from '../services/edge/EdgeAIService.js';

export interface UseEdgeAIResult {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  backend: InferenceBackend | null;
  embed: (text: string) => Promise<EmbeddingResult | null>;
  similarity: (text1: string, text2: string) => Promise<number>;
  prefilter: (
    query: string,
    results: Array<{ id: string; title: string; snippet?: string }>,
  ) => Promise<string[]>;
  cacheStats: { size: number; entries: number };
}

export function useEdgeAI(autoInit = true): UseEdgeAIResult {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backend, setBackend] = useState<InferenceBackend | null>(null);
  const [cacheStats, setCacheStats] = useState({ size: 0, entries: 0 });

  // Initialize on mount if autoInit is true
  useEffect(() => {
    if (autoInit && !isReady && !isLoading) {
      setIsLoading(true);
      EdgeAIService.initialize()
        .then((success) => {
          setIsReady(success);
          setBackend(EdgeAIService.getBackend());
          if (!success) {
            setError('Failed to initialize Edge AI');
          }
        })
        .catch((e) => {
          setError(e.message);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [autoInit, isReady, isLoading]);

  // Update cache stats periodically
  useEffect(() => {
    if (isReady) {
      const interval = setInterval(() => {
        setCacheStats(EdgeAIService.getCacheStats());
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isReady]);

  const embed = useCallback(
    async (text: string): Promise<EmbeddingResult | null> => {
      if (!isReady) return null;
      try {
        return await EdgeAIService.embed(text);
      } catch (e: any) {
        console.error('[useEdgeAI] Embed failed:', e);
        return null;
      }
    },
    [isReady],
  );

  const similarity = useCallback(
    async (text1: string, text2: string): Promise<number> => {
      if (!isReady) return 0;
      try {
        const result = await EdgeAIService.similarity(text1, text2);
        return result.score;
      } catch (e: any) {
        console.error('[useEdgeAI] Similarity failed:', e);
        return 0;
      }
    },
    [isReady],
  );

  const prefilter = useCallback(
    async (
      query: string,
      results: Array<{ id: string; title: string; snippet?: string }>,
    ): Promise<string[]> => {
      if (!isReady) {
        // Return all IDs if not ready
        return results.map((r) => r.id);
      }
      try {
        return await EdgeAIService.prefilterSearchResults(query, results);
      } catch (e: any) {
        console.error('[useEdgeAI] Prefilter failed:', e);
        return results.map((r) => r.id);
      }
    },
    [isReady],
  );

  return {
    isReady,
    isLoading,
    error,
    backend,
    embed,
    similarity,
    prefilter,
    cacheStats,
  };
}
