// ROADMAP 7단계 완료 조건: 근접 대화 전송·수신, 말풍선, 링크 버튼, 입력 포커스, 뷰포트 보장.
import { expect, test, type Page } from '@playwright/test';

const SSE_PORT = process.env.MOCK_SSE_PORT ?? '5199';
const MOCK = `http://127.0.0.1:${SSE_PORT}`; // SSE_MOCK_HOST
const TILE = 16;

test.beforeEach(async ({ request }) => {
  // Mock 서버는 테스트 사이에 살아 있으므로 월드를 초기 배치로 되돌린다
  const res = await request.post(`${MOCK}/__mock/reset`);
  if (!res.ok()) throw new Error('mock reset failed');
});

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByRole('textbox', { name: '접근 키' }).fill('DEMO-0000-0000');
  await page.getByRole('button', { name: '입장' }).click();
  await expect(page.getByTestId('sse-state')).toHaveAttribute('data-state', 'open');
  await expect.poll(() => myPosition(page)).toMatchObject({ x: 20, y: 15 });
}

const chatInput = (page: Page) => page.getByRole('textbox', { name: '근접 대화 입력' });
const chatLog = (page: Page) => page.getByRole('log', { name: '근접 대화 기록' });
const canvas = (page: Page) => page.getByRole('img', { name: '가상공간 맵' });
const bubbleOf = (page: Page, userId: string) =>
  page.locator(`[data-testid="speech-bubble"][data-user-id="${userId}"]`);

function myPosition(page: Page) {
  return page.evaluate(() => window.__devple?.worldStore.getState().myPosition ?? null);
}

async function camera(page: Page) {
  await expect
    .poll(() => page.evaluate(() => window.__devple?.game?.currentCamera ?? null))
    .not.toBeNull();
  const cam = await page.evaluate(() => window.__devple?.game?.currentCamera ?? null);
  if (cam === null) throw new Error('camera missing');
  return cam;
}

async function sendViaKeyboard(page: Page, text: string): Promise<void> {
  await page.keyboard.press('Enter');
  await expect(chatInput(page)).toBeFocused();
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

test('Enter → 입력 → 전송: 로그·내 말풍선(머리 위), 입력 중 방향키 무시, Esc 후 이동', async ({
  page,
}) => {
  await login(page);
  await sendViaKeyboard(page, '안녕하세요 https://example.com/hello');

  await expect(chatInput(page)).toHaveValue('');
  await expect(chatInput(page)).toBeFocused();
  const entry = chatLog(page).getByTestId('public-log-entry').filter({ hasText: '안녕하세요' });
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText('데모');
  await expect(entry.getByRole('button', { name: '↗ example.com' })).toBeVisible();
  await expect(chatLog(page).getByTestId('public-log-pending')).toHaveCount(0);

  // 내 말풍선: 본문 + 링크 버튼, 꼬리 끝이 머리 위(닉네임 블록 위)에 온다
  const bubble = bubbleOf(page, 'u_me');
  await expect(bubble).toBeVisible();
  await expect(bubble).toContainText('안녕하세요 https://example.com/hello');
  await expect(bubble.locator('button', { hasText: '↗ example.com' })).toBeVisible();
  const cam = await camera(page);
  const canvasBox = await canvas(page).boundingBox();
  const bubbleBox = await bubble.boundingBox();
  if (canvasBox === null || bubbleBox === null) throw new Error('boxes missing');
  const anchorX = canvasBox.x + (20 * TILE + TILE / 2 - cam.originX) * cam.zoom;
  // GRAPHICS 5.2: 꼬리 끝 = 프레임 상단 − (닉네임 간격 2 + 닉네임 줄 높이 8 + 1) = 상단 − 11
  // 프레임 24×40 상단 = 앵커(타일 바닥) − 40, 꼬리 끝 = 그 위 11 (GRAPHICS 5.2)
  const anchorY = canvasBox.y + (15 * TILE + TILE - 40 - 11 - cam.originY) * cam.zoom;
  expect(anchorX).toBeGreaterThanOrEqual(bubbleBox.x);
  expect(anchorX).toBeLessThanOrEqual(bubbleBox.x + bubbleBox.width);
  expect(Math.abs(bubbleBox.y + bubbleBox.height + 3 * cam.zoom - anchorY)).toBeLessThanOrEqual(1);

  // 입력창에 포커스가 있으면 방향키로 움직이지 않는다
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowRight');
  expect(await myPosition(page)).toMatchObject({ x: 20, y: 15 });

  // Esc → 캔버스, 이제 방향키로 움직인다
  await page.keyboard.press('Escape');
  await expect(canvas(page)).toBeFocused();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowRight');
  await expect.poll(async () => (await myPosition(page))?.x ?? 0).toBeGreaterThan(20);
});

test('링크 버튼은 새 창으로 열고 opener·referrer를 넘기지 않는다', async ({ page, context }) => {
  await context.route('https://example.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>ok</title>ok' }),
  );
  await login(page);
  await sendViaKeyboard(page, '링크 https://example.com/hello');
  const button = chatLog(page).getByRole('button', { name: '↗ example.com' });
  await expect(button).toHaveAttribute('title', 'https://example.com/hello');

  const [popup] = await Promise.all([context.waitForEvent('page'), button.click()]);
  await popup.waitForLoadState();
  expect(popup.url()).toBe('https://example.com/hello');
  expect(await popup.evaluate(() => window.opener as unknown)).toBeNull();
  expect(await popup.evaluate(() => document.referrer)).toBe('');
  await popup.close();
});

