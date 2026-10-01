// ROADMAP 8단계 완료 조건: 프로필 카드, DM(전송·수신·말풍선·안 읽음·읽음·회수·검색·무한 스크롤).
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const SSE_PORT = process.env.MOCK_SSE_PORT ?? '5199';
const MOCK = `http://127.0.0.1:${SSE_PORT}`; // SSE_MOCK_HOST
const TILE = 16;

interface Tile {
  x: number;
  y: number;
}

test.beforeEach(async ({ request }) => {
  const res = await request.post(`${MOCK}/__mock/reset`);
  if (!res.ok()) throw new Error('mock reset failed');
});

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByRole('textbox', { name: '접근 키' }).fill('DEMO0-00000-00000-00000');
  await page.getByRole('button', { name: '입장' }).click();
  await expect(page.getByTestId('sse-state')).toHaveAttribute('data-state', 'open');
  await expect
    .poll(() => page.evaluate(() => window.__devple?.worldStore.getState().myPosition ?? null))
    .toMatchObject({ x: 20, y: 15 });
}

/** Express 월드에서 userId를 (x, y) 근처 빈 타일로 옮겨 멈춰 두고(freeze), 클라이언트에 반영될 때까지 기다린다 */
async function place(
  page: Page,
  request: APIRequestContext,
  userId: string,
  x: number,
  y: number,
): Promise<Tile> {
  const res = await request.post(`${MOCK}/__mock/place`, { data: { userId, x, y, freeze: true } });
  const { position } = (await res.json()) as { position: Tile };
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const p = window.__devple?.worldStore.getState().presences.get(id);
        return p === undefined ? null : { x: p.position.x, y: p.position.y };
      }, userId),
    )
    .toEqual({ x: position.x, y: position.y });
  await page.waitForTimeout(300); // 원격 캐릭터 보간(200ms)이 끝나야 클릭 판정 위치가 맞다
  return position;
}

async function clickCharacter(page: Page, tile: Tile): Promise<void> {
  const cam = await page.evaluate(() => window.__devple?.game?.currentCamera ?? null);
  const box = await page.getByRole('img', { name: '가상공간 맵' }).boundingBox();
  if (cam === null || box === null) throw new Error('camera or canvas missing');
  await page.mouse.click(
    box.x + (tile.x * TILE + TILE / 2 - cam.originX) * cam.zoom,
    box.y + (tile.y * TILE + TILE / 2 - cam.originY) * cam.zoom,
  );
}

const dmTab = (page: Page) => page.getByRole('tab', { name: /DM/ });
const thread = (page: Page, nickname: string) =>
  page.getByRole('log', { name: `${nickname}와의 DM` });
const bubble = (page: Page, userId: string) =>
  page.locator(`[data-testid="speech-bubble"][data-user-id="${userId}"]`);

async function openThreadBySearch(page: Page, query: string, nickname: string): Promise<void> {
  await dmTab(page).click();
  await page.getByRole('textbox', { name: '닉네임 검색' }).fill(query);
  await page.getByTestId('dm-search-result').filter({ hasText: nickname }).click();
  await expect(thread(page, nickname)).toBeVisible();
}

