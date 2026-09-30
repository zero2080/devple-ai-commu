// ROADMAP 5단계 완료 조건 (= Phase 1 목표)를 브라우저에서 검증한다.
import { expect, test, type Page } from '@playwright/test';

const SSE_PORT = process.env.MOCK_SSE_PORT ?? '5199';

test.beforeEach(async ({ request }) => {
  // Mock 서버는 테스트 사이에 살아 있으므로 월드를 초기 배치로 되돌린다
  const res = await request.post(`http://localhost:${SSE_PORT}/__mock/reset`);
  if (!res.ok()) throw new Error('mock reset failed');
});

interface EsStats {
  created: number;
  open: number;
}

interface WorldSample {
  revision: number;
  sseState: string;
  positions: [string, number, number][];
}

async function sampleWorld(page: Page): Promise<WorldSample> {
  return page.evaluate(() => {
    const store = window.__devple?.worldStore;
    if (store === undefined) {
      throw new Error('debug hook missing');
    }
    const s = store.getState();
    return {
      revision: s.revision,
      sseState: s.sseState,
      positions: [...s.presences.values()].map((p) => [p.userId, p.position.x, p.position.y]),
    };
  });
}

function esStats(page: Page): Promise<EsStats> {
  return page.evaluate(() => {
    if (window.__esStats === undefined) {
      throw new Error('EventSource tracker missing');
    }
    return window.__esStats();
  });
}

test('로그인 → 월드 진입 → 가짜 접속자 이동 → 강제 끊김 자동 복구 → 새로고침 세션 복구', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
    if (message.type() === 'warning') consoleWarnings.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  // 부팅 시 세션 복구용 POST /auth/refresh는 쿠키가 없으면 401이 정상이다 (ARCHITECTURE 6장).
  // 브라우저는 이를 "Failed to load resource: 401" 콘솔 에러로 남기므로 그 건수만큼만 허용한다.
  let bootRefresh401 = 0;
  page.on('response', (response) => {
    if (response.url().endsWith('/api/v1/auth/refresh') && response.status() === 401)
      bootRefresh401 += 1;
  });
  const ticketRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/sse/ticket')) ticketRequests.push(request.url());
  });

  // EventSource 생성·열린 연결 수 추적 (탭당 1연결 검증)
  await page.addInitScript(() => {
    const Original = window.EventSource;
    const open = new Set<EventSource>();
    let created = 0;
    class TrackedEventSource extends Original {
      constructor(url: string | URL, init?: EventSourceInit) {
        super(url, init);
        created += 1;
        open.add(this);
      }
      override close(): void {
        open.delete(this);
        super.close();
      }
    }
    window.EventSource = TrackedEventSource;
    window.__esStats = () => ({ created, open: open.size });
  });

  await page.goto('/login');
  await page.getByRole('textbox', { name: '접근 키' }).fill('DEMO-0000-0000');
  await page.getByRole('button', { name: '입장' }).click();

  await expect(page).toHaveURL(/\/$/);
  const badge = page.getByTestId('sse-state');
  await expect(badge).toHaveAttribute('data-state', 'open');
  await expect(badge).toContainText('접속자 20명');
  await expect(page.getByRole('img', { name: '가상공간 맵' })).toBeVisible();

  // 픽셀 웹폰트 동봉 확인 (GRAPHICS 5.1): 2x 기준 24px로 로드된다
  expect(
    await page.evaluate(() => document.fonts.load('24px PixelKo').then((faces) => faces.length)),
  ).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.fonts.check('24px PixelKo'))).toBe(true);

  // 가짜 접속자 20명이 움직이고(리비전 증가), 아무도 겹치지 않으며, 본인은 스폰에 그대로
  const before = await sampleWorld(page);
  await page.waitForTimeout(1500);
  const after = await sampleWorld(page);
  expect(after.revision).toBeGreaterThan(before.revision + 2);
  const movedCount = after.positions.filter(([id, x, y]) => {
    const prev = before.positions.find(([pid]) => pid === id);
    return prev !== undefined && (prev[1] !== x || prev[2] !== y);
  }).length;
  expect(movedCount).toBeGreaterThan(0);
  const tiles = new Set(after.positions.map(([, x, y]) => `${String(x)},${String(y)}`));
  expect(tiles.size).toBe(after.positions.length);
  expect(after.positions.find(([id]) => id === 'u_me')).toEqual(['u_me', 20, 15]);

  // 탭당 EventSource 1개 (React StrictMode의 이중 effect로 dev에서는 티켓이 1장 더 발급될 수 있어 개수는 기준선만 잡는다)
  expect(await esStats(page)).toEqual({ created: 1, open: 1 });
  const ticketsBefore = ticketRequests.length;

  // 강제 끊김 → onerror → 새 티켓 → 재연결, 연결은 여전히 1개
  const disconnect = await page.request.post(`http://localhost:${SSE_PORT}/__mock/disconnect`);
  expect(disconnect.ok()).toBe(true);
  await expect(badge).toHaveAttribute('data-state', 'reconnecting', { timeout: 5_000 });
  await expect(badge).toHaveAttribute('data-state', 'open', { timeout: 10_000 });
  expect(ticketRequests).toHaveLength(ticketsBefore + 1);
  expect(await esStats(page)).toEqual({ created: 2, open: 1 });

  // 콘솔 에러 0 (부팅 refresh 401 리소스 로그 제외), zod/sse 경고 0
  const resource401 = consoleErrors.filter((e) => e.includes('status of 401'));
  expect(resource401.length).toBeLessThanOrEqual(bootRefresh401);
  expect(consoleErrors.filter((e) => !e.includes('status of 401'))).toEqual([]);
  expect(
    consoleWarnings.filter((w) => w.includes('[sse]') || w.toLowerCase().includes('zod')),
  ).toEqual([]);

  // 새로고침: refresh 쿠키로 세션 복구 → 다시 월드
  await page.reload();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('sse-state')).toHaveAttribute('data-state', 'open', {
    timeout: 10_000,
  });
});

test('틀린 접근 키는 계약 문구를 보여주고 월드로 가지 않는다', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: '접근 키' }).fill('WRONG-KEY');
  await page.getByRole('button', { name: '입장' }).click();
  await expect(page.getByRole('alert')).toHaveText('접근 키가 올바르지 않아요.');
  await expect(page).toHaveURL(/\/login$/);
});
