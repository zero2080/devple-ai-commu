// ROADMAP 9단계 완료 조건: 그룹 만들기·전송(말풍선 없음)·안 읽음·읽음, owner 관리(초대·강퇴·이름 변경·해산),
// 나가기, 강퇴당함 안내, 초대받음(group.joined), 무한 스크롤.
// 시드 (src/mocks/data/chat.ts): g_01 '광장 단골'(내가 owner, 4명, 안 읽음 1), g_02 '레트로 게임 모임'(u_03 owner, 3명, 안 읽음 1)
import { expect, test, type Page } from '@playwright/test';

const SSE_PORT = process.env.MOCK_SSE_PORT ?? '5199';
const MOCK = `http://127.0.0.1:${SSE_PORT}`; // SSE_MOCK_HOST

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

const groupTab = (page: Page) => page.getByRole('tab', { name: /그룹/ });
const groupRow = (page: Page, name: string) =>
  page.getByTestId('group-row').filter({ hasText: name });
const groupLog = (page: Page, name: string) => page.getByRole('log', { name: `${name} 그룹 대화` });
const members = (page: Page) => page.getByTestId('group-member');
const bubbles = (page: Page) => page.getByTestId('speech-bubble');

async function openGroup(page: Page, name: string): Promise<void> {
  await groupTab(page).click();
  await groupRow(page, name).click();
  await expect(groupLog(page, name)).toBeVisible();
}

async function openMembers(page: Page, name: string): Promise<void> {
  await openGroup(page, name);
  await page.getByRole('button', { name: /^멤버/ }).click();
  await expect(page.getByRole('region', { name: `${name} 멤버` })).toBeVisible();
}

test('만든 그룹에 보내면 스레드에 한 번만 보이고 말풍선은 없다. 다른 탭에서 받은 멤버 메시지는 그룹 탭 안 읽음 → 열면 읽음', async ({
  page,
}) => {
  await login(page);
  await groupTab(page).click();
  await page.getByRole('textbox', { name: '새 그룹 이름' }).fill('E2E 모임');
  await page.getByRole('button', { name: '만들기' }).click();
  await expect(groupLog(page, 'E2E 모임')).toBeVisible();
  await page.getByRole('textbox', { name: 'E2E 모임 그룹에 메시지' }).fill('첫 그룹 메시지');
  await page.keyboard.press('Enter');
  const sent = groupLog(page, 'E2E 모임').getByTestId('group-message');
  await expect(sent).toHaveCount(1);
  await expect(sent).toContainText('첫 그룹 메시지');
  await expect(page.getByTestId('group-pending')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '멤버 1명' })).toBeVisible();

  // 근접 탭에 있을 때 가짜 멤버가 광장 단골에 말한다 → 안 읽음 2(시드) → 3, 말풍선은 없다
  await page.getByRole('tab', { name: '근접' }).click();
  await expect(page.getByTestId('group-unread')).toHaveText('2');
  const id = await page.evaluate(() =>
    window.__devpleMock?.groupFrom('g_01', 'u_01', '다들 모여요'),
  );
  expect(id).not.toBeNull();
  await expect(page.getByTestId('group-unread')).toHaveText('3');
  await page.waitForTimeout(300);
  await expect(bubbles(page)).toHaveCount(0);

  // 탭을 옮겨도 열어 둔 스레드는 그대로다 (DM 탭과 같음) → 목록으로
  await groupTab(page).click();
  await expect(groupLog(page, 'E2E 모임')).toBeVisible();
  await page.getByRole('button', { name: '← 목록' }).click();
  await expect(groupRow(page, '광장 단골')).toContainText('다들 모여요');
  await expect(groupRow(page, '광장 단골').getByLabel('안 읽음 2')).toBeVisible();
  await groupRow(page, '광장 단골').click();
  await expect(groupLog(page, '광장 단골')).toContainText('다들 모여요');
  await expect(page.getByTestId('group-unread')).toHaveText('1'); // 레트로 1만 남음
});

