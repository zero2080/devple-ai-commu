/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { EXPRESS_MOCK_PATH_PREFIXES } from './src/mocks/data/config';

// Mock SSE 서버 포트. 5174가 점유돼 있으면 `MOCK_SSE_PORT=5199 pnpm dev`처럼 바꾼다 (sse-server.ts와 공유)
const SSE_MOCK_ORIGIN = `http://localhost:${process.env.MOCK_SSE_PORT ?? '5174'}`;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: Object.fromEntries(
      // SSE 스트림·티켓·월드 REST(위치·상태·접속자)는 Express mock으로. 나머지 REST는 브라우저 안 MSW (ARCHITECTURE 9장)
      EXPRESS_MOCK_PATH_PREFIXES.map((prefix) => [
        prefix,
        { target: SSE_MOCK_ORIGIN, changeOrigin: false },
      ]),
    ),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
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
