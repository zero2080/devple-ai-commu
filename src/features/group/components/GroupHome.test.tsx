import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Group, GroupListItem, UserProfile } from '@/domain';
import { signIn } from '@/features/chat/testing';
import type { GroupsData } from '@/store/groupCache';
import { queryClient } from '@/store/queryClient';
import { queryKeys } from '@/store/queryKeys';
import { useUiStore } from '@/store/uiStore';

import { group, groupMessage, listItem, user } from '../testing';
import { GroupHome } from './GroupHome';

const groupsApi = vi.hoisted(() => ({
  fetchGroups: vi.fn<() => Promise<{ items: GroupListItem[] }>>(),
  createGroup: vi.fn<(name: string) => Promise<Group>>(),
}));
vi.mock('@/transport/api/groups', () => groupsApi);
const usersApi = vi.hoisted(() => ({
  getUserProfile: vi.fn<(id: string) => Promise<UserProfile>>(),
  searchUsers: vi.fn(),
}));
vi.mock('@/transport/api/users', () => usersApi);

beforeEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
  useUiStore.getState().resetUi();
  signIn();
  usersApi.getUserProfile.mockImplementation((id) =>
    Promise.resolve({ user: user(id, `닉-${id}`), online: true }),
  );
});

function renderHome() {
  return render(
    <QueryClientProvider client={queryClient}>
      <GroupHome />
    </QueryClientProvider>,
  );
}

describe('GroupHome', () => {
  it('최근 활동순으로 이름·인원·마지막 메시지(보낸 사람)·안 읽음을 보여주고 누르면 스레드를 연다', async () => {
    groupsApi.fetchGroups.mockResolvedValue({
      items: [
        listItem('g1', { name: '조용한 방', createdAt: 5 }),
        listItem('g2', {
          name: '수다방',
          memberCount: 4,
          unreadCount: 2,
          lastMessage: groupMessage('m1', 'u_01', 50, 'g2'),
        }),
        listItem('g3', { name: '내가 마지막', lastMessage: groupMessage('m2', 'u_me', 40, 'g3') }),
      ],
    });
    renderHome();
    const rows = await screen.findAllByTestId('group-row');
    expect(rows.map((r) => within(r).getByText(/방|마지막/).textContent)).toEqual([
      '수다방',
      '내가 마지막',
      '조용한 방',
    ]);
    const [first] = rows;
    if (first === undefined) throw new Error('no rows');
    expect(first).toHaveTextContent('4명');
    expect(await within(first).findByText('닉-u_01: 본문-m1')).toBeInTheDocument();
    expect(within(first).getByLabelText('안 읽음 2')).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent('나: 본문-m2');
    expect(rows[2]).toHaveTextContent('아직 메시지가 없어요');
    await userEvent.click(first);
    expect(useUiStore.getState()).toMatchObject({ chatTab: 'group', groupId: 'g2' });
  });

  it('만들기: 이름이 짧으면 요청 없이 안내, 맞으면 앞뒤 공백을 빼고 만들어 목록에 넣고 연다', async () => {
    groupsApi.fetchGroups.mockResolvedValue({ items: [] });
    groupsApi.createGroup.mockResolvedValue(group('g9', { name: '새 모임', memberCount: 1 }));
    renderHome();
    expect(await screen.findByText(/아직 그룹이 없어요/)).toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: '새 그룹 이름' });
    await userEvent.type(input, ' 가 {Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('2~20자');
    expect(groupsApi.createGroup).not.toHaveBeenCalled();
    await userEvent.clear(input);
    await userEvent.type(input, '  새 모임 ');
    await userEvent.click(screen.getByRole('button', { name: '만들기' }));
    expect(groupsApi.createGroup).toHaveBeenCalledWith('새 모임');
    expect(useUiStore.getState().groupId).toBe('g9');
    expect(queryClient.getQueryData<GroupsData>(queryKeys.groups())?.items).toEqual([
      { ...group('g9', { name: '새 모임', memberCount: 1 }), unreadCount: 0 },
    ]);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(input).toHaveValue('');
  });

  it('그룹에서 빠졌으면 이름과 이유를 안내하고 닫을 수 있다', async () => {
    groupsApi.fetchGroups.mockResolvedValue({ items: [] });
    useUiStore.getState().leaveGroupView('g1', { name: '단골', reason: 'kicked' });
    renderHome();
    expect(screen.getByRole('status')).toHaveTextContent('‘단골’ 그룹에서 강퇴됐어요');
    await userEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('status')).toBeNull();
    useUiStore.getState().leaveGroupView('g2', { name: '모임', reason: 'dissolved' });
    expect(await screen.findByRole('status')).toHaveTextContent('‘모임’ 그룹이 해산됐어요');
  });
});