test('owner: 닉네임 검색으로 초대 → 인원 +1 → 강퇴 → 인원 −1 → 이름 변경 → 해산하면 목록에서 사라진다', async ({
  page,
}) => {
  await login(page);
  await openMembers(page, '광장 단골');
  await expect(members(page)).toHaveCount(4);
  await expect(members(page).first()).toContainText('방장');

  await page.getByRole('textbox', { name: '초대할 닉네임' }).fill('타일');
  await page.getByTestId('group-invite-result').click();
  await expect(members(page)).toHaveCount(5);
  await expect(page.getByRole('region', { name: '광장 단골 멤버' })).toContainText('5/10명');

  await members(page).filter({ hasText: '타일' }).getByRole('button', { name: '강퇴' }).click();
  await expect(members(page)).toHaveCount(4);
  await expect(members(page).filter({ hasText: '타일' })).toHaveCount(0);

  const rename = page.getByRole('textbox', { name: '그룹 이름' });
  await rename.fill('새 단골');
  await page.getByRole('button', { name: '이름 변경' }).click();
  await expect(page.getByRole('region', { name: '새 단골 멤버' })).toBeVisible();

  await page.getByRole('button', { name: '그룹 해산' }).click();
  await page.getByRole('button', { name: '해산 확정' }).click();
  await expect(page.getByRole('list', { name: '그룹 목록' })).toBeVisible();
  await expect(groupRow(page, '새 단골')).toHaveCount(0);
  await expect(groupRow(page, '레트로 게임 모임')).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveCount(0); // 내가 해산한 건 안내하지 않는다
});

test('멤버로 속한 그룹은 확인 후 나가면 목록에서 사라진다', async ({ page }) => {
  await login(page);
  await openMembers(page, '레트로 게임 모임');
  await expect(page.getByRole('button', { name: '강퇴' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '그룹 해산' })).toHaveCount(0);
  await page.getByRole('button', { name: '그룹 나가기' }).click();
  await page.getByRole('button', { name: '나가기 확정' }).click();
  await expect(page.getByRole('list', { name: '그룹 목록' })).toBeVisible();
  await expect(groupRow(page, '레트로 게임 모임')).toHaveCount(0);
});

test('열어 둔 그룹에서 강퇴되면 스레드가 닫히고 안내가 뜬다. 초대받으면 목록에 나타난다', async ({
  page,
}) => {
  await login(page);
  await openGroup(page, '레트로 게임 모임');
  expect(await page.evaluate(() => window.__devpleMock?.kickMe('g_02'))).toBe(true);
  await expect(groupLog(page, '레트로 게임 모임')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('‘레트로 게임 모임’ 그룹에서 강퇴됐어요');
  await expect(groupRow(page, '레트로 게임 모임')).toHaveCount(0);

  await page.evaluate(() => window.__devpleMock?.inviteMe('초대받은 모임'));
  await expect(groupRow(page, '초대받은 모임')).toContainText('2명');
});

test('62개 대화는 50개를 먼저 보여주고, 위로 스크롤하면 나머지를 붙인다', async ({ page }) => {
  await login(page);
  expect(await page.evaluate(() => window.__devpleMock?.seedGroup('g_01', 60))).toBe(60);
  await openGroup(page, '광장 단골');
  const messages = groupLog(page, '광장 단골').getByTestId('group-message');
  await expect(messages).toHaveCount(50);
  await expect(messages.last()).toContainText('옛 그룹 메시지 60');
  await groupLog(page, '광장 단골').evaluate((el) => {
    el.scrollTop = 0;
  });
  await expect(messages).toHaveCount(62); // 시드 2 + 60
  await expect(messages.first()).toContainText('단골 모임 만들었어요');
});

test('390×844: 그룹 스레드 헤더(← 목록·이름·멤버)는 한 줄이고 가로로 넘치지 않는다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await openGroup(page, '레트로 게임 모임');
  const back = await page.getByRole('button', { name: '← 목록' }).boundingBox();
  const membersButton = await page.getByRole('button', { name: /^멤버/ }).boundingBox();
  if (back === null || membersButton === null) throw new Error('header buttons missing');
  // 한 줄 = 글자 높이(em 12 × 줌 2 = 24px) 정도. 두 줄로 꺾이면 48px 이상
  expect(back.height).toBeLessThan(36);
  expect(membersButton.height).toBeLessThan(36);
  expect(Math.abs(back.y - membersButton.y)).toBeLessThan(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(
    0,
  );
});
