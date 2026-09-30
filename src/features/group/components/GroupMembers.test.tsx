import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Group, GroupDetail, GroupMember, UserProfile } from '@/domain';
import { signIn } from '@/features/chat/testing';
import type { GroupsData } from '@/store/groupCache';
import { queryClient } from '@/store/queryClient';
import { queryKeys } from '@/store/queryKeys';
import { useUiStore } from '@/store/uiStore';
import { ApiError } from '@/transport/http';

import { group, listItem, member, profile } from '../testing';
import { GroupMembers } from './GroupMembers';

const groupsApi = vi.hoisted(() => ({
  fetchGroupDetail: vi.fn<(id: string) => Promise<GroupDetail>>(),
  inviteGroupMember: vi.fn<(id: string, userId: string) => Promise<GroupMember>>(),
  removeGroupMember: vi.fn<(id: string, userId: string) => Promise<void>>(),
  renameGroup: vi.fn<(id: string, name: string) => Promise<Group>>(),
  dissolveGroup: vi.fn<(id: string) => Promise<void>>(),
}));
vi.mock('@/transport/api/groups', () => groupsApi);
const usersApi = vi.hoisted(() => ({
  getUserProfile: vi.fn(),
  searchUsers: vi.fn<(q: string) => Promise<{ items: UserProfile[] }>>(),
}));
vi.mock('@/transport/api/users', () => usersApi);

const onBack = vi.fn();

function renderMembers(detail: GroupDetail) {
  groupsApi.fetchGroupDetail.mockResolvedValue(detail);
  queryClient.setQueryData<GroupsData>(queryKeys.groups(), {
    items: [listItem('g1', { ...detail.group })],
  });
  useUiStore.getState().openGroup('g1');
  return render(
    <QueryClientProvider client={queryClient}>
      <GroupMembers groupId="g1" onBack={onBack} />
    </QueryClientProvider>,
  );
}

const ownerDetail = (extra: Partial<Group> = {}): GroupDetail => ({
  group: group('g1', { name: '단골', ...extra }),
  members: [member('u_01', '도트'), member('u_me', '데모', 'owner'), member('u_02', '픽셀')],
});

beforeEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
  useUiStore.getState().resetUi();
  signIn();
});

describe('GroupMembers — owner', () => {
  it('owner 먼저·나 표시, 강퇴는 남에게만, 초대 검색은 멤버를 빼고 보여준다', async () => {
    usersApi.searchUsers.mockResolvedValue({
      items: [profile('u_01', '도트'), profile('u_05', '타일')],
    });
    groupsApi.inviteGroupMember.mockResolvedValue({
      groupId: 'g1',
      userId: 'u_05',
      role: 'member',
      joinedAt: 3,
    });
    renderMembers(ownerDetail());
    const list = await screen.findByRole('list', { name: '멤버 목록' });
    await waitFor(() => {
      expect(
        within(list)
          .getAllByTestId('group-member')
          .map((li) => li.textContent),
      ).toEqual(['데모방장(나)', '도트강퇴', '픽셀강퇴']);
    });
    await userEvent.type(screen.getByRole('textbox', { name: '초대할 닉네임' }), '타');
    const results = await screen.findByRole('list', { name: '초대 검색 결과' });
    await waitFor(() => {
      expect(within(results).getAllByTestId('group-invite-result')).toHaveLength(1);
    });
    expect(results).toHaveTextContent('타일');
    expect(results).not.toHaveTextContent('도트');
    await userEvent.click(within(results).getByRole('button', { name: '초대' }));
    expect(groupsApi.inviteGroupMember).toHaveBeenCalledWith('g1', 'u_05');
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: '초대할 닉네임' })).toHaveValue('');
    });
  });

  it('GROUP_FULL이면 안내하고, 가득 찬 그룹은 초대 입력을 막는다', async () => {
    usersApi.searchUsers.mockResolvedValue({ items: [profile('u_05', '타일')] });
    groupsApi.inviteGroupMember.mockRejectedValue(new ApiError(409, 'GROUP_FULL', 'full'));
    const view = renderMembers(ownerDetail());
    await userEvent.type(await screen.findByRole('textbox', { name: '초대할 닉네임' }), '타');
    await userEvent.click(await screen.findByRole('button', { name: '초대' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('그룹 인원이 가득 찼어요.');
    view.unmount();
    queryClient.clear();
    renderMembers(ownerDetail({ memberCount: 10 }));
    const input = await screen.findByRole('textbox', { name: '초대할 닉네임' });
    await waitFor(() => {
      expect(input).toBeDisabled();
    });
    expect(input).toHaveAttribute('placeholder', '인원이 가득 찼어요');
  });

  it('이름 변경은 앞뒤 공백을 빼고 보내 목록 이름을 바꾸고, 해산은 한 번 더 확인한다', async () => {
    groupsApi.renameGroup.mockResolvedValue(group('g1', { name: '새 단골' }));
    groupsApi.dissolveGroup.mockResolvedValue(undefined);
    renderMembers(ownerDetail());
    const nameInput = await screen.findByRole('textbox', { name: '그룹 이름' });
    await waitFor(() => {
      expect(nameInput).toHaveValue('단골');
    });
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, ' 새 단골 ');
    await userEvent.click(screen.getByRole('button', { name: '이름 변경' }));
    expect(groupsApi.renameGroup).toHaveBeenCalledWith('g1', '새 단골');
    await waitFor(() => {
      expect(queryClient.getQueryData<GroupsData>(queryKeys.groups())?.items[0]?.name).toBe(
        '새 단골',
      );
    });
    await userEvent.click(screen.getByRole('button', { name: '그룹 해산' }));
    expect(groupsApi.dissolveGroup).not.toHaveBeenCalled();
    expect(screen.getByText(/되돌릴 수 없어요/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '해산 확정' }));
    expect(groupsApi.dissolveGroup).toHaveBeenCalledWith('g1');
    await waitFor(() => {
      expect(useUiStore.getState().groupId).toBeNull();
    });
    expect(queryClient.getQueryData<GroupsData>(queryKeys.groups())?.items).toEqual([]);
  });
});

describe('GroupMembers — 멤버', () => {
  it('강퇴·초대·이름 변경·해산 없이 나가기만, 확인 후 나가면 목록에서 빠지고 스레드가 닫힌다', async () => {
    groupsApi.removeGroupMember.mockResolvedValue(undefined);
    renderMembers({
      group: group('g1', { name: '레트로', ownerId: 'u_03' }),
      members: [member('u_03', '레트로', 'owner'), member('u_me', '데모')],
    });
    const list = await screen.findByRole('list', { name: '멤버 목록' });
    await waitFor(() => {
      expect(within(list).getAllByTestId('group-member')).toHaveLength(2);
    });
    expect(screen.queryByRole('button', { name: '강퇴' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: '초대할 닉네임' })).toBeNull();
    expect(screen.queryByRole('button', { name: '그룹 해산' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '그룹 나가기' }));
    await userEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(groupsApi.removeGroupMember).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '그룹 나가기' }));
    await userEvent.click(screen.getByRole('button', { name: '나가기 확정' }));
    expect(groupsApi.removeGroupMember).toHaveBeenCalledWith('g1', 'u_me');
    await waitFor(() => {
      expect(useUiStore.getState().groupId).toBeNull();
    });
    expect(useUiStore.getState().groupNotice).toBeNull();
  });
});
