/* eslint-disable */
/**
 * AUTO-GENERATED FILE.
 * Source: src/config/model_selectors.ts
 * Regenerate: pnpm gen:models
 */
import { ModelProfile } from './model_selectors.js';

export const MODEL_CONFIGS = {
  "fast_cheap": {
    "candidates": [
      "google/gemini-2.5-flash-lite-preview-09-2025",
      "anthropic/claude-haiku-4.5",
      "openai/gpt-4o-mini",
      "qwen/qwen3-coder:free",
      "openrouter/auto"
    ],
    "description": "High speed, low cost parsing/normalization."
  },
  "reasoning": {
    "candidates": [
      "openai/o1",
      "anthropic/claude-sonnet-4.5",
      "deepseek/deepseek-r1",
      "openrouter/auto"
    ],
    "description": "Conflict resolution, truth arbitration, deep reasoning."
  },
  "best": {
    "candidates": [
      "anthropic/claude-sonnet-4.5",
      "openai/gpt-4o",
      "google/gemini-2.5-flash",
      "openrouter/auto"
    ],
    "description": "Highest general capability fallback."
  },
  "extraction": {
    "candidates": [
      "openai/gpt-4.1-mini",
      "openai/gpt-4o-mini",
      "anthropic/claude-haiku-4.5",
      "google/gemini-2.5-flash",
      "openrouter/auto"
    ],
    "description": "Structured JSON extraction from noisy supplier titles."
  },
  "planning": {
    "candidates": [
      "anthropic/claude-sonnet-4.5",
      "google/gemini-2.5-flash",
      "openai/gpt-4.1-mini",
      "openrouter/auto"
    ],
    "description": "Search planning / decomposition / next-action decisions."
  }
} as const;

export const MODEL_TIERS = {
  A: ModelProfile.FAST_CHEAP,
  B: ModelProfile.PLANNING,
  C: ModelProfile.REASONING
} as const;

export const DEFAULT_MODEL = 'openrouter/auto';
