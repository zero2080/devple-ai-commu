// Phase 1 E2E (ROADMAP 5단계 완료 조건을 브라우저에서 검증). Mock SSE 서버와 Vite dev 서버를 함께 띄운다.
import { defineConfig, devices } from '@playwright/test';

const SSE_PORT = process.env.MOCK_SSE_PORT ?? '5199';
const WEB_PORT = process.env.E2E_WEB_PORT ?? '5180';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // pnpm exec 래퍼를 거치면 종료 시 자식 프로세스가 남아 Playwright가 매달린다 → 바이너리 직접 실행
      command: 'node_modules/.bin/tsx src/mocks/sse-server.ts',
      url: `http://localhost:${SSE_PORT}/__mock/state`,
      reuseExistingServer: false,
      env: { MOCK_SSE_PORT: SSE_PORT, MOCK_CHATTER_MS: '0' },
      timeout: 30_000,
    },
    {
      command: `node_modules/.bin/vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      env: { MOCK_SSE_PORT: SSE_PORT, VITE_MOCK: 'true' },
      timeout: 60_000,
    },
  ],
});
