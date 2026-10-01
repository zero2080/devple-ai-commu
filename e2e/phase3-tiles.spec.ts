// ROADMAP 12b-4 완료 조건: 타일셋으로 그린 맵에서 캐릭터는 overhead(나무 잎·지붕 꼭대기) 아래에 그려진다
import { expect, test, type Page } from '@playwright/test';

const SSE_PORT = process.env.MOCK_SSE_PORT ?? '5199';
const MOCK = `http://127.0.0.1:${SSE_PORT}`;
const TILE = 16;
/**
 * main 맵: (20,22) 나무 밑동 → 바로 위 (20,21)은 잎(canopy) overhead, (22,21)은 overhead 없는 풀밭.
 * 내 캐릭터(20,15)를 중심으로 한 카메라에 들어오는 나무를 쓴다
 */
const UNDER_CANOPY = { x: 20, y: 21 };
const OPEN_GRASS = { x: 22, y: 21 };

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

/** 캐릭터가 (tx, ty)에 서 있을 때 몸통 블록(프레임 x 9–14, y 26–29)의 월드 px 픽셀 색들 */
function torsoPixels(page: Page, tile: { x: number; y: number }): Promise<string[]> {
  const frame = { x: tile.x * TILE + TILE / 2 - 12, y: tile.y * TILE + TILE - 40 };
  return page.evaluate(
    ({ x0, y0 }) => {
      const camera = window.__devple?.game?.currentCamera;
      const canvas = document.querySelector<HTMLCanvasElement>('canvas[aria-label="가상공간 맵"]');
      const ctx = canvas?.getContext('2d');
      if (camera === undefined || canvas === null || ctx === null || ctx === undefined) return [];
      const dpr = canvas.width / canvas.clientWidth;
      const out: string[] = [];
      for (let y = y0; y < y0 + 4; y += 1) {
        for (let x = x0; x < x0 + 6; x += 1) {
          const sx = Math.floor(((x - camera.originX) * camera.zoom + camera.zoom / 2) * dpr);
          const sy = Math.floor(((y - camera.originY) * camera.zoom + camera.zoom / 2) * dpr);
          const [r = 0, g = 0, b = 0] = ctx.getImageData(sx, sy, 1, 1).data;
          out.push(`#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
        }
      }
      return out;
    },
    { x0: frame.x + 9, y0: frame.y + 26 },
  );
}

async function place(page: Page, userId: string, tile: { x: number; y: number }): Promise<void> {
  const res = await page.request.post(`${MOCK}/__mock/place`, {
    data: { userId, ...tile, freeze: true },
  });
  expect(res.ok()).toBe(true);
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const p = window.__devple?.worldStore.getState().presences.get(id)?.position;
        return p === undefined ? null : { x: p.x, y: p.y };
      }, userId),
    )
    .toEqual(tile);
  await page.waitForTimeout(400); // 보간(200ms)이 끝나 그 칸에 서 있을 때까지
}

test('캐릭터는 나무 잎(overhead) 아래에 그려지고, overhead가 없는 칸에서는 보인다 (GRAPHICS 4장)', async ({
  page,
  request,
}) => {
  await request.post(`${MOCK}/__mock/freeze-all`);
  await login(page);
  // 잎 칸: 캐릭터를 세워도 몸통 자리 픽셀이 잎 그대로 (잎은 초록 램프·외곽선 색). 타일셋이 그려질 때까지 기다린다
  const CANOPY = ['#3e8948', '#63c74d', '#265c42', '#181425'];
  await expect
    .poll(async () => {
      const pixels = await torsoPixels(page, UNDER_CANOPY);
      return pixels.length === 24 && pixels.every((hex) => CANOPY.includes(hex));
    })
    .toBe(true);
  const canopyBefore = await torsoPixels(page, UNDER_CANOPY);
  await place(page, 'u_02', UNDER_CANOPY);
  expect(await torsoPixels(page, UNDER_CANOPY)).toEqual(canopyBefore);
  // 열린 풀밭: 같은 캐릭터를 세우면 몸통 자리가 바뀐다
  const grassBefore = await torsoPixels(page, OPEN_GRASS);
  await place(page, 'u_02', OPEN_GRASS);
  const grassAfter = await torsoPixels(page, OPEN_GRASS);
  const changed = grassAfter.filter((hex, i) => hex !== grassBefore[i]).length;
  expect(changed).toBeGreaterThan(12);
});
