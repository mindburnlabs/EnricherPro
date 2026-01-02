import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Suppress the "url.parse()" deprecation warning from dependencies (e.g. tailwindcss, axios)
// This is a known issue in the ecosystem and safe to ignore until upstream fixes land.
const originalEmitWarning = process.emitWarning;
process.emitWarning = (warning, ...args) => {
  if (typeof warning === 'string' && warning.includes('url.parse()')) return;
  if (warning && typeof warning === 'object' && warning.name === 'DeprecationWarning' && warning.message.includes('url.parse()')) return;
  // @ts-ignore
  return originalEmitWarning.call(process, warning, ...args);
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:3002', // Self-target if using Vercel Dev, or different port if separate backend
          changeOrigin: true,
          rewrite: (path) => path // Vercel dev handles /api
        }
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'lucide-react']
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    }
  };
});
