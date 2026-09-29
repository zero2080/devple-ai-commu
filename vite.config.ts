/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const SSE_MOCK_ORIGIN = 'http://localhost:5174';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // SSE 스트림과 티켓 발급만 Express mock으로. 나머지 REST는 브라우저 안 MSW가 처리 (ROADMAP 1·4단계)
      '/api/v1/sse': { target: SSE_MOCK_ORIGIN, changeOrigin: false },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/domain/**'],
      exclude: ['src/domain/**/*.test.ts', 'src/domain/types.ts', 'src/domain/index.ts'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