test('반경 안 발화는 받고, 반경 밖 발화는 받지 않으며, 말풍선은 만료되고 로그는 남는다', async ({
  page,
  request,
}) => {
  await login(page);

  const near = await request.post(`${MOCK}/__mock/say`, {
    data: { userId: 'u_02', content: '하이', at: { x: 22, y: 15 } },
  });
  expect(((await near.json()) as { delivered: boolean }).delivered).toBe(true);
  const nearEntry = chatLog(page).getByTestId('public-log-entry').filter({ hasText: '하이' });
  await expect(nearEntry).toContainText('픽셀');
  await expect(bubbleOf(page, 'u_02')).toBeVisible();

  const far = await request.post(`${MOCK}/__mock/say`, {
    data: { userId: 'u_03', content: '멀리서 외침', at: { x: 3, y: 3 } },
  });
  expect(((await far.json()) as { delivered: boolean }).delivered).toBe(false);
  await page.waitForTimeout(800);
  await expect(chatLog(page)).not.toContainText('멀리서 외침');
  await expect(bubbleOf(page, 'u_03')).toHaveCount(0);

  // '하이'(2자) → 3.1초 뒤 사라짐
  await expect(bubbleOf(page, 'u_02')).toHaveCount(0, { timeout: 6_000 });
  await expect(nearEntry).toHaveCount(1);
});

test('반경 끝(5칸 위) 발화자의 두 줄 말풍선도 캔버스 위로 잘리지 않는다 (1280×800, B안)', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);
  // 가짜 접속자가 걸어가지 않게 멈춘다. 수정 전 측정: 말풍선 상단 -12px (docs/report/2026-09-30-dev-mock-port-fix.html)
  const placed = await request.post(`${MOCK}/__mock/place`, {
    data: { userId: 'u_02', x: 20, y: 10, freeze: true },
  });
  expect(placed.ok()).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => window.__devple?.worldStore.getState().presences.get('u_02')?.position.y),
    )
    .toBe(10);
  const said = await request.post(`${MOCK}/__mock/say`, {
    data: { userId: 'u_02', content: '위쪽 끝에서 말하면 말풍선이 보일까요?' },
  });
  expect(((await said.json()) as { delivered: boolean }).delivered).toBe(true);

  const bubble = bubbleOf(page, 'u_02');
  await expect(bubble).toBeVisible();
  // 발화자는 200ms 보간으로 도착한다. 이동 중 프레임으로 판정하지 않도록, 보간보다 긴 간격의 두 표본이
  // 같고 말풍선 가로 중앙이 발화자 위에 온 뒤(마지막 위치)에 본다
  const cam = await camera(page);
  const speakerX = (20 * TILE + TILE / 2 - cam.originX) * cam.zoom;
  let previous = '';
  await expect
    .poll(
      async () => {
        const b = await bubble.boundingBox();
        const current = b === null ? '' : `${String(b.x)},${String(b.y)}`;
        const settled =
          b !== null && current === previous && Math.abs(b.x + b.width / 2 - speakerX) <= cam.zoom;
        previous = current;
        return settled;
      },
      { intervals: [250] },
    )
    .toBe(true);
  const [b, c] = await Promise.all([bubble.boundingBox(), canvas(page).boundingBox()]);
  expect(b?.height).toBeGreaterThan(40); // 두 줄
  expect(b?.y).toBeGreaterThanOrEqual(c?.y ?? 0);
});

test.describe('뷰포트 보장 (GRAPHICS 1.2, ARCHITECTURE 2.5)', () => {
  test('390×844: 내 주변 11×11 타일이 채팅 패널에 가려지지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    const cam = await camera(page);
    const canvasBox = await canvas(page).boundingBox();
    const panelBox = await page.getByTestId('chat-panel').boundingBox();
    if (canvasBox === null || panelBox === null) throw new Error('boxes missing');
    // 가로로 넘치지 않고 캔버스·패널이 화면 안에 있다 (넘치면 보장 영역이 화면 밖으로 밀린다)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    expect(canvasBox.x).toBeGreaterThanOrEqual(0);
    expect(canvasBox.x + canvasBox.width).toBeLessThanOrEqual(390);
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(390);
    expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(844);
    await expect(page.getByRole('button', { name: '보내기' })).toBeInViewport({ ratio: 1 });
    expect(panelBox.y).toBeGreaterThanOrEqual(canvasBox.y + canvasBox.height - 1); // 분할 배치: 겹치지 않음

    // 반경 5 → 내 타일(20,15) 기준 x 15~25, y 10~20
    const left = (15 * TILE - cam.originX) * cam.zoom;
    const right = (26 * TILE - cam.originX) * cam.zoom;
    const top = (10 * TILE - cam.originY) * cam.zoom;
    const bottom = (21 * TILE - cam.originY) * cam.zoom;
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(canvasBox.width);
    expect(bottom).toBeLessThanOrEqual(canvasBox.height);
  });

  test('1280×800: 20×15 타일 이상 보인다', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);
    const cam = await camera(page);
    const canvasBox = await canvas(page).boundingBox();
    if (canvasBox === null) throw new Error('canvas missing');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      1280,
    );
    expect(canvasBox.x + canvasBox.width).toBeLessThanOrEqual(1280);
    expect(canvasBox.width / (TILE * cam.zoom)).toBeGreaterThanOrEqual(20);
    expect(canvasBox.height / (TILE * cam.zoom)).toBeGreaterThanOrEqual(15);
  });
});
