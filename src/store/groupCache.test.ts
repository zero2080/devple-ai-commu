import { beforeEach, describe, expect, it } from 'vitest';

import type { Group, GroupListItem, GroupMemberWithUser, GroupMessage, User } from '@/domain';
import { TEST_APPEARANCE } from '@/test/fixtures';

import {
  addCreatedGroup,
  applyGroupInfo,
  applyGroupJoined,
  applyGroupUpdated,
  markGroupReadLocal,
  removeGroup,
  splitGroupDetail,
  totalGroupUnread,
  upsertGroupMessage,
  type GroupDetailData,
  type GroupsData,
  type GroupThreadData,
} from './groupCache';
import { createQueryClient } from './queryClient';
import { queryKeys } from './queryKeys';

const ME = 'u_me';
let qc = createQueryClient();

const user = (id: string): User => ({
  id,
  nickname: `n-${id}`,
  appearance: TEST_APPEARANCE,
  role: 'member',
  status: 'active',
  createdAt: 1,
});
const group = (id: string, extra: Partial<Group> = {}): Group => ({
  id,
  name: `그룹-${id}`,
  ownerId: ME,
  memberCount: 2,
  createdAt: 1,
  ...extra,
});
const item = (id: string, extra: Partial<GroupListItem> = {}): GroupListItem => ({
  ...group(id),
  unreadCount: 0,
  ...extra,
});
const msg = (id: string, groupId: string, senderId: string, createdAt: number): GroupMessage => ({
  id,
  kind: 'group',
  groupId,
  senderId,
  content: `본문-${id}`,
  links: [],
  createdAt,
});
const member = (
  groupId: string,
  userId: string,
  role: 'owner' | 'member',
): GroupMemberWithUser => ({
  groupId,
  userId,
  role,
  joinedAt: 1,
  user: user(userId),
});

const list = () => qc.getQueryData<GroupsData>(queryKeys.groups())?.items ?? [];
const thread = (groupId: string) =>
  qc
    .getQueryData<GroupThreadData>(queryKeys.groupThread(groupId))
    ?.pages[0]?.items.map((m) => m.id);

function seedThread(groupId: string, messages: GroupMessage[]): void {
  qc.setQueryData<GroupThreadData>(queryKeys.groupThread(groupId), {
    pages: [{ items: messages, nextCursor: 'older' }],
    pageParams: [undefined],
  });
}

beforeEach(() => {
  qc = createQueryClient();
  qc.setQueryData<GroupsData>(queryKeys.groups(), {
    items: [item('g1', { lastMessage: msg('m1', 'g1', 'u_a', 10) }), item('g2')],
  });
});

describe('upsertGroupMessage', () => {
  it('받은 메시지: 스레드 첫 페이지 앞에 추가, 목록 lastMessage 갱신, 안 읽음 +1. 이벤트의 sender는 버린다', () => {
    seedThread('g1', [msg('m1', 'g1', 'u_a', 10)]);
    upsertGroupMessage(
      qc,
      { ...msg('m2', 'g1', 'u_b', 20), sender: user('u_b') } as GroupMessage,
      ME,
    );
    expect(thread('g1')).toEqual(['m2', 'm1']);
    const first = qc.getQueryData<GroupThreadData>(queryKeys.groupThread('g1'))?.pages[0];
    expect(first?.nextCursor).toBe('older');
    expect(first?.items[0]).not.toHaveProperty('sender');
    expect(list()[0]).toMatchObject({ id: 'g1', unreadCount: 1, lastMessage: { id: 'm2' } });
  });

  it('내 메시지는 안 읽음을 올리지 않고, 201과 에코로 두 번 와도 한 번만 반영한다', () => {
    seedThread('g2', []);
    upsertGroupMessage(qc, msg('m3', 'g2', ME, 30), ME);
    upsertGroupMessage(qc, msg('m3', 'g2', ME, 30), ME);
    expect(thread('g2')).toEqual(['m3']);
    expect(list()[1]).toMatchObject({ id: 'g2', unreadCount: 0, lastMessage: { id: 'm3' } });
  });

  it('스레드 캐시가 없어도 목록은 갱신하고, 같은 받은 메시지를 다시 받으면(재전송) 한 번만 센다', () => {
    upsertGroupMessage(qc, msg('m4', 'g2', 'u_a', 40), ME);
    upsertGroupMessage(qc, msg('m4', 'g2', 'u_a', 40), ME);
    expect(thread('g2')).toBeUndefined();
    expect(list()[1]).toMatchObject({ unreadCount: 1, lastMessage: { id: 'm4' } });
  });

  it('늦게 도착한 옛 메시지는 안 읽음만 올리고 lastMessage는 최신을 지킨다', () => {
    upsertGroupMessage(qc, msg('m0', 'g1', 'u_a', 5), ME);
    expect(list()[0]).toMatchObject({ unreadCount: 1, lastMessage: { id: 'm1' } });
  });

  it('목록에 없는 그룹이면 목록을 다시 받는다', () => {
    upsertGroupMessage(qc, msg('m9', 'g9', 'u_a', 90), ME);
    expect(qc.getQueryState(queryKeys.groups())?.isInvalidated).toBe(true);
  });
});

