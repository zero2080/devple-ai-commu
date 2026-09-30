import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GroupDetail, GroupListItem, GroupMessage, UserProfile } from '@/domain';
import { signIn, withWorld } from '@/features/chat/testing';
import { useChatStore } from '@/store/chatStore';
import type { GroupsData } from '@/store/groupCache';
import { queryClient } from '@/store/queryClient';
import { queryKeys } from '@/store/queryKeys';
import { useWorldStore } from '@/store/worldStore';
import { ApiError } from '@/transport/http';

import { group, groupMessage, listItem, member, user } from '../testing';
import { GroupThread } from './GroupThread';

interface Page {
  items: GroupMessage[];
  nextCursor: string | null;
}

const groupsApi = vi.hoisted(() => ({
  fetchGroups: vi.fn<() => Promise<{ items: GroupListItem[] }>>(),
  fetchGroupDetail: vi.fn<(id: string) => Promise<GroupDetail>>(),
  fetchGroupMessages:
    vi.fn<(id: string, q: { cursor?: string; limit?: number }) => Promise<Page>>(),
  sendGroupMessage: vi.fn<(id: string, content: string) => Promise<GroupMessage>>(),
  markGroupRead: vi.fn<(id: string, last: string) => Promise<void>>(),
}));
vi.mock('@/transport/api/groups', () => groupsApi);
const usersApi = vi.hoisted(() => ({
  getUserProfile: vi.fn<(id: string) => Promise<UserProfile>>(),
  searchUsers: vi.fn(),
}));
vi.mock('@/transport/api/users', () => usersApi);

function renderThread() {
  return render(
    <QueryClientProvider client={queryClient}>
      {withWorld(<GroupThread groupId="g1" />)}
    </QueryClientProvider>,
  );
}

function seedList(unreadCount: number): void {
  queryClient.setQueryData<GroupsData>(queryKeys.groups(), {
    items: [listItem('g1', { name: '단골', unreadCount })],
  });
  groupsApi.fetchGroups.mockResolvedValue({
    items: [listItem('g1', { name: '단골', unreadCount })],
  });
}

beforeEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
  useChatStore.getState().reset();
  signIn();
  useWorldStore.getState().setMyUserId('u_me');
  groupsApi.fetchGroupDetail.mockResolvedValue({
    group: group('g1', { name: '단골' }),
    members: [member('u_me', '데모', 'owner'), member('u_01', '도트')],
  });
  groupsApi.markGroupRead.mockResolvedValue(undefined);
  usersApi.getUserProfile.mockImplementation((id) =>
    Promise.resolve({ user: user(id, `떠난-${id}`), online: false }),
  );
});

describe('GroupThread', () => {
  it('오래된 것부터, 닉네임은 멤버(상세)에서 — 나간 사람만 따로 받는다. 안 읽음이 있으면 최신 id로 읽음 처리', async () => {
    seedList(2);
    groupsApi.fetchGroupMessages.mockResolvedValue({
      items: [
        groupMessage('m3', 'u_01', 30),
        groupMessage('m2', 'u_gone', 20),
        groupMessage('m1', 'u_me', 10),
      ],
      nextCursor: null,
    });
    renderThread();
    const log = await screen.findByRole('log', { name: '단골 그룹 대화' });
    await waitFor(() => {
      expect(
        within(log)
          .getAllByTestId('group-message')
          .map((li) => li.textContent),
      ).toEqual(['데모본문-m1', '떠난-u_gone본문-m2', '도트본문-m3']);
    });
    expect(usersApi.getUserProfile).toHaveBeenCalledTimes(1);
    expect(usersApi.getUserProfile).toHaveBeenCalledWith('u_gone');
    await waitFor(() => {
      expect(groupsApi.markGroupRead).toHaveBeenCalledWith('g1', 'm3');
    });
    expect(queryClient.getQueryData<GroupsData>(queryKeys.groups())?.items[0]?.unreadCount).toBe(0);
    expect(screen.getByRole('button', { name: '멤버 3명' })).toBeInTheDocument();
  });

  it('안 읽음이 없으면 읽음 요청을 보내지 않는다', async () => {
    seedList(0);
    groupsApi.fetchGroupMessages.mockResolvedValue({
      items: [groupMessage('m1', 'u_01', 10)],
      nextCursor: null,
    });
    renderThread();
    expect(await screen.findByText('본문-m1')).toBeInTheDocument();
    expect(groupsApi.markGroupRead).not.toHaveBeenCalled();
  });

  it('전송: 전송 중 → 201이면 한 번만 보이고, 실패하면 다시 보내기', async () => {
    seedList(0);
    groupsApi.fetchGroupMessages.mockResolvedValue({ items: [], nextCursor: null });
    groupsApi.sendGroupMessage
      .mockResolvedValueOnce({ ...groupMessage('m9', 'u_me', 90), content: '안녕' })
      .mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN', 'not a member'));
    renderThread();
    const input = await screen.findByRole('textbox', { name: '단골 그룹에 메시지' });
    await userEvent.type(input, '안녕{Enter}');
    await waitFor(() => {
      expect(screen.getAllByTestId('group-message')).toHaveLength(1);
    });
    expect(screen.queryByTestId('group-pending')).toBeNull();
    await userEvent.type(input, '실패{Enter}');
    const failed = await screen.findByTestId('group-pending');
    expect(failed).toHaveAttribute('data-status', 'failed');
    expect(within(failed).getByRole('alert')).toHaveTextContent('권한이 없어요.');
    expect(within(failed).getByRole('button', { name: '다시 보내기' })).toBeInTheDocument();
  });

  it('멤버 버튼 → 멤버 화면, ← 대화로 돌아온다', async () => {
    seedList(0);
    groupsApi.fetchGroupMessages.mockResolvedValue({ items: [], nextCursor: null });
    renderThread();
    await userEvent.click(await screen.findByRole('button', { name: '멤버 3명' }));
    expect(await screen.findByRole('region', { name: '단골 멤버' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '← 대화' }));
    expect(await screen.findByRole('log', { name: '단골 그룹 대화' })).toBeInTheDocument();
  });
});
