// 그룹 Query 캐시 갱신 (ARCHITECTURE 7장). SSE 핸들러(transport)와 액션(features)이 함께 쓴다.
// 목록 항목(GroupListItem)은 사용자 객체가 없어 그대로 두고, 상세의 members[].user와 이벤트의 sender는
// 사용자 캐시로 분해한다 (DOMAIN 9 이중 저장 금지).
import type { QueryClient } from '@tanstack/react-query';

import type {
  Group,
  GroupDetail,
  GroupListItem,
  GroupMember,
  GroupMemberWithUser,
  GroupMessage,
} from '@/domain';

import { queryKeys } from './queryKeys';
import { prependToThread, threadHas, type ThreadPages } from './threadCache';
import { rememberUser } from './userCache';

export interface GroupsData {
  items: GroupListItem[];
}

/** 상세 캐시: 멤버는 기본 엔티티만 */
export interface GroupDetailData {
  group: Group;
  members: GroupMember[];
}

export type GroupThreadData = ThreadPages<GroupMessage>;

function baseGroup(group: Group): Group {
  return {
    id: group.id,
    name: group.name,
    ownerId: group.ownerId,
    memberCount: group.memberCount,
    createdAt: group.createdAt,
  };
}

function baseMessage(message: GroupMessage): GroupMessage {
  return {
    id: message.id,
    kind: 'group',
    groupId: message.groupId,
    senderId: message.senderId,
    content: message.content,
    links: message.links,
    createdAt: message.createdAt,
  };
}

function splitMembers(qc: QueryClient, members: readonly GroupMemberWithUser[]): GroupMember[] {
  return members.map(({ user, ...member }) => {
    rememberUser(qc, user);
    return member;
  });
}

/** GET /groups/{id} 응답을 상세 캐시 형태로 (멤버 user → 사용자 캐시) */
export function splitGroupDetail(qc: QueryClient, detail: GroupDetail): GroupDetailData {
  return { group: baseGroup(detail.group), members: splitMembers(qc, detail.members) };
}

/**
 * 새 메시지 반영 (받은 것·보낸 것 공통). 스레드 캐시가 있으면 첫 페이지 앞에 추가(id 중복 제거),
 * 목록의 lastMessage를 갱신하고 남이 보낸 새 메시지면 안 읽음 +1. 목록에 없는 그룹이면 목록을 다시 받는다
 */
export function upsertGroupMessage(qc: QueryClient, input: GroupMessage, myUserId: string): void {
  const message = baseMessage(input);
  const thread = qc.getQueryData<GroupThreadData>(queryKeys.groupThread(message.groupId));
  const seenInThread = thread !== undefined && threadHas(thread, message.id);
  qc.setQueryData<GroupThreadData>(queryKeys.groupThread(message.groupId), (old) =>
    prependToThread(old, message),
  );

  const listed = qc.getQueryData<GroupsData>(queryKeys.groups());
  if (listed !== undefined && !listed.items.some((g) => g.id === message.groupId)) {
    void qc.invalidateQueries({ queryKey: queryKeys.groups() });
    return;
  }
  qc.setQueryData<GroupsData>(queryKeys.groups(), (old) =>
    old === undefined
      ? old
      : {
          items: old.items.map((group) => {
            if (group.id !== message.groupId) {
              return group;
            }
            const duplicate = seenInThread || group.lastMessage?.id === message.id;
            if (duplicate) {
              return group;
            }
            const newer =
              group.lastMessage === undefined || group.lastMessage.createdAt <= message.createdAt;
            return {
              ...group,
              ...(newer ? { lastMessage: message } : {}),
              unreadCount: group.unreadCount + (message.senderId === myUserId ? 0 : 1),
            };
          }),
        },
  );
}

/** 만든 그룹(POST /groups 201)은 이벤트가 없으므로 목록에 직접 넣는다 */
export function addCreatedGroup(qc: QueryClient, group: Group): void {
  qc.setQueryData<GroupsData>(queryKeys.groups(), (old) =>
    old === undefined || old.items.some((g) => g.id === group.id)
      ? old
      : { items: [{ ...baseGroup(group), unreadCount: 0 }, ...old.items] },
  );
}

/** 초대됨 (group.joined): 안 읽음 수를 알 수 없어 목록에 먼저 넣고 서버 목록을 다시 받는다 */
export function applyGroupJoined(qc: QueryClient, group: Group): void {
  addCreatedGroup(qc, group);
  void qc.invalidateQueries({ queryKey: queryKeys.groups() });
}

/** 그룹 정보 변경 (PATCH 200 응답 또는 group.updated): 목록 항목과 상세의 group을 맞춘다 */
export function applyGroupInfo(qc: QueryClient, group: Group): void {
  const next = baseGroup(group);
  qc.setQueryData<GroupsData>(queryKeys.groups(), (old) =>
    old === undefined
      ? old
      : {
          items: old.items.map((g) =>
            g.id === next.id
              ? {
                  ...g,
                  name: next.name,
                  ownerId: next.ownerId,
                  memberCount: next.memberCount,
                }
              : g,
          ),
        },
  );
  qc.setQueryData<GroupDetailData>(queryKeys.groupDetail(next.id), (old) =>
    old === undefined ? old : { ...old, group: next },
  );
}

/** group.updated: 이름·owner·인원·멤버 교체 (멤버 user → 사용자 캐시) */
export function applyGroupUpdated(
  qc: QueryClient,
  event: Group & { members: readonly GroupMemberWithUser[] },
): void {
  applyGroupInfo(qc, event);
  qc.setQueryData<GroupDetailData>(queryKeys.groupDetail(event.id), {
    group: baseGroup(event),
    members: splitMembers(qc, event.members),
  });
}

/** 강퇴·해산·나가기: 목록에서 빼고 상세·스레드 캐시를 지운다. 빠진 목록 항목을 돌려준다 (안내 문구용) */
export function removeGroup(qc: QueryClient, groupId: string): GroupListItem | undefined {
  const removed = qc
    .getQueryData<GroupsData>(queryKeys.groups())
    ?.items.find((g) => g.id === groupId);
  qc.setQueryData<GroupsData>(queryKeys.groups(), (old) =>
    old === undefined ? old : { items: old.items.filter((g) => g.id !== groupId) },
  );
  qc.removeQueries({ queryKey: queryKeys.groupDetail(groupId) });
  qc.removeQueries({ queryKey: queryKeys.groupThread(groupId) });
  return removed;
}

/** 내가 스레드를 읽음: 목록의 안 읽음 0 (서버에는 POST /groups/{id}/read) */
export function markGroupReadLocal(qc: QueryClient, groupId: string): void {
  qc.setQueryData<GroupsData>(queryKeys.groups(), (old) =>
    old === undefined
      ? old
      : { items: old.items.map((g) => (g.id === groupId ? { ...g, unreadCount: 0 } : g)) },
  );
}

/** 탭 배지용: 목록 캐시에서 파생 (별도 저장 없음) */
export function totalGroupUnread(data: GroupsData | undefined): number {
  return data?.items.reduce((sum, g) => sum + g.unreadCount, 0) ?? 0;
}