test('캐릭터 클릭 → 프로필 카드 → DM 보내기 → 전송, 상대가 반경 안이면 내 머리 위 DM 말풍선', async ({
  page,
  request,
}) => {
  await login(page);
  const at = await place(page, request, 'u_01', 22, 15);
  await clickCharacter(page, at);

  const card = page.getByRole('dialog', { name: '프로필: 도트' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('접속 중');
  await card.getByRole('button', { name: 'DM 보내기' }).click();

  await expect(card).toBeHidden();
  await expect(dmTab(page)).toHaveAttribute('aria-selected', 'true');
  const input = page.getByRole('textbox', { name: '도트에게 DM' });
  await expect(input).toBeFocused();
  await page.keyboard.type('안녕 도트');
  await page.keyboard.press('Enter');

  const mine = thread(page, '도트').getByTestId('dm-message').filter({ hasText: '안녕 도트' });
  await expect(mine).toHaveCount(1);
  await expect(mine).toHaveAttribute('data-mine', 'true');
  await expect(mine.getByRole('button', { name: '회수' })).toBeVisible();
  await expect(bubble(page, 'u_me')).toHaveAttribute('data-variant', 'dm');
  await expect(bubble(page, 'u_me')).toContainText('안녕 도트');

  await page.getByRole('button', { name: '← 목록' }).click();
  await expect(page.getByTestId('dm-conversation').filter({ hasText: '도트' })).toContainText(
    '나: 안녕 도트',
  );
});

/** DM 탭 배지 숫자 (없으면 0) */
async function unreadCount(page: Page): Promise<number> {
  const badge = page.getByTestId('dm-unread');
  return (await badge.count()) === 0 ? 0 : Number(await badge.textContent());
}

test('반경 안 상대의 DM은 DM 말풍선, 반경 밖은 말풍선 없이 탭 안 읽음 → 열면 읽음 처리', async ({
  page,
  request,
}) => {
  await login(page);
  await place(page, request, 'u_02', 21, 16);
  await place(page, request, 'u_03', 3, 3);
  // 목록이 로드된 뒤의 안 읽음을 기준으로 삼는다 (시드에 안 읽은 대화가 있을 수 있음)
  await dmTab(page).click();
  await expect(page.getByTestId('dm-conversation').first()).toBeVisible();
  const base = await unreadCount(page);

  await page.evaluate(() => window.__devpleMock?.dmFrom('u_02', '가까이서 DM'));
  await expect(bubble(page, 'u_02')).toHaveAttribute('data-variant', 'dm');
  await expect(bubble(page, 'u_02')).toContainText('가까이서 DM');

  await page.evaluate(() => window.__devpleMock?.dmFrom('u_03', '멀리서 보낸 DM'));
  await expect.poll(() => unreadCount(page)).toBe(base + 2);
  await page.waitForTimeout(300);
  await expect(bubble(page, 'u_03')).toHaveCount(0);

  const row = page.getByTestId('dm-conversation').filter({ hasText: '레트로' });
  await expect(row).toContainText('멀리서 보낸 DM');
  await expect(row.getByLabel('안 읽음 1')).toBeVisible();
  await row.click();
  // 시드에 이미 레트로와의 대화가 있어 본문으로 거른다
  await expect(
    thread(page, '레트로').getByTestId('dm-message').filter({ hasText: '멀리서 보낸 DM' }),
  ).toHaveCount(1);
  await expect.poll(() => unreadCount(page)).toBe(base + 1); // 레트로 것만 읽음
});

test('닉네임 검색 → 스레드, 미열람 DM은 회수되고 읽힌 DM은 회수할 수 없다', async ({ page }) => {
  await login(page);
  await openThreadBySearch(page, '팔비', '팔비트');
  const input = page.getByRole('textbox', { name: '팔비트에게 DM' });

  await input.fill('회수할 메시지');
  await input.press('Enter');
  const toRecall = thread(page, '팔비트')
    .getByTestId('dm-message')
    .filter({ hasText: '회수할 메시지' });
  await expect(toRecall).toHaveCount(1);
  await toRecall.getByRole('button', { name: '회수' }).click();
  await expect(toRecall).toHaveCount(0);

  await input.fill('읽힐 메시지');
  await input.press('Enter');
  const toRead = thread(page, '팔비트')
    .getByTestId('dm-message')
    .filter({ hasText: '읽힐 메시지' });
  await expect(toRead.getByRole('button', { name: '회수' })).toBeVisible();
  await page.evaluate(() => window.__devpleMock?.readBy('u_04'));
  await expect(toRead).toContainText('읽음');
  await expect(toRead.getByRole('button', { name: '회수' })).toHaveCount(0);

  await page.getByRole('button', { name: '← 목록' }).click();
  const row = page.getByTestId('dm-conversation').filter({ hasText: '팔비트' });
  await expect(row).toContainText('나: 읽힐 메시지');
  await expect(row).not.toContainText('회수할 메시지');
});

test('60개 대화는 50개를 먼저 보여주고, 위로 스크롤하면 나머지 10개를 붙인다', async ({ page }) => {
  await login(page);
  expect(await page.evaluate(() => window.__devpleMock?.seedDm('u_05', 60))).toBe(60);
  await openThreadBySearch(page, '타일', '타일');
  const messages = thread(page, '타일').getByTestId('dm-message');
  await expect(messages).toHaveCount(50);
  await expect(messages.last()).toContainText('옛 메시지 60');

  await thread(page, '타일').evaluate((el) => {
    el.scrollTop = 0;
  });
  await expect(messages).toHaveCount(60);
  await expect(messages.first()).toContainText('옛 메시지 1');
});
