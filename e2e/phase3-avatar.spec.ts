// ROADMAP 12a단계 완료 조건: 옷장 저장 → 내 캐릭터 픽셀(두 탭), DOM 닉네임과 말풍선 배치, 걷기 중 rAF 간격 p95
import { expect, test, type Page } from '@playwright/test';

const SSE_PORT = process.env.MOCK_SSE_PORT ?? '5199';
const MOCK = `http://127.0.0.1:${SSE_PORT}`;
const TILE = 16;
/** 내 시작 타일 (Mock 시드). 프레임 왼쪽 위 = 타일 바닥 중앙 − (12, 40) */
const ME = { x: 20, y: 15 };
const FRAME = { x: ME.x * TILE + TILE / 2 - 12, y: ME.y * TILE + TILE - 40 };
/**
 * 개발용 후드(art/avatar/top/top_hoodie.pix, down)의 윗줄 x7은 주색 hi, y28 x9는 base다.
 * 합성 전 대체 그림(외형 색 도형)은 base 한 색이라 hi 픽셀로 합성 여부를 구분한다
 */
const TORSO_HI = { x: FRAME.x + 7, y: FRAME.y + 24 };
const TORSO_BASE = { x: FRAME.x + 9, y: FRAME.y + 28 };
// Mock 내 외형: top_hoodie primary item_green → item_purple로 바꾼다 (palette.json 램프)
const GREEN = { hi: '#63c74d', base: '#3e8948' };
const PURPLE = { hi: '#b55088', base: '#68386c' };

test.beforeEach(async ({ request }) => {
  const res = await request.post(`${MOCK}/__mock/reset`);
  if (!res.ok()) throw new Error('mock reset failed');
});

async function enteredWorld(page: Page): Promise<void> {
  await expect(page.getByTestId('sse-state')).toHaveAttribute('data-state', 'open');
  await expect
    .poll(() => page.evaluate(() => window.__devple?.worldStore.getState().myPosition ?? null))
    .toMatchObject(ME);
}

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByRole('textbox', { name: '접근 키' }).fill('DEMO0-00000-00000-00000');
  await page.getByRole('button', { name: '입장' }).click();
  await enteredWorld(page);
}

/** 월드 px (x, y)의 캔버스 픽셀 색 '#rrggbb' (그 월드 px 칸의 가운데를 읽는다) */
function worldPixel(page: Page, at: { x: number; y: number }): Promise<string | null> {
  return page.evaluate(({ x, y }) => {
    const camera = window.__devple?.game?.currentCamera;
    const canvas = document.querySelector<HTMLCanvasElement>('canvas[aria-label="가상공간 맵"]');
    const ctx = canvas?.getContext('2d');
    if (camera === undefined || canvas === null || ctx === null || ctx === undefined) return null;
    const dpr = canvas.width / canvas.clientWidth;
    const sx = Math.floor(((x - camera.originX) * camera.zoom + camera.zoom / 2) * dpr);
    const sy = Math.floor(((y - camera.originY) * camera.zoom + camera.zoom / 2) * dpr);
    const [r = 0, g = 0, b = 0] = ctx.getImageData(sx, sy, 1, 1).data;
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }, at);
}

test('옷장에서 상의 색을 바꿔 저장하면 내 캐릭터 픽셀이 바뀌고, 같은 계정의 다른 탭에서도 바뀐다', async ({
  page,
  context,
  request,
}) => {
  await request.post(`${MOCK}/__mock/freeze-all`); // 다른 캐릭터가 내 앞을 지나가지 않게
  await login(page);
  // 같은 계정의 다른 탭: 같은 브라우저 컨텍스트라 refresh 쿠키로 세션을 복구해 바로 월드에 들어온다
  const other = await context.newPage();
  await other.goto('/');
  await enteredWorld(other);
  // 합성이 끝나 키 색이 램프 색으로 바뀐 상태 (hi 줄은 합성 전 대체 그림이면 base 색이다)
  for (const tab of [page, other]) {
    await expect.poll(() => worldPixel(tab, TORSO_HI)).toBe(GREEN.hi);
    expect(await worldPixel(tab, TORSO_BASE)).toBe(GREEN.base);
  }

  await page.getByRole('button', { name: '옷장' }).click();
  const wardrobe = page.getByRole('dialog', { name: '옷장' });
  await expect(wardrobe).toBeVisible();
  await expect(
    wardrobe.getByRole('group', { name: '상의 주색' }).getByRole('radio', { name: '초록' }),
  ).toBeChecked();
  await wardrobe
    .getByRole('group', { name: '상의 주색' })
    .getByRole('radio', { name: '보라' })
    .click();
  await wardrobe.getByRole('button', { name: '저장' }).click();
  await expect(wardrobe).toBeHidden();

  // 월드 캐릭터는 presence.updated로 바뀐다 (ARCHITECTURE 7장) — 저장한 탭과 다른 탭 모두
  for (const tab of [page, other]) {
    await expect.poll(() => worldPixel(tab, TORSO_HI)).toBe(PURPLE.hi);
    expect(await worldPixel(tab, TORSO_BASE)).toBe(PURPLE.base);
  }
  // 다른 탭의 옷장도 새 외형에서 시작한다 (presence.updated → authStore.me)
  await other.getByRole('button', { name: '옷장' }).click();
  await expect(
    other
      .getByRole('dialog', { name: '옷장' })
      .getByRole('group', { name: '상의 주색' })
      .getByRole('radio', { name: '보라' }),
  ).toBeChecked();
  await other.close();
});

