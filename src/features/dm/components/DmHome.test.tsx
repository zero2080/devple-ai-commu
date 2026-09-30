import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DmConversationWithPeer, UserProfile } from '@/domain';
import { signIn } from '@/features/chat/testing';
import { queryClient } from '@/store/queryClient';
import { useUiStore } from '@/store/uiStore';

import { DmHome } from './DmHome';

const dmApi = vi.hoisted(() => ({
  fetchDmConversations:
    vi.fn<
      (cursor?: string) => Promise<{ items: DmConversationWithPeer[]; nextCursor: string | null }>
    >(),
}));
vi.mock('@/transport/api/dm', () => dmApi);
const usersApi = vi.hoisted(() => ({
  searchUsers: vi.fn<(q: string) => Promise<{ items: UserProfile[] }>>(),
  getUserProfile: vi.fn(),
}));
vi.mock('@/transport/api/users', () => usersApi);

const peer = (id: string, nickname: string) => ({
  id,
  nickname,
  avatarId: 'char_01',
  role: 'member' as const,
  status: 'active' as const,
  createdAt: 1,
});

/** 목록의 i번째 (없으면 테스트 실패) */
function at<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`no item at ${String(index)}`);
  return item;
}

beforeEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
  useUiStore.getState().resetUi();
  signIn();
});

function renderHome() {
  return render(
    <QueryClientProvider client={queryClient}>
      <DmHome />
    </QueryClientProvider>,
  );
}

describe('DmHome', () => {
  it('대화 목록은 상대 닉네임·마지막 메시지(내 것은 "나:")·안 읽음을 보여주고 누르면 스레드를 연다', async () => {
    dmApi.fetchDmConversations.mockResolvedValue({
      items: [
        {
          id: 'c1',
          participantIds: ['u_me', 'u_01'],
          unreadCount: 2,
          updatedAt: 2,
          lastMessage: {
            id: 'm',
            kind: 'dm',
            conversationId: 'c1',
            senderId: 'u_01',
            content: '안녕',
            links: [],
            createdAt: 2,
          },
          peer: peer('u_01', '도트'),
        },
        {
          id: 'c2',
          participantIds: ['u_me', 'u_02'],
          unreadCount: 0,
          updatedAt: 1,
          lastMessage: {
            id: 'n',
            kind: 'dm',
            conversationId: 'c2',
            senderId: 'u_me',
            content: '잘 가요',
            links: [],
            createdAt: 1,
          },
          peer: peer('u_02', '픽셀'),
        },
      ],
      nextCursor: null,
    });
    renderHome();
    const list = await screen.findByRole('list', { name: 'DM 대화 목록' });
    const rows = await within(list).findAllByTestId('dm-conversation');
    expect(rows[0]).toHaveTextContent('도트');
    expect(rows[0]).toHaveTextContent('안녕');
    expect(within(at(rows, 0)).getByLabelText('안 읽음 2')).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent('나: 잘 가요');
    await userEvent.click(at(rows, 1));
    expect(useUiStore.getState().dmPeerId).toBe('u_02');
  });

  it('닉네임 검색 결과에서 고르면 그 상대와의 스레드를 연다', async () => {
    dmApi.fetchDmConversations.mockResolvedValue({ items: [], nextCursor: null });
    usersApi.searchUsers.mockResolvedValue({
      items: [{ user: peer('u_03', '레트로'), online: false }],
    });
    renderHome();
    expect(await screen.findByText(/아직 대화가 없어요/)).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: '닉네임 검색' }), '레트');
    const result = await screen.findByTestId('dm-search-result');
    expect(result).toHaveTextContent('레트로');
    expect(result).toHaveTextContent('오프라인');
    await userEvent.click(result);
    expect(useUiStore.getState()).toMatchObject({ dmPeerId: 'u_03', chatTab: 'dm' });
  });
});
