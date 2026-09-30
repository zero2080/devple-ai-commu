import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { inviteMe, kickMe, receiveGroupMessage, seedGroup } from '../groupSim.ts';
import { resetMockState, state } from '../state.ts';
import { groupsHandlers } from './groups.ts';

const bridge = vi.hoisted(() => ({
  emitViaExpress: vi.fn<(type: string, payload: unknown) => Promise<void>>(() => Promise.resolve()),
}));
vi.mock('../bridge.ts', () => ({ emitViaExpress: bridge.emitViaExpress }));

const server = setupServer(
  ...groupsHandlers,
  http.post('*/__mock/emit', () => HttpResponse.json({})),
);
const AUTH = { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' };
const api = (path: string) => new URL(`/api/v1${path}`, location.href).toString();
const call = (path: string, method = 'GET', body?: unknown) =>
  fetch(api(path), {
    method,
    headers: AUTH,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

interface ListBody {
  items: { id: string; name: string; unreadCount: number; memberCount: number }[];
}
interface PageBody {
  items: { id: string; content: string }[];
  nextCursor: string | null;
}

const lastEmit = () => bridge.emitViaExpress.mock.calls.at(-1) ?? [];
const unreadOf = async (groupId: string) =>
  ((await (await call('/groups')).json()) as ListBody).items.find((g) => g.id === groupId)
    ?.unreadCount;

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

describe('GET /groups/{id}/messages 커서 페이지네이션', () => {
  it('최신순 50개, 다음 페이지는 그보다 오래된 것', async () => {
    seedGroup('g_01', 60); // 시드 2개 + 60개
    const first = (await (await call('/groups/g_01/messages?limit=50')).json()) as PageBody;
    expect(first.items).toHaveLength(50);
    expect(first.items[0]?.content).toBe('옛 그룹 메시지 60');
    const second = (await (
      await call(`/groups/g_01/messages?limit=50&cursor=${String(first.nextCursor)}`)
    ).json()) as PageBody;
    expect(second.items).toHaveLength(12);
    expect(second.nextCursor).toBeNull();
  });
});

describe('전송·관리는 emit 브리지로 방송한다', () => {
  it('보내면 chat.group(내 sender, User만)을 방송하고 내 메시지는 안 읽음에 세지 않는다', async () => {
    const before = await unreadOf('g_02');
    const sent = (await (
      await call('/groups/g_02/messages', 'POST', { content: '안녕' })
    ).json()) as { id: string };
    const [type, raw] = lastEmit();
    const payload = raw as { id: string; sender: Record<string, unknown> } | undefined;
    expect(type).toBe('chat.group');
    expect(payload?.id).toBe(sent.id);
    expect(payload?.sender.id).toBe(state.me.id);
    expect(payload?.sender).not.toHaveProperty('email');
    expect(before).toBe(1);
    expect(await unreadOf('g_02')).toBe(0);
  });

  it('이름 변경·초대·강퇴는 group.updated(멤버 user 포함), 이름 검증은 400', async () => {
    expect((await call('/groups/g_01', 'PATCH', { name: '가' })).status).toBe(400);
    expect((await call('/groups/g_01', 'PATCH', { name: '새 단골' })).status).toBe(200);
    expect(lastEmit()).toEqual([
      'group.updated',
      expect.objectContaining({ id: 'g_01', name: '새 단골', memberCount: 4 }),
    ]);
    expect((await call('/groups/g_01/members', 'POST', { userId: 'u_07' })).status).toBe(201);
    const [, invited] = lastEmit();
    const members = (invited as { members: { userId: string; user: { email?: string } }[] })
      .members;
    expect(members.map((m) => m.userId)).toContain('u_07');
    expect(members.every((m) => m.user.email === undefined)).toBe(true);
    expect((await call('/groups/g_01/members/u_07', 'DELETE')).status).toBe(204);
    expect(lastEmit()).toEqual([
      'group.updated',
      expect.objectContaining({ id: 'g_01', memberCount: 4 }),
    ]);
  });

  it('해산은 dissolved, 나가기는 left를 나에게 방송한다. owner가 아니면 403', async () => {
    expect((await call('/groups/g_02', 'DELETE')).status).toBe(403);
    expect((await call('/groups/g_02/members/u_05', 'DELETE')).status).toBe(403);
    expect((await call('/groups/g_02/members/u_me', 'DELETE')).status).toBe(204);
    expect(lastEmit()).toEqual(['group.removed', { groupId: 'g_02', reason: 'left' }]);
    expect((await call('/groups/g_01', 'DELETE')).status).toBe(204);
    expect(lastEmit()).toEqual(['group.removed', { groupId: 'g_01', reason: 'dissolved' }]);
    expect(((await (await call('/groups')).json()) as ListBody).items).toEqual([]);
  });

  it('가득 차면 409 GROUP_FULL', async () => {
    const group = state.groups.find((g) => g.id === 'g_01');
    if (group === undefined) throw new Error('seed g_01 missing');
    group.memberCount = 10;
    const res = await call('/groups/g_01/members', 'POST', { userId: 'u_09' });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'GROUP_FULL' });
  });
});

describe('DEV 트리거', () => {
  it('groupFrom은 멤버만, 안 읽음을 올리고 chat.group을 보낸다', async () => {
    expect(receiveGroupMessage('g_01', 'u_09', '비멤버')).toBeNull();
    expect(receiveGroupMessage('g_01', 'u_me', '나')).toBeNull();
    const message = receiveGroupMessage('g_01', 'u_01', '멤버 발화');
    expect(message).not.toBeNull();
    const [type, raw] = lastEmit();
    const payload = raw as { id: string; sender: { id: string } } | undefined;
    expect(type).toBe('chat.group');
    expect(payload?.id).toBe(message?.id);
    expect(payload?.sender.id).toBe('u_01');
    expect(await unreadOf('g_01')).toBe(2); // 시드(내 것 제외 1) + 1
  });

  it('inviteMe → group.joined와 목록, kickMe → group.removed kicked (owner인 그룹은 불가)', async () => {
    const groupId = inviteMe('새 모임');
    expect(lastEmit()).toEqual([
      'group.joined',
      expect.objectContaining({ id: groupId, name: '새 모임', memberCount: 2 }),
    ]);
    const names = ((await (await call('/groups')).json()) as ListBody).items.map((g) => g.name);
    expect(names).toContain('새 모임');
    expect(kickMe('g_01')).toBe(false);
    expect(kickMe(groupId)).toBe(true);
    expect(lastEmit()).toEqual(['group.removed', { groupId, reason: 'kicked' }]);
    expect(kickMe(groupId)).toBe(false);
    expect(seedGroup(groupId, 3)).toBe(0);
  });
});
