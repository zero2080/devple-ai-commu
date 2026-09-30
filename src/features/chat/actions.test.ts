import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PublicMessage } from '@/domain';
import { useChatStore } from '@/store/chatStore';
import { ApiError } from '@/transport/http';

import { dismissPublic, retryPublic, sendPublic } from './actions';
import { signIn } from './testing';

const api = vi.hoisted(() => ({
  sendPublicMessage: vi.fn<(content: string) => Promise<PublicMessage>>(),
}));
vi.mock('@/transport/api/chat', () => ({ sendPublicMessage: api.sendPublicMessage }));

const reply = (content: string): PublicMessage => ({
  id: 'pm_1',
  kind: 'public',
  senderId: 'u_me',
  content,
  links: [],
  createdAt: 1,
  position: { mapId: 'main', x: 20, y: 15, dir: 'down' },
});

beforeEach(() => {
  api.sendPublicMessage.mockReset();
  useChatStore.getState().reset();
  signIn();
});

describe('sendPublic', () => {
  it('성공하면 pending이 로그 항목(내 닉네임)으로 확정된다', async () => {
    api.sendPublicMessage.mockResolvedValue(reply('안녕'));
    await sendPublic('안녕');
    expect(useChatStore.getState().pendingPublic).toEqual([]);
    expect(useChatStore.getState().publicLog[0]).toMatchObject({
      id: 'pm_1',
      senderNickname: '데모',
    });
  });

  it('ApiError면 코드를, 그 외면 NETWORK를 남기고 failed가 된다', async () => {
    api.sendPublicMessage.mockRejectedValueOnce(new ApiError(429, 'RATE_LIMITED', 'slow'));
    await sendPublic('하나');
    api.sendPublicMessage.mockRejectedValueOnce(new TypeError('offline'));
    await sendPublic('둘');
    expect(useChatStore.getState().pendingPublic.map((p) => [p.status, p.errorCode])).toEqual([
      ['failed', 'RATE_LIMITED'],
      ['failed', 'NETWORK'],
    ]);
  });

  it('실패한 항목만 다시 보내고, 지우기는 실패 항목을 없앤다', async () => {
    api.sendPublicMessage.mockRejectedValueOnce(new ApiError(500, 'INTERNAL', 'x'));
    await sendPublic('다시');
    const tempId = useChatStore.getState().pendingPublic[0]?.tempId ?? '';
    api.sendPublicMessage.mockResolvedValueOnce(reply('다시'));
    await retryPublic(tempId);
    expect(api.sendPublicMessage).toHaveBeenLastCalledWith('다시');
    expect(useChatStore.getState().pendingPublic).toEqual([]);

    api.sendPublicMessage.mockRejectedValueOnce(new ApiError(500, 'INTERNAL', 'x'));
    await sendPublic('버림');
    const failedId = useChatStore.getState().pendingPublic[0]?.tempId ?? '';
    dismissPublic(failedId);
    expect(useChatStore.getState().pendingPublic).toEqual([]);
    await retryPublic('없는-id'); // 무시
    expect(api.sendPublicMessage).toHaveBeenCalledTimes(3);
  });
});
