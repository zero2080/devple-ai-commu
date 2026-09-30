import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DmMessage, UserProfile } from '@/domain';
import { signIn, withWorld } from '@/features/chat/testing';
import { useChatStore } from '@/store/chatStore';
import { queryClient } from '@/store/queryClient';
import { queryKeys } from '@/store/queryKeys';
import { useWorldStore } from '@/store/worldStore';
import { TEST_APPEARANCE } from '@/test/fixtures';
import { ApiError } from '@/transport/http';

import { DmThread } from './DmThread';

interface Page {
  items: DmMessage[];
  nextCursor: string | null;
}

const dmApi = vi.hoisted(() => ({
  fetchDmMessages:
    vi.fn<(peerId: string, q: { cursor?: string; limit?: number }) => Promise<Page>>(),
  sendDm: vi.fn<(peerId: string, content: string) => Promise<DmMessage>>(),
  recallDm: vi.fn<(id: string) => Promise<void>>(),
  markDmRead: vi.fn<(peerId: string, last: string) => Promise<void>>(),
}));
vi.mock('@/transport/api/dm', () => dmApi);
const usersApi = vi.hoisted(() => ({
  getUserProfile: vi.fn<(id: string) => Promise<UserProfile>>(),
}));
vi.mock('@/transport/api/users', () => usersApi);

const msg = (id: string, senderId: string, createdAt: number, readAt?: number): DmMessage => ({
  id,
  kind: 'dm',
  conversationId: 'c1',
  senderId,
  content: `본문-${id}`,
  links: [],
  createdAt,
  ...(readAt === undefined ? {} : { readAt }),
});

function renderThread() {
  return render(
    <QueryClientProvider client={queryClient}>
      {withWorld(<DmThread peerId="u_01" />)}
    </QueryClientProvider>,
  );
}

/** 목록의 i번째 (없으면 테스트 실패) */
function at<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`no item at ${String(index)}`);
  return item;
}

beforeEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
  useChatStore.getState().reset();
  signIn();
  useWorldStore.getState().setMyUserId('u_me');
  queryClient.setQueryData(queryKeys.user('u_01'), {
    id: 'u_01',
    nickname: '도트',
    appearance: TEST_APPEARANCE,
    role: 'member',
    status: 'active',
    createdAt: 1,
  });
  dmApi.markDmRead.mockResolvedValue(undefined);
});

describe('DmThread', () => {
  it('오래된 것부터 보여주고, 내 메시지는 읽음 또는 회수 버튼, 열면 받은 최신 메시지를 읽음 처리한다', async () => {
    dmApi.fetchDmMessages.mockResolvedValue({
      items: [msg('m3', 'u_me', 30), msg('m2', 'u_01', 20), msg('m1', 'u_me', 10, 15)],
      nextCursor: null,
    });
    renderThread();
    const log = await screen.findByRole('log', { name: '도트와의 DM' });
    await waitFor(() => {
      expect(within(log).getAllByTestId('dm-message')).toHaveLength(3);
    });
    const items = within(log).getAllByTestId('dm-message');
    const [first, second, third] = [at(items, 0), at(items, 1), at(items, 2)];
    expect(first).toHaveTextContent('본문-m1');
    expect(first).toHaveTextContent('읽음');
    expect(second).toHaveTextContent('도트');
    expect(within(third).getByRole('button', { name: '회수' })).toBeInTheDocument();
    await waitFor(() => {
      expect(dmApi.markDmRead).toHaveBeenCalledWith('u_01', 'm2');
    });
  });

  it('회수에 성공하면 사라지고, 이미 읽혔으면(409) 안내한다', async () => {
    dmApi.fetchDmMessages.mockResolvedValue({
      items: [msg('m2', 'u_me', 20), msg('m1', 'u_me', 10)],
      nextCursor: null,
    });
    renderThread();
    await screen.findAllByRole('button', { name: '회수' });
    dmApi.recallDm.mockResolvedValueOnce(undefined);
    await userEvent.click(at(screen.getAllByRole('button', { name: '회수' }), 0));
    await waitFor(() => {
      expect(screen.queryByText('본문-m1')).toBeNull();
    });
    dmApi.recallDm.mockRejectedValueOnce(new ApiError(409, 'MESSAGE_ALREADY_READ', 'read'));
    await userEvent.click(screen.getByRole('button', { name: '회수' }));
    expect(await screen.findByText('상대가 이미 읽어서 회수할 수 없어요.')).toBeInTheDocument();
  });

  it('이전 메시지 버튼으로 다음 페이지(cursor)를 받는다', async () => {
    dmApi.fetchDmMessages
      .mockResolvedValueOnce({
        items: [msg('m3', 'u_01', 30, 31), msg('m2', 'u_01', 20, 21)],
        nextCursor: 'm2',
      })
      .mockResolvedValueOnce({ items: [msg('m1', 'u_01', 10, 11)], nextCursor: null });
    renderThread();
    await userEvent.click(await screen.findByRole('button', { name: '이전 메시지' }));
    await screen.findByText('본문-m1');
    expect(dmApi.fetchDmMessages).toHaveBeenLastCalledWith('u_01', { cursor: 'm2', limit: 50 });
    expect(screen.queryByRole('button', { name: '이전 메시지' })).toBeNull();
    expect(screen.getAllByTestId('dm-message').map((el) => el.textContent)).toEqual([
      expect.stringContaining('m1'),
      expect.stringContaining('m2'),
      expect.stringContaining('m3'),
    ]);
  });

  it('보내면 전송 중 → 확정되어 스레드에 한 번만 나온다', async () => {
    dmApi.fetchDmMessages.mockResolvedValue({ items: [], nextCursor: null });
    let resolveSend: (m: DmMessage) => void = () => undefined;
    dmApi.sendDm.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve;
      }),
    );
    renderThread();
    const input = await screen.findByRole('textbox', { name: '도트에게 DM' });
    await userEvent.type(input, '안녕{Enter}');
    expect(await screen.findByTestId('dm-pending')).toHaveTextContent('전송 중…');
    resolveSend({ ...msg('m9', 'u_me', 90), content: '안녕' });
    await waitFor(() => {
      expect(screen.queryByTestId('dm-pending')).toBeNull();
    });
    expect(screen.getAllByTestId('dm-message')).toHaveLength(1);
    expect(dmApi.sendDm).toHaveBeenCalledWith('u_01', '안녕');
  });
});
