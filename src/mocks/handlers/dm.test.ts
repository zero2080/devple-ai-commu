import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { readMyMessagesBy, receiveDmFrom, seedDm } from '../dmSim.ts';
import { resetMockState, state } from '../state.ts';
import { dmHandlers } from './dm.ts';

const bridge = vi.hoisted(() => ({
  emitViaExpress: vi.fn<(type: string, payload: unknown) => Promise<void>>(() => Promise.resolve()),
}));
vi.mock('../bridge.ts', () => ({ emitViaExpress: bridge.emitViaExpress }));

const server = setupServer(
  ...dmHandlers,
  http.post('*/__mock/emit', () => HttpResponse.json({})),
);
const AUTH = { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' };
const api = (path: string) => new URL(`/api/v1${path}`, location.href).toString();

interface PageBody {
  items: { id: string; senderId: string; content: string; readAt?: number }[];
  nextCursor: string | null;
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

describe('GET /dm/{userId}/messages 커서 페이지네이션', () => {
  it('최신순 limit개, nextCursor는 페이지의 가장 오래된 id, 다음 페이지는 그보다 오래된 것', async () => {
    seedDm('u_05', 60);
    const first = (await (
      await fetch(api('/dm/u_05/messages?limit=50'), { headers: AUTH })
    ).json()) as PageBody;
    expect(first.items).toHaveLength(50);
    expect(first.items[0]?.content).toBe('옛 메시지 60');
    expect(first.nextCursor).toBe(first.items.at(-1)?.id);
    const second = (await (
      await fetch(api(`/dm/u_05/messages?limit=50&cursor=${String(first.nextCursor)}`), {
        headers: AUTH,
      })
    ).json()) as PageBody;
    expect(second.items.map((m) => m.content)).toEqual(
      Array.from({ length: 10 }, (_, i) => `옛 메시지 ${String(10 - i)}`),
    );
    expect(second.nextCursor).toBeNull();
  });

  it('대화가 없으면 빈 페이지', async () => {
    const body = (await (
      await fetch(api('/dm/u_09/messages'), { headers: AUTH })
    ).json()) as PageBody;
    expect(body).toEqual({ items: [], nextCursor: null });
  });
});

describe('전송·회수는 emit 브리지로 방송한다', () => {
  it('보내면 내 에코 chat.dm(peerId = 상대)를, 미열람 회수는 chat.dm.recalled를 보낸다', async () => {
    const sent = (await (
      await fetch(api('/dm/u_07/messages'), {
        method: 'POST',
        headers: AUTH,
        body: JSON.stringify({ content: '안녕' }),
      })
    ).json()) as { id: string; conversationId: string };
    const [type, raw] = bridge.emitViaExpress.mock.calls[0] ?? [];
    const payload = raw as
      { id: string; peerId: string; sender: Record<string, unknown> } | undefined;
    expect(type).toBe('chat.dm');
    expect(payload).toMatchObject({ id: sent.id, peerId: 'u_07' });
    expect(payload?.sender.id).toBe(state.me.id);
    expect(payload?.sender).not.toHaveProperty('email'); // User만 (Me 정보 노출 금지)

    const recall = await fetch(api(`/dm/messages/${sent.id}/recall`), {
      method: 'POST',
      headers: AUTH,
    });
    expect(recall.status).toBe(204);
    expect(bridge.emitViaExpress).toHaveBeenLastCalledWith('chat.dm.recalled', {
      conversationId: sent.conversationId,
      messageId: sent.id,
    });
  });

  it('상대가 읽은 뒤에는 409 MESSAGE_ALREADY_READ', async () => {
    const sent = (await (
      await fetch(api('/dm/u_07/messages'), {
        method: 'POST',
        headers: AUTH,
        body: JSON.stringify({ content: '읽어줘' }),
      })
    ).json()) as { id: string };
    expect(readMyMessagesBy('u_07')).toBe(1);
    expect(bridge.emitViaExpress).toHaveBeenLastCalledWith(
      'chat.dm.read',
      expect.objectContaining({ readerId: 'u_07', lastMessageId: sent.id }),
    );
    const recall = await fetch(api(`/dm/messages/${sent.id}/recall`), {
      method: 'POST',
      headers: AUTH,
    });
    expect(recall.status).toBe(409);
    expect(await recall.json()).toMatchObject({ code: 'MESSAGE_ALREADY_READ' });
  });
});

describe('DEV 트리거', () => {
  it('dmFrom은 대화의 안 읽음을 올리고 chat.dm(peerId = 발신자)을 보낸다. 모르는 사용자는 null', () => {
    const message = receiveDmFrom('u_03', '안녕하세요');
    expect(message).not.toBeNull();
    expect(state.dmConversations.find((c) => c.participantIds.includes('u_03'))?.unreadCount).toBe(
      1,
    );
    expect(bridge.emitViaExpress).toHaveBeenCalledWith(
      'chat.dm',
      expect.objectContaining({ senderId: 'u_03', peerId: 'u_03' }),
    );
    expect(receiveDmFrom('nobody', 'x')).toBeNull();
    expect(readMyMessagesBy('nobody')).toBe(0);
    expect(seedDm('nobody', 3)).toBe(0);
  });
});