describe('만든 그룹·초대·변경·제거', () => {
  it('addCreatedGroup은 맨 앞에 안 읽음 0으로 넣고 중복은 무시한다', () => {
    addCreatedGroup(qc, group('g3'));
    addCreatedGroup(qc, group('g3'));
    expect(list().map((g) => g.id)).toEqual(['g3', 'g1', 'g2']);
    expect(list()[0]).toEqual({ ...group('g3'), unreadCount: 0 });
  });

  it('applyGroupJoined는 목록에 넣고 서버 목록을 다시 받는다', () => {
    applyGroupJoined(qc, group('g4', { ownerId: 'u_x' }));
    expect(list()[0]?.id).toBe('g4');
    expect(qc.getQueryState(queryKeys.groups())?.isInvalidated).toBe(true);
  });

  it('applyGroupUpdated는 목록의 이름·owner·인원과 상세를 바꾸고 멤버 user를 사용자 캐시로 보낸다', () => {
    applyGroupUpdated(qc, {
      ...group('g1', { name: '새 이름', ownerId: 'u_a', memberCount: 3 }),
      members: [
        member('g1', 'u_a', 'owner'),
        member('g1', ME, 'member'),
        member('g1', 'u_b', 'member'),
      ],
    });
    expect(list()[0]).toMatchObject({
      name: '새 이름',
      ownerId: 'u_a',
      memberCount: 3,
      unreadCount: 0,
      lastMessage: { id: 'm1' },
    });
    const detail = qc.getQueryData<GroupDetailData>(queryKeys.groupDetail('g1'));
    expect(detail?.group.name).toBe('새 이름');
    expect(detail?.members.map((m) => m.userId)).toEqual(['u_a', ME, 'u_b']);
    expect(detail?.members[0]).not.toHaveProperty('user');
    expect(qc.getQueryData(queryKeys.user('u_b'))).toEqual(user('u_b'));
  });

  it('applyGroupInfo(PATCH 응답)는 상세가 없으면 만들지 않는다', () => {
    applyGroupInfo(qc, group('g2', { name: '바뀐 이름' }));
    expect(list()[1]?.name).toBe('바뀐 이름');
    expect(qc.getQueryData(queryKeys.groupDetail('g2'))).toBeUndefined();
    qc.setQueryData<GroupDetailData>(queryKeys.groupDetail('g2'), {
      group: group('g2'),
      members: [],
    });
    applyGroupInfo(qc, group('g2', { name: '또 바뀜' }));
    expect(qc.getQueryData<GroupDetailData>(queryKeys.groupDetail('g2'))?.group.name).toBe(
      '또 바뀜',
    );
  });

  it('removeGroup은 목록에서 빼고 상세·스레드를 지우며 빠진 항목을 돌려준다', () => {
    seedThread('g1', [msg('m1', 'g1', 'u_a', 10)]);
    qc.setQueryData<GroupDetailData>(queryKeys.groupDetail('g1'), {
      group: group('g1'),
      members: [],
    });
    expect(removeGroup(qc, 'g1')?.name).toBe('그룹-g1');
    expect(list().map((g) => g.id)).toEqual(['g2']);
    expect(qc.getQueryData(queryKeys.groupDetail('g1'))).toBeUndefined();
    expect(thread('g1')).toBeUndefined();
    expect(removeGroup(qc, 'g1')).toBeUndefined();
  });

  it('splitGroupDetail은 멤버 user를 분해한다', () => {
    const detail = splitGroupDetail(qc, {
      group: { ...group('g1'), extra: 'x' } as Group,
      members: [member('g1', 'u_c', 'member')],
    });
    expect(detail).toEqual({
      group: group('g1'),
      members: [{ groupId: 'g1', userId: 'u_c', role: 'member', joinedAt: 1 }],
    });
    expect(qc.getQueryData(queryKeys.user('u_c'))).toEqual(user('u_c'));
  });
});

describe('읽음·배지', () => {
  it('markGroupReadLocal은 그 그룹만 0으로, totalGroupUnread는 목록에서 합계를 낸다', () => {
    upsertGroupMessage(qc, msg('a', 'g1', 'u_a', 11), ME);
    upsertGroupMessage(qc, msg('b', 'g2', 'u_a', 12), ME);
    upsertGroupMessage(qc, msg('c', 'g2', 'u_a', 13), ME);
    expect(totalGroupUnread(qc.getQueryData(queryKeys.groups()))).toBe(3);
    markGroupReadLocal(qc, 'g2');
    expect(totalGroupUnread(qc.getQueryData(queryKeys.groups()))).toBe(1);
    expect(totalGroupUnread(undefined)).toBe(0);
  });
});
