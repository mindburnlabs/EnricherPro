/**
 * EdgeAIService - Client-side AI inference using WebGPU/ONNX
 *
 * Provides browser-based embedding generation and similarity scoring
 * for pre-filtering search results before sending to backend.
 *
 * Features:
 * - WebGPU detection with CPU/WASM fallback
 * - Lightweight embedding model (all-MiniLM-L6-v2 quantized)
 * - Cosine similarity for relevance scoring
 * - Caching of embeddings for performance
 *
 * SOTA v4.3: Enables privacy-first, low-latency client-side filtering
 */

// Backend selection types
export type InferenceBackend = 'webgpu' | 'wasm' | 'cpu';

export interface EdgeAIConfig {
  modelPath?: string; // Path to ONNX model
  backend?: InferenceBackend; // Force specific backend
  cacheEnabled?: boolean;
}

export interface EmbeddingResult {
  embedding: Float32Array;
  latencyMs: number;
  backend: InferenceBackend;
}

export interface SimilarityResult {
  score: number; // 0-1 cosine similarity
  queryEmbedding: Float32Array;
  docEmbedding: Float32Array;
}

// Simple cache for embeddings
const embeddingCache = new Map<string, Float32Array>();

/**
 * EdgeAIService - Main service class for browser-side AI
 */
export class EdgeAIService {
  private static ort: any = null;
  private static session: any = null;
  private static tokenizer: any = null;
  private static activeBackend: InferenceBackend = 'cpu';
  private static isInitialized = false;

  // Default model: Quantized MiniLM (small, fast, good quality)
  private static readonly DEFAULT_MODEL_URL =
    'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx';
  private static readonly TOKEN_MAX_LENGTH = 256;

  /**
   * Detect best available backend
   */
  static async detectBackend(): Promise<InferenceBackend> {
    // Check WebGPU support
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      try {
        const adapter = await (navigator as any).gpu.requestAdapter();
        if (adapter) {
          console.log('[EdgeAI] WebGPU available');
          return 'webgpu';
        }
      } catch (e) {
        console.warn('[EdgeAI] WebGPU detection failed:', e);
      }
    }