test('옷장은 무대 안에 들어오고, 키보드로 아래 선택지까지 가도 페이지가 밀리지 않는다 (1280×800, 390×844)', async ({
  page,
}) => {
  await login(page);
  for (const size of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await page.getByRole('button', { name: '옷장' }).click();
    const wardrobe = page.getByRole('dialog', { name: '옷장' });
    await expect(wardrobe.getByRole('button', { name: '저장' })).toBeInViewport();
    const flower = wardrobe.getByRole('group', { name: '손' }).getByRole('radio', { name: '꽃' });
    await flower.focus();
    await page.keyboard.press('Space'); // 키보드로 고른다
    await expect(flower).toBeChecked();
    const shift = await page.evaluate(() => {
      const main = document.querySelector('main');
      return {
        scrollTop: main?.scrollTop ?? -1,
        horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(shift).toEqual({ scrollTop: 0, horizontal: 0 });
    await expect(wardrobe.getByRole('heading', { name: '옷장' })).toBeInViewport();
    await wardrobe.getByRole('button', { name: '취소' }).click();
    await expect(wardrobe).toBeHidden();
  }
});

test('닉네임은 DOM으로 머리 위에 보이고, 말풍선은 그 위에 놓인다 (GRAPHICS 5.2·5.3)', async ({
  page,
  request,
}) => {
  await request.post(`${MOCK}/__mock/freeze-all`);
  await login(page);
  const nickname = page.locator('[data-testid="nickname-layer"] [data-user-id="u_me"]');
  await expect(nickname).toHaveText('데모');
  const camera = await page.evaluate(() => window.__devple?.game?.currentCamera ?? null);
  const canvasBox = await page.getByRole('img', { name: '가상공간 맵' }).boundingBox();
  if (camera === null || canvasBox === null) throw new Error('world not ready');
  const zoom = camera.zoom;
  // 닉네임 블록 하단 = 프레임 상단 − 2 (월드 px × 줌), 가운데 = 프레임 가운데
  await expect
    .poll(async () => {
      const box = await nickname.boundingBox();
      return box === null ? null : Math.round(box.y + box.height);
    })
    .toBe(Math.round(canvasBox.y + (FRAME.y - 2 - camera.originY) * zoom));
  const nickBox = await nickname.boundingBox();
  if (nickBox === null) throw new Error('nickname missing');
  expect(nickBox.height).toBe(12 * zoom); // PixelKo em 12 × line-height 1
  const centerX = canvasBox.x + (FRAME.x + 12 - camera.originX) * zoom;
  expect(Math.abs(nickBox.x + nickBox.width / 2 - centerX)).toBeLessThanOrEqual(zoom);

  await page.keyboard.press('Enter');
  await page.getByRole('textbox', { name: '근접 대화 입력' }).fill('머리 위 확인');
  await page.keyboard.press('Enter');
  const bubble = page.locator('[data-testid="speech-bubble"][data-user-id="u_me"]');
  await expect(bubble).toBeVisible();
  const bubbleBox = await bubble.boundingBox();
  if (bubbleBox === null) throw new Error('bubble missing');
  // 꼬리 끝(몸통 하단 + 3) = 닉네임 블록 상단 − 1 (월드 px × 줌)
  expect(
    Math.abs(bubbleBox.y + bubbleBox.height + 3 * zoom - (nickBox.y - zoom)),
  ).toBeLessThanOrEqual(1);
  // 겹침 순서: 말풍선 레이어가 닉네임 레이어 뒤(DOM) = 위에 그려진다
  const bubbleAfterNicknames = await page.evaluate(() => {
    const nicknames = document.querySelector('[data-testid="nickname-layer"]');
    const bubbles = document.querySelector('[data-testid="bubble-layer"]');
    return (
      nicknames !== null &&
      bubbles !== null &&
      (nicknames.compareDocumentPosition(bubbles) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    );
  });
  expect(bubbleAfterNicknames).toBe(true);
});

test('가짜 접속자 20명이 걷는 동안 rAF 간격 p95 ≤ 20ms (헤드리스 Chromium)', async ({ page }) => {
  await login(page);
  await expect
    .poll(() => page.evaluate(() => window.__devple?.worldStore.getState().presences.size ?? 0))
    .toBeGreaterThanOrEqual(20);
  await page.getByRole('img', { name: '가상공간 맵' }).focus();
  await page.keyboard.down('ArrowLeft'); // 내 캐릭터도 걷는다
  const stats = await page.evaluate(
    () =>
      new Promise<{ p50: number; p95: number; max: number; frames: number }>((resolve) => {
        const deltas: number[] = [];
        let last = 0;
        const tick = (now: number): void => {
          if (last !== 0) deltas.push(now - last);
          last = now;
          if (deltas.length < 240) {
            requestAnimationFrame(tick);
            return;
          }
          const sorted = [...deltas].sort((a, b) => a - b);
          const at = (q: number) =>
            sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
          resolve({ p50: at(0.5), p95: at(0.95), max: sorted.at(-1) ?? 0, frames: deltas.length });
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.keyboard.up('ArrowLeft');
  const walking = await page.evaluate(
    () => window.__devple?.worldStore.getState().presences.size ?? 0,
  );
  const summary = `rAF ${String(stats.frames)}프레임: p50 ${stats.p50.toFixed(1)}ms, p95 ${stats.p95.toFixed(1)}ms, max ${stats.max.toFixed(1)}ms (접속자 ${String(walking)}명)`;
  test.info().annotations.push({ type: 'rAF', description: summary });
  console.log(summary);
  expect(stats.p95).toBeLessThanOrEqual(20);
});
