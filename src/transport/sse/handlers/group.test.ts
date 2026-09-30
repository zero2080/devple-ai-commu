import { beforeEach, describe, expect, it } from 'vitest';

import type { GroupListItem } from '@/domain';
import { groupThreadKey, useChatStore } from '@/store/chatStore';
import type { GroupDetailData, GroupsData } from '@/store/groupCache';
import { queryClient } from '@/store/queryClient';
import { queryKeys } from '@/store/queryKeys';
import { useUiStore } from '@/store/uiStore';
import { useWorldStore } from '@/store/worldStore';

import { SseRegistry } from '../registry';
import { ALL_SSE_HANDLERS } from './index';

const registry = new SseRegistry();
registry.registerAll(ALL_SSE_HANDLERS);

const ME = 'u_me';
const user = (id: string) => ({
  id,
  nickname: `n-${id}`,
  avatarId: 'char_01',
  role: 'member',
  status: 'active',
  createdAt: 1,
});
const group = (id: string, name = `그룹-${id}`) => ({
  id,
  name,
  ownerId: ME,
  memberCount: 2,
  createdAt: 1,
});
const chatGroup = (id: string, groupId: string, senderId: string) => ({
  id,
  kind: 'group',
  groupId,
  senderId,
  content: `내용-${id}`,
  links: [],
  createdAt: 10,
  sender: user(senderId),
});
const dispatch = (type: string, payload: unknown) => {
  registry.dispatch({ id: '1', type, ts: 1, payload });
};
const list = () => queryClient.getQueryData<GroupsData>(queryKeys.groups())?.items ?? [];

beforeEach(() => {
  queryClient.clear();
  useChatStore.getState().reset();
  useUiStore.getState().resetUi();
  const world = useWorldStore.getState();
  world.reset();
  world.setMyUserId(ME);
  const items: GroupListItem[] = [
    { ...group('g1', '단골'), unreadCount: 0 },
    { ...group('g2'), unreadCount: 0 },
  ];
  queryClient.setQueryData<GroupsData>(queryKeys.groups(), { items });
});

describe('chat.group', () => {
  it('받은 메시지는 목록 안 읽음을 올리고 sender를 사용자 캐시에 두며 말풍선은 없다', () => {
    dispatch('chat.group', chatGroup('m1', 'g1', 'u_a'));
    expect(list()[0]).toMatchObject({ unreadCount: 1, lastMessage: { id: 'm1' } });
    expect(queryClient.getQueryData(queryKeys.user('u_a'))).toMatchObject({ nickname: 'n-u_a' });
    expect(useChatStore.getState().bubbles).toEqual([]);
  });

  it('내 에코는 같은 그룹·같은 본문의 pending을 해소한다 (다른 그룹 것은 그대로)', () => {
    const chat = useChatStore.getState();
    const mine = chat.addPendingThread(groupThreadKey('g1'), '내용-m2', 1);
    const other = chat.addPendingThread(groupThreadKey('g2'), '내용-m2', 1);
    dispatch('chat.group', chatGroup('m2', 'g1', ME));
    const left = useChatStore.getState().pendingThread.map((p) => p.tempId);
    expect(left).toEqual([other]);
    expect(left).not.toContain(mine);
    expect(list()[0]?.unreadCount).toBe(0);
  });

  it('내 사용자 id를 모르면(스냅샷 전) 무시한다', () => {
    useWorldStore.getState().reset();
    dispatch('chat.group', chatGroup('m3', 'g1', 'u_a'));
    expect(list()[0]?.unreadCount).toBe(0);
  });
});

describe('group.joined·group.updated', () => {
  it('초대되면 목록에 넣고 서버 목록을 다시 받는다', () => {
    dispatch('group.joined', group('g3'));
    expect(list().map((g) => g.id)).toEqual(['g3', 'g1', 'g2']);
    expect(queryClient.getQueryState(queryKeys.groups())?.isInvalidated).toBe(true);
  });

  it('updated는 목록과 상세를 교체한다', () => {
    dispatch('group.updated', {
      ...group('g1', '새 이름'),
      memberCount: 1,
      members: [{ groupId: 'g1', userId: ME, role: 'owner', joinedAt: 1, user: user(ME) }],
    });
    expect(list()[0]).toMatchObject({ name: '새 이름', memberCount: 1 });
    expect(queryClient.getQueryData<GroupDetailData>(queryKeys.groupDetail('g1'))?.members).toEqual(
      [{ groupId: 'g1', userId: ME, role: 'owner', joinedAt: 1 }],
    );
  });
});

describe('group.removed', () => {
  it('열어 둔 그룹에서 강퇴되면 스레드를 닫고 이름과 함께 안내하며 전송 중 항목을 버린다', () => {
    useUiStore.getState().openGroup('g1');
    useChatStore.getState().addPendingThread(groupThreadKey('g1'), '보내는 중', 1);
    dispatch('group.removed', { groupId: 'g1', reason: 'kicked' });
    expect(list().map((g) => g.id)).toEqual(['g2']);
    expect(useUiStore.getState()).toMatchObject({
      groupId: null,
      groupNotice: { name: '단골', reason: 'kicked' },
    });
    expect(useChatStore.getState().pendingThread).toEqual([]);
  });

  it('다른 그룹이 해산되면 열린 스레드는 그대로 두고 안내만 남긴다', () => {
    useUiStore.getState().openGroup('g2');
    dispatch('group.removed', { groupId: 'g1', reason: 'dissolved' });
    expect(useUiStore.getState()).toMatchObject({
      groupId: 'g2',
      groupNotice: { name: '단골', reason: 'dissolved' },
    });
  });

  it('left(내가 나감)와 이미 지운 그룹은 안내하지 않는다', () => {
    useUiStore.getState().openGroup('g1');
    dispatch('group.removed', { groupId: 'g1', reason: 'left' });
    expect(useUiStore.getState()).toMatchObject({ groupId: null, groupNotice: null });
    dispatch('group.removed', { groupId: 'g1', reason: 'dissolved' });
    expect(useUiStore.getState().groupNotice).toBeNull();
  });
});
