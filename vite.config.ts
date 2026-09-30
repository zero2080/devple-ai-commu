/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import {
  DEFAULT_SSE_MOCK_PORT,
  EXPRESS_MOCK_PATH_PREFIXES,
  SSE_MOCK_HOST,
} from './src/mocks/data/config.ts';

// Mock SSE 서버 주소 (sse-server.ts와 공유). 포트가 점유돼 있으면 `MOCK_SSE_PORT=5199 pnpm dev`
const SSE_MOCK_ORIGIN = `http://${SSE_MOCK_HOST}:${process.env.MOCK_SSE_PORT ?? String(DEFAULT_SSE_MOCK_PORT)}`;

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
