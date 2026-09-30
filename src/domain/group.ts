// 그룹 규칙 (PRD 5.6, DOMAIN 5.4, API_CONTRACT 2.7). 순수 함수
import type { Group, GroupListItem, GroupMember } from './types';

const GROUP_NAME_MIN = 2;
const GROUP_NAME_MAX = 20;

/** 이름 검증: 앞뒤 공백을 뺀 코드 포인트 2~20. 문제없으면 null (서버 details.fields.name과 같은 값) */
export function groupNameError(name: string): 'length' | null {
  const length = Array.from(name.trim()).length;
  return length < GROUP_NAME_MIN || length > GROUP_NAME_MAX ? 'length' : null;
}

/** 최근 활동 시각: 마지막 메시지, 없으면 만든 시각 */
export function groupActivityAt(item: Pick<GroupListItem, 'createdAt' | 'lastMessage'>): number {
  return item.lastMessage?.createdAt ?? item.createdAt;
}

/** 목록 정렬: 최근 활동순, 같으면 id (API_CONTRACT 2.7과 같은 규칙). 캐시에 직접 넣은 항목(만들기·초대·새 메시지)도 같은 순서로 보이게 다시 정렬한다 */
export function sortGroupsByActivity<
  T extends Pick<GroupListItem, 'id' | 'createdAt' | 'lastMessage'>,
>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => groupActivityAt(b) - groupActivityAt(a) || a.id.localeCompare(b.id),
  );
}

/** owner만 초대·강퇴·이름 변경·해산 (DOMAIN 5.4) */
export function isGroupOwner(group: Pick<Group, 'ownerId'>, userId: string): boolean {
  return group.ownerId === userId;
}

/** 인원 상한 (ServerConfig.maxGroupMembers) */
export function isGroupFull(group: Pick<Group, 'memberCount'>, maxMembers: number): boolean {
  return group.memberCount >= maxMembers;
}

/** 멤버 표시 순서: owner 먼저, 그다음 가입순, 같으면 userId 순 */
export function sortGroupMembers<T extends Pick<GroupMember, 'userId' | 'role' | 'joinedAt'>>(
  members: readonly T[],
): T[] {
  const rank = (m: T): number => (m.role === 'owner' ? 0 : 1);
  return [...members].sort(
    (a, b) => rank(a) - rank(b) || a.joinedAt - b.joinedAt || a.userId.localeCompare(b.userId),
  );
}
