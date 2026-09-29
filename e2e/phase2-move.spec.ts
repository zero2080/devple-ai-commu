// ROADMAP 6단계 완료 조건: 키보드·클릭 이동, 벽·점유, 서버 반영.
import { expect, test, type Page } from '@playwright/test';

const SSE_PORT = process.env.MOCK_SSE_PORT ?? '5199';

test.beforeEach(async ({ request }) => {
  // Mock 서버는 테스트 사이에 살아 있으므로 월드를 초기 배치로 되돌린다
  const res = await request.post(`http://localhost:${SSE_PORT}/__mock/reset`);
  if (!res.ok()) throw new Error('mock reset failed');
});

interface Tile {
  x: number;
  y: number;
}

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByRole('textbox', { name: '접근 키' }).fill('DEMO-0000-0000');
  await page.getByRole('button', { name: '입장' }).click();
  await expect(page.getByTestId('sse-state')).toHaveAttribute('data-state', 'open');
}

function myPosition(page: Page) {
  return page.evaluate(() => window.__devple?.worldStore.getState().myPosition ?? null);
}

async function serverPositionOfMe(page: Page): Promise<Tile> {
  const res = await page.request.get(`http://localhost:${SSE_PORT}/__mock/state`);
  const body = (await res.json()) as { presences: { userId: string; position: Tile }[] };
  const me = body.presences.find((p) => p.userId === 'u_me');
  if (me === undefined) {
    throw new Error('u_me missing in mock state');
  }
  return { x: me.position.x, y: me.position.y };
}

/** 타일 중심의 화면 좌표 (캔버스 기준) */
function screenOfTile(page: Page, tile: Tile) {
  return page.evaluate((t) => {
    const cam = window.__devple?.game?.currentCamera;
    if (cam === undefined) {
      throw new Error('game not registered');
    }
    return {
      x: (t.x * 16 + 8 - cam.originX) * cam.zoom,
      y: (t.y * 16 + 8 - cam.originY) * cam.zoom,
    };
  }, tile);
}

test('방향키 이동이 예측되고 서버에 반영되며 벽에서 멈춘다', async ({ page }) => {
  await login(page);
  await expect.poll(() => myPosition(page)).toEqual({ mapId: 'main', x: 20, y: 15, dir: 'down' });

  // 오른쪽으로 500ms: 150ms/타일이므로 2~3칸 (가짜 접속자가 길을 막으면 더 적을 수 있음)
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(520);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(200);
  const afterRight = await myPosition(page);
  expect(afterRight?.y).toBe(15);
  expect(afterRight?.x).toBeGreaterThan(20);
  expect(afterRight?.x).toBeLessThanOrEqual(24);
  expect(afterRight?.dir).toBe('right');

  // 배칭(200ms) 뒤 Express 월드에 같은 위치
  await expect
    .poll(() => serverPositionOfMe(page), { timeout: 3_000 })
    .toEqual({ x: afterRight?.x, y: 15 });

  // 위로 계속 누른다: 테두리 벽(y=0) 앞 y=1에서 멈추거나, 가짜 접속자가 바로 위 타일을 점유해 막힌다.
  // 어느 쪽이든 "다음 타일이 벽·점유면 이동하지 않는다"가 성립해야 한다
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const s = window.__devple?.worldStore.getState();
          const me = s?.myPosition ?? null;
          if (s === undefined || me === null) {
            return 'no-position';
          }
          if (me.y === 1) {
            return 'at-wall';
          }
          const blocked = [...s.presences.values()].some(
            (p) => p.userId !== 'u_me' && p.position.x === me.x && p.position.y === me.y - 1,
          );
          return blocked ? 'blocked-by-user' : 'moving';
        }),
      { timeout: 4_000 },
    )
    .toMatch(/at-wall|blocked-by-user/);
  await page.keyboard.up('ArrowUp');
  const afterUp = await myPosition(page);
  expect(afterUp?.x).toBe(afterRight?.x);
  expect(afterUp?.y).toBeGreaterThanOrEqual(1);
  expect(afterUp?.dir).toBe('up');
  await page.waitForTimeout(250);
  const settled = await myPosition(page);
  await expect
    .poll(() => serverPositionOfMe(page), { timeout: 3_000 })
    .toEqual({ x: settled?.x, y: settled?.y });
});

test('클릭한 타일까지 경로를 따라 이동하고 아무도 내 타일에 들어오지 않는다', async ({ page }) => {
  await login(page);
  await expect.poll(() => myPosition(page)).toMatchObject({ x: 20, y: 15 });

  const target = { x: 16, y: 18 }; // 왼쪽 아래 빈 바닥
  const screen = await screenOfTile(page, target);
  const canvas = page.getByRole('img', { name: '가상공간 맵' });
  const box = await canvas.boundingBox();
  if (box === null) {
    throw new Error('canvas not visible');
  }
  await page.mouse.click(box.x + screen.x, box.y + screen.y);
  await expect.poll(() => myPosition(page), { timeout: 5_000 }).toMatchObject(target);
  await expect.poll(() => serverPositionOfMe(page), { timeout: 3_000 }).toEqual(target);

  // 2초 동안 샘플링: 내 타일(예측 위치)에 다른 접속자가 없고, 접속자끼리도 겹치지 않는다.
  // presences의 본인 항목은 스냅샷 기준이라 제외하고 myPosition을 쓴다 (world.positions 본인 무시 규칙)
  for (let i = 0; i < 8; i += 1) {
    const sample = await page.evaluate(() => {
      const s = window.__devple?.worldStore.getState();
      const me = s?.myPosition ?? null;
      if (s === undefined || me === null) {
        throw new Error('store missing');
      }
      const others = [...s.presences.values()]
        .filter((p) => p.userId !== 'u_me')
        .map((p) => `${String(p.position.x)},${String(p.position.y)}`);
      return { others, me: `${String(me.x)},${String(me.y)}` };
    });
    expect(new Set(sample.others).size).toBe(sample.others.length);
    expect(sample.others).not.toContain(sample.me);
    await page.waitForTimeout(250);
  }
});
