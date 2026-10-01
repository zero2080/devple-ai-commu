// ROADMAP 11b단계 완료 조건: 가입 신청 → 상태 확인 → 운영자 승인, 중복 409, 거절 사유, 접근 키 정규화.
// MSW 상태는 페이지 안에만 있으므로 화면 이동은 새로고침 없이 앱 안에서 한다 (링크·history)
import { expect, test, type Page } from '@playwright/test';

const SSE_PORT = process.env.MOCK_SSE_PORT ?? '5199';
const MOCK = `http://127.0.0.1:${SSE_PORT}`; // SSE_MOCK_HOST

test.beforeEach(async ({ request }) => {
  const res = await request.post(`${MOCK}/__mock/reset`);
  if (!res.ok()) throw new Error('mock reset failed');
});

async function fillSignup(page: Page, email: string, nickname: string, phone: string) {
  await page.getByLabel('이메일').fill(email);
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByLabel('연락처').fill(phone);
  await page.getByRole('button', { name: '신청하기' }).click();
}

/** 새로고침 없이 앱 라우터로 이동 (react-router는 popstate를 듣는다) */
async function goInApp(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

test('신청하면 대기 상태를 보고, 운영자가 콘솔에서 승인하면 승인으로 바뀐다 (소문자·하이픈 없는 키로 입장)', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByRole('link', { name: /가입 신청/ }).click();
  await expect(page.getByRole('heading', { name: '가입 신청' })).toBeVisible();
  await fillSignup(page, ' pixel.fan@example.com ', ' 픽셀팬 ', '010-9876-5432');
  await expect(page).toHaveURL(/\/signup\/[^/]+$/);
  await expect(page.getByRole('status')).toHaveText('운영자가 확인하고 있어요');
  const requestId = decodeURIComponent(new URL(page.url()).pathname.split('/').pop() ?? '');

  await page.getByRole('link', { name: '로그인하러 가기' }).click();
  await page.getByRole('textbox', { name: '접근 키' }).fill('dem00000000000000000'); // 서버가 정규화
  await page.getByRole('button', { name: '입장' }).click();
  await expect(page.getByTestId('sse-state')).toHaveAttribute('data-state', 'open');
  await page.getByRole('link', { name: '운영자 콘솔' }).click();
  const row = page.getByTestId('signup-row').filter({ hasText: '픽셀팬' });
  await expect(row).toContainText('pixel.fan@example.com'); // 공백을 지우고 보냈다
  await row.getByRole('button', { name: '승인' }).click();
  await expect(page.getByRole('status')).toContainText('‘픽셀팬’ 신청을 승인했어요');

  await goInApp(page, `/signup/${encodeURIComponent(requestId)}`);
  await expect(page.getByRole('status')).toHaveText('승인됐어요');
});

test('닉네임은 대소문자만 달라도, 이메일은 대기 중 신청과 같으면 해당 칸에 409를 알려 준다', async ({
  page,
}) => {
  await page.goto('/signup');
  await fillSignup(page, 'first@example.com', 'Retro', '010-1111-0000');
  await expect(page.getByRole('status')).toHaveText('운영자가 확인하고 있어요');
  await page.getByRole('link', { name: '새로 신청하기' }).click();

  await fillSignup(page, 'second@example.com', 'RETRO', '010-1111-0001');
  await expect(page.getByLabel('닉네임')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('이미 사용 중인 닉네임이에요.')).toBeVisible();

  await page.getByLabel('닉네임').fill('레트로팬');
  await page.getByLabel('이메일').fill('NEWBIE@example.com'); // 시드 대기 신청(sr_01)과 같은 이메일
  await page.getByRole('button', { name: '신청하기' }).click();
  await expect(page.getByText('이미 가입했거나 심사 중인 이메일이에요.')).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
});

test('신청 번호로 상태를 찾는다 — 거절이면 사유, 없는 번호면 안내', async ({ page }) => {
  await page.goto('/signup');
  await page.getByRole('textbox', { name: '신청 번호' }).fill('sr_04');
  await page.getByRole('button', { name: '상태 보기' }).click();
  await expect(page.getByRole('status')).toHaveText('신청이 거절됐어요');
  await expect(page.getByText('사유: 연락처 확인 불가')).toBeVisible();

  await page.getByRole('link', { name: '새로 신청하기' }).click();
  await page.getByRole('textbox', { name: '신청 번호' }).fill('sr_none');
  await page.getByRole('button', { name: '상태 보기' }).click();
  await expect(page.getByRole('alert')).toContainText('이 번호의 신청을 찾을 수 없어요');
});
