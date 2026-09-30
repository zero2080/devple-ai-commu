import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetMockState, state } from '../state.ts';
import { adminHandlers } from './admin.ts';

const bridge = vi.hoisted(() => ({
  emitViaExpress: vi.fn<(type: string, payload: unknown) => Promise<void>>(() => Promise.resolve()),
}));
vi.mock('../bridge.ts', () => ({ emitViaExpress: bridge.emitViaExpress }));

const server = setupServer(
  ...adminHandlers,
  http.post('*/__mock/emit', () => HttpResponse.json({})),
);
const call = (path: string, method = 'GET', body?: unknown) =>
  fetch(new URL(`/api/v1${path}`, location.href).toString(), {
    method,
    headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

interface SignupsBody {
  items: { id: string; nickname: string; status: string; rejectReason?: string }[];
}

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterAll(() => {
  server.close();
});
beforeEach(() => {
  resetMockState();
  state.session.accessToken = 'mock-token';
  bridge.emitViaExpress.mockClear();
});
afterEach(() => {
  server.resetHandlers();
});

describe('가입 신청 (API_CONTRACT 2.8)', () => {
  it('상태로 거르고, 승인하면 회원이 생기며 다시 처리하면 409', async () => {
    const pending = (await (await call('/admin/signups?status=pending')).json()) as SignupsBody;
    expect(pending.items.map((s) => s.nickname)).toEqual(['신입', '방문자']);
    const approved = await call('/admin/signups/sr_01/approve', 'POST');
    expect(approved.status).toBe(200);
    const { userId } = (await approved.json()) as { userId: string };
    expect(state.users.find((u) => u.id === userId)).toMatchObject({
      nickname: '신입',
      status: 'active',
    });
    const again = await call('/admin/signups/sr_01/approve', 'POST');
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ code: 'SIGNUP_ALREADY_REVIEWED' });
  });

  it('거절은 사유 필수(1~200자), 거절 필터에 사유가 보인다', async () => {
    expect((await call('/admin/signups/sr_02/reject', 'POST', { reason: '  ' })).status).toBe(400);
    expect(
      (await call('/admin/signups/sr_02/reject', 'POST', { reason: '중복 신청' })).status,
    ).toBe(204);
    const rejected = (await (await call('/admin/signups?status=rejected')).json()) as SignupsBody;
    expect(rejected.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'sr_02', rejectReason: '중복 신청' })]),
    );
  });
});

describe('회원·공지', () => {
  it('정지하면 presence.left를 방송하고(이미 정지면 방송 없음), 본인 정지는 403', async () => {
    expect((await call('/admin/users/u_11/suspend', 'POST')).status).toBe(204);
    expect(bridge.emitViaExpress).toHaveBeenCalledWith('presence.left', { userId: 'u_11' });
    bridge.emitViaExpress.mockClear();
    expect((await call('/admin/users/u_11/suspend', 'POST')).status).toBe(204); // 멱등
    expect(bridge.emitViaExpress).not.toHaveBeenCalled();
    expect((await call('/admin/users/u_me/suspend', 'POST')).status).toBe(403);
    expect((await call('/admin/users/u_11/unsuspend', 'POST')).status).toBe(204);
    expect(state.users.find((u) => u.id === 'u_11')?.status).toBe('active');
  });

  it('공지는 201 Notice + system.notice 방송, 빈 본문은 400', async () => {
    const res = await call('/admin/notices', 'POST', { content: '오늘 밤 점검' });
    expect(res.status).toBe(201);
    const notice = (await res.json()) as { id: string; content: string };
    expect(bridge.emitViaExpress).toHaveBeenCalledWith(
      'system.notice',
      expect.objectContaining({ id: notice.id, content: '오늘 밤 점검' }),
    );
    const empty = await call('/admin/notices', 'POST', { content: '' });
    expect(empty.status).toBe(400);
    expect(await empty.json()).toMatchObject({ code: 'MESSAGE_INVALID_CONTENT' });
  });
});
