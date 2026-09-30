// ROADMAP 11단계 완료 조건: 운영자 콘솔(가입 신청·회원·공지)과 공지 배너.
// 시드: 데모(u_me)는 운영자, 가입 신청 대기 2(신입·방문자)·승인 1·거절 1 (src/mocks/data/users.ts)
import { expect, test, type Page } from '@playwright/test';

const SSE_PORT = process.env.MOCK_SSE_PORT ?? '5199';
const MOCK = `http://127.0.0.1:${SSE_PORT}`; // SSE_MOCK_HOST

test.beforeEach(async ({ request }) => {
  const res = await request.post(`${MOCK}/__mock/reset`);
  if (!res.ok()) throw new Error('mock reset failed');
});

async function openConsole(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByRole('textbox', { name: '접근 키' }).fill('DEMO-0000-0000');
  await page.getByRole('button', { name: '입장' }).click();
  await expect(page.getByTestId('sse-state')).toHaveAttribute('data-state', 'open');
  await page.getByRole('link', { name: '운영자 콘솔' }).click(); // SPA 이동 — MSW 상태·SSE 유지
  await expect(page.getByRole('heading', { name: '운영자 콘솔' })).toBeVisible();
}

const signupRow = (page: Page, nickname: string) =>
  page.getByTestId('signup-row').filter({ hasText: nickname });
const userRow = (page: Page, nickname: string) =>
  page.getByTestId('admin-user-row').filter({ hasText: nickname });

test('대기 신청을 승인하면 회원이 되고, 거절은 사유를 적어야 하며 거절됨에 사유가 남는다', async ({
  page,
}) => {
  await openConsole(page);
  await expect(page.getByTestId('signup-row')).toHaveCount(2);

  await signupRow(page, '신입').getByRole('button', { name: '승인' }).click();
  await expect(page.getByRole('status')).toContainText('‘신입’ 신청을 승인했어요');
  await expect(signupRow(page, '신입')).toHaveCount(0);

  await signupRow(page, '방문자').getByRole('button', { name: '거절' }).click();
  const confirm = signupRow(page, '방문자').getByRole('button', { name: '거절 확정' });
  await expect(confirm).toBeDisabled();
  await signupRow(page, '방문자').getByRole('textbox', { name: '거절 사유' }).fill('중복 신청');
  await confirm.click();
  await expect(page.getByRole('status')).toContainText('‘방문자’ 신청을 거절했어요');
  await expect(page.getByTestId('signup-row')).toHaveCount(0);

  await page.getByRole('button', { name: '거절됨' }).click();
  await expect(signupRow(page, '방문자')).toContainText('거절 — 중복 신청');
  await page.getByRole('button', { name: '승인됨' }).click();
  await expect(signupRow(page, '신입')).toContainText('승인');

  await page.getByRole('tab', { name: '회원' }).click();
  await expect(userRow(page, '신입')).toContainText('활성');
});

test('회원을 정지하면 월드에서 사라지고, 해제할 수 있다. 키 재발급은 확인 후 보낸다', async ({
  page,
}) => {
  await openConsole(page);
  await page.getByRole('tab', { name: '회원' }).click();
  await expect(userRow(page, '데모').getByRole('button', { name: '정지' })).toHaveCount(0);

  await userRow(page, '모뎀').getByRole('button', { name: '정지' }).click();
  await userRow(page, '모뎀').getByRole('button', { name: '정지 확정' }).click();
  await expect(page.getByRole('status')).toContainText('‘모뎀’님을 정지했어요');
  await expect(userRow(page, '모뎀')).toContainText('정지');
  // 정지된 사용자는 연결이 끊기므로 월드(Express·내 화면)에서 빠진다
  await expect
    .poll(() => page.evaluate(() => window.__devple?.worldStore.getState().presences.has('u_11')))
    .toBe(false);
  const state = (await (await page.request.get(`${MOCK}/__mock/state`)).json()) as {
    presences: { userId: string }[];
  };
  expect(state.presences.some((p) => p.userId === 'u_11')).toBe(false);

  await userRow(page, '모뎀').getByRole('button', { name: '해제' }).click();
  await expect(userRow(page, '모뎀')).toContainText('활성');

  await userRow(page, '도트').getByRole('button', { name: '키 재발급' }).click();
  await expect(userRow(page, '도트')).toContainText('기존 접근 키와 세션이 즉시 무효');
  await userRow(page, '도트').getByRole('button', { name: '재발급 확정' }).click();
  await expect(page.getByRole('status')).toContainText('접근 키를 재발급했어요');
});

test('공지를 보내면 콘솔과 월드에 배너가 뜨고, 닫을 수 있다', async ({ page }) => {
  await openConsole(page);
  await page.getByRole('tab', { name: '공지' }).click();
  await page.getByRole('textbox', { name: /공지 내용/ }).fill('오늘 밤 11시에 점검해요');
  await page.getByRole('button', { name: '공지 보내기' }).click();
  await expect(page.getByRole('status', { name: '공지' })).toContainText('오늘 밤 11시에 점검해요');

  await page.getByRole('link', { name: '← 월드로' }).click();
  const banner = page.getByRole('status', { name: '공지' });
  await expect(banner).toContainText('오늘 밤 11시에 점검해요');
  await banner.getByRole('button', { name: '공지 닫기' }).click();
  await expect(page.getByTestId('notice-banner')).toHaveCount(0);
});