    // Fallback to WASM (good performance, wide support)
    console.log('[EdgeAI] Using WASM backend');
    return 'wasm';
  }

  /**
   * Initialize the ONNX runtime and load model
   */
  static async initialize(config: EdgeAIConfig = {}): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Dynamically import ONNX Runtime Web
      const ort = await import('onnxruntime-web');
      this.ort = ort;

      // Detect or use configured backend
      this.activeBackend = config.backend || (await this.detectBackend());

      // Configure execution providers
      const executionProviders: string[] = [];
      if (this.activeBackend === 'webgpu') {
        executionProviders.push('webgpu');
      }
      executionProviders.push('wasm'); // Fallback

      // Load model
      const modelUrl = config.modelPath || this.DEFAULT_MODEL_URL;
      console.log(`[EdgeAI] Loading model from ${modelUrl} using ${this.activeBackend}`);

      this.session = await ort.InferenceSession.create(modelUrl, {
        executionProviders,
        graphOptimizationLevel: 'all',
      });

      this.isInitialized = true;
      console.log('[EdgeAI] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[EdgeAI] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Check if service is ready
   */
  static isReady(): boolean {
    return this.isInitialized && this.session !== null;
  }

  /**
   * Get current backend
   */
  static getBackend(): InferenceBackend {
    return this.activeBackend;
  }

  /**
   * Simple tokenizer (for demo - production should use proper tokenizer)
   * In production, use @xenova/transformers or similar
   */
  private static simpleTokenize(text: string): {
    input_ids: BigInt64Array;
    attention_mask: BigInt64Array;
  } {
    // This is a simplified placeholder
    // Real implementation should use proper BPE tokenizer
    const words = text.toLowerCase().split(/\s+/).slice(0, this.TOKEN_MAX_LENGTH);
    const inputIds = new BigInt64Array(this.TOKEN_MAX_LENGTH).fill(0n);
    const attentionMask = new BigInt64Array(this.TOKEN_MAX_LENGTH).fill(0n);

    // Simple word-to-id mapping (placeholder)
    words.forEach((word, i) => {
      if (i < this.TOKEN_MAX_LENGTH) {
        // Simple hash for word ID (placeholder)
        const hash = word.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        inputIds[i] = BigInt(hash % 30000);
        attentionMask[i] = 1n;
      }
    });

    return { input_ids: inputIds, attention_mask: attentionMask };
  }

  /**
   * Generate embedding for text
   */
  static async embed(text: string, useCache = true): Promise<EmbeddingResult> {
    if (!this.isReady()) {
      await this.initialize();
    }

    // Check cache
    const cacheKey = text.slice(0, 100);
    if (useCache && embeddingCache.has(cacheKey)) {
      return {
        embedding: embeddingCache.get(cacheKey)!,
        latencyMs: 0,
        backend: this.activeBackend,
      };
    }

    const startTime = performance.now();

    try {
      // Tokenize
      const { input_ids, attention_mask } = this.simpleTokenize(text);

      // Create tensors
      const inputIdsTensor = new this.ort.Tensor('int64', input_ids, [1, this.TOKEN_MAX_LENGTH]);
      const attentionMaskTensor = new this.ort.Tensor('int64', attention_mask, [
        1,
        this.TOKEN_MAX_LENGTH,
      ]);

      // Run inference
      const feeds = {
        input_ids: inputIdsTensor,
        attention_mask: attentionMaskTensor,
      };

      const results = await this.session.run(feeds);

      // Extract embedding (mean pooling)
      const output =
        results['last_hidden_state'] || results['sentence_embedding'] || Object.values(results)[0];
      const embedding = new Float32Array(output.data as Float32Array);

      // Mean pooling if needed
      const embeddingSize = 384; // MiniLM embedding size
      const pooledEmbedding = new Float32Array(embeddingSize);
      const tokenCount = attention_mask.filter((x) => x === 1n).length;

      for (let i = 0; i < embeddingSize; i++) {
        let sum = 0;
        for (let j = 0; j < tokenCount; j++) {
          sum += embedding[j * embeddingSize + i] || 0;
        }
        pooledEmbedding[i] = sum / tokenCount;
      }

      // Normalize
      const norm = Math.sqrt(pooledEmbedding.reduce((acc, v) => acc + v * v, 0));
      for (let i = 0; i < embeddingSize; i++) {
        pooledEmbedding[i] /= norm || 1;
      }

      // Cache
      if (useCache) {
        embeddingCache.set(cacheKey, pooledEmbedding);
      }

      const latencyMs = performance.now() - startTime;

      return {
        embedding: pooledEmbedding,
        latencyMs,
        backend: this.activeBackend,
      };
    } catch (error) {
      console.error('[EdgeAI] Embedding failed:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two texts
   */
  static async similarity(text1: string, text2: string): Promise<SimilarityResult> {
    const [result1, result2] = await Promise.all([this.embed(text1), this.embed(text2)]);

    // Cosine similarity (vectors are already normalized)
    let dotProduct = 0;
    for (let i = 0; i < result1.embedding.length; i++) {
      dotProduct += result1.embedding[i] * result2.embedding[i];
    }

    return {
      score: Math.max(0, Math.min(1, dotProduct)),
      queryEmbedding: result1.embedding,
      docEmbedding: result2.embedding,
    };
  }

  /**
   * Score and rank documents by relevance to query
   */
  static async rankByRelevance(
    query: string,
    documents: Array<{ id: string; text: string }>,
    threshold = 0.3,
  ): Promise<Array<{ id: string; score: number; text: string }>> {
    const queryEmbedding = await this.embed(query);

    const scored = await Promise.all(
      documents.map(async (doc) => {
        const docEmbedding = await this.embed(doc.text);

        // Cosine similarity
        let dotProduct = 0;
        for (let i = 0; i < queryEmbedding.embedding.length; i++) {
          dotProduct += queryEmbedding.embedding[i] * docEmbedding.embedding[i];
        }

        return {
          id: doc.id,
          text: doc.text,
          score: Math.max(0, Math.min(1, dotProduct)),
        };
      }),
    );

    // Filter and sort by score
    return scored.filter((doc) => doc.score >= threshold).sort((a, b) => b.score - a.score);
  }

  /**
   * Pre-filter search results for relevance
   * Returns IDs of relevant results
   */
  static async prefilterSearchResults(
    query: string,
    results: Array<{ id: string; title: string; snippet?: string }>,
    topK = 10,
  ): Promise<string[]> {
    if (!this.isReady()) {
      // Return all if not initialized
      return results.slice(0, topK).map((r) => r.id);
    }

    const documents = results.map((r) => ({
      id: r.id,
      text: `${r.title} ${r.snippet || ''}`.trim(),
    }));

    const ranked = await this.rankByRelevance(query, documents, 0.2);

    return ranked.slice(0, topK).map((r) => r.id);
  }

  /**
   * Clear embedding cache
   */
  static clearCache(): void {
    embeddingCache.clear();
  }

  /**
   * Get cache stats
   */
  static getCacheStats(): { size: number; entries: number } {
    let totalSize = 0;
    embeddingCache.forEach((v) => (totalSize += v.byteLength));
    return {
      size: totalSize,
      entries: embeddingCache.size,
    };
  }
}
