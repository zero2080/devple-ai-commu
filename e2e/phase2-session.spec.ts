// ROADMAP 10단계 완료 조건: 자리비움, 재동기화(sync.required), 정지 처리.
import { expect, test, type Page } from '@playwright/test';

const SSE_PORT = process.env.MOCK_SSE_PORT ?? '5199';
const MOCK = `http://127.0.0.1:${SSE_PORT}`; // SSE_MOCK_HOST
const SUSPENDED = '정지된 계정이에요. 운영자에게 문의해 주세요.';

test.beforeEach(async ({ request }) => {
  const res = await request.post(`${MOCK}/__mock/reset`);
  if (!res.ok()) throw new Error('mock reset failed');
});

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByRole('textbox', { name: '접근 키' }).fill('DEMO0-00000-00000-00000');
  await page.getByRole('button', { name: '입장' }).click();
  await expect(page.getByTestId('sse-state')).toHaveAttribute('data-state', 'open');
}

async function myServerState(page: Page): Promise<string | undefined> {
  const res = await page.request.get(`${MOCK}/__mock/state`);
  const body = (await res.json()) as { presences: { userId: string; state: string }[] };
  return body.presences.find((p) => p.userId === 'u_me')?.state;
}

test('입력 없이 두면 자리비움(서버·배지), 키를 누르면 온라인으로 돌아온다', async ({ page }) => {
  await login(page);
  expect(await myServerState(page)).toBe('online');
  // 5분 대신 1.5초 (DEV 훅). 마지막 입력(입장 클릭)부터 잰다
  await page.evaluate(() => {
    window.__devple?.setAwayTimeoutMs?.(1500);
  });
  const badge = page.getByTestId('sse-state');
  await expect(badge).toHaveAttribute('data-away', 'true', { timeout: 5000 });
  await expect(badge).toContainText('자리비움');
  await expect.poll(() => myServerState(page)).toBe('away');

  await page.keyboard.press('Shift');
  await expect(badge).toHaveAttribute('data-away', 'false');
  await expect.poll(() => myServerState(page)).toBe('online');
});

test('sync.required를 받으면 월드 접속자와 DM 목록을 다시 받는다', async ({ page, request }) => {
  await login(page);
  await page.getByRole('tab', { name: /DM/ }).click();
  const list = page.getByRole('list', { name: 'DM 대화 목록' });
  await expect(list.getByTestId('dm-conversation').first()).toBeVisible();
  // 이벤트 없이 서버 상태만 바꾼다 (브라운관 = u_09와의 대화가 새로 생김)
  expect(await page.evaluate(() => window.__devpleMock?.seedDm('u_09', 3))).toBe(3);
  await page.waitForTimeout(300);
  await expect(list).not.toContainText('브라운관');

  const presences = page.waitForRequest((req) =>
    req.url().includes('/api/v1/world/main/presences'),
  );
  const emitted = await request.post(`${MOCK}/__mock/emit`, {
    data: { type: 'sync.required', payload: { reason: 'server_restart' } },
  });
  expect(emitted.status()).toBe(202);
  await presences;
  await expect(list).toContainText('브라운관');
});

test('정지되면 로그인 화면으로 가서 안내하고, 다시 연결하지 않으며, 재로그인도 거부된다', async ({
  page,
}) => {
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
  await login(page);
  await page.evaluate(() => window.__devpleMock?.suspendMe());

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('alert')).toHaveText(SUSPENDED);
  const stats = () => page.evaluate(() => window.__esStats?.() ?? null);
  const created = (await stats())?.created ?? 0;
  await page.waitForTimeout(2500); // 백오프(1초)가 지나도 새 연결을 만들지 않는다
  expect(await stats()).toEqual({ created, open: 0 });

  await page.getByRole('textbox', { name: '접근 키' }).fill('DEMO0-00000-00000-00000');
  await page.getByRole('button', { name: '입장' }).click();
  await expect(page.getByRole('alert')).toHaveText(SUSPENDED); // 안내 대신 폼 오류 한 줄
  await expect(page.getByRole('alert')).toHaveCount(1);
  await expect(page).toHaveURL(/\/login$/);
});
