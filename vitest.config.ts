import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { loadEnv } from 'vite';

export default defineConfig(({ mode = 'test' }) => {
  const env = loadEnv(mode, '.', '');

  return {
    test: {
      environment: 'node',
      globals: true,
      setupFiles: [],
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './'),
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.FIRECRAWL_API_KEY': JSON.stringify(env.FIRECRAWL_API_KEY),
    },
  };
});
