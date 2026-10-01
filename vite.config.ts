/// <reference types="vitest/config" />
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

import {
  DEFAULT_SSE_MOCK_PORT,
  EXPRESS_MOCK_PATH_PREFIXES,
  SSE_MOCK_HOST,
} from './src/mocks/data/config.ts';

// Mock SSE 서버 주소 (sse-server.ts와 공유). 포트가 점유돼 있으면 `MOCK_SSE_PORT=5199 pnpm dev`
const SSE_MOCK_ORIGIN = `http://${SSE_MOCK_HOST}:${process.env.MOCK_SSE_PORT ?? String(DEFAULT_SSE_MOCK_PORT)}`;

/**
 * 운영 빌드(VITE_MOCK이 'true'가 아님)에서는 public/의 MSW 워커를 dist에서 뺀다 (DEPLOYMENT 3.1).
 * Mock 코드 자체는 main.tsx의 조건부 동적 import라 빌드 상수로 번들에서 빠진다. 검사: pnpm check:dist
 */
function stripMockWorker(): Plugin {
  let outDir = 'dist';
  let mock = false;
  return {
    name: 'devple:strip-mock-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      mock = config.env.VITE_MOCK === 'true';
    },
    closeBundle() {
      if (!mock) {
        rmSync(resolve(outDir, 'mockServiceWorker.js'), { force: true });
      }
    },
  };
}

/** 운영 화면 기준 경로 (DEPLOYMENT 1.1·3.1 — stories.devple.net을 Stories와 나눠 쓴다). 개발 서버는 '/' 그대로 (ARCHITECTURE 9장) */
const PRODUCTION_BASE = '/commu/';

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? PRODUCTION_BASE : '/',
  plugins: [react(), stripMockWorker()],
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
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/domain/**'],
      exclude: ['src/domain/**/*.test.ts', 'src/domain/types.ts', 'src/domain/index.ts'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
}));
