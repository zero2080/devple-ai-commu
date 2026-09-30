import { useQuery } from '@tanstack/react-query';

import { totalGroupUnread, type GroupsData } from '@/store/groupCache';
import { queryKeys } from '@/store/queryKeys';
import { fetchGroups } from '@/transport/api/groups';

/** GET /groups (페이지네이션 없음). 항목에 사용자 객체가 없어 그대로 캐시한다 (ARCHITECTURE 7) */
export function useGroups() {
  return useQuery<GroupsData>({ queryKey: queryKeys.groups(), queryFn: fetchGroups });
}

/** 그룹 탭 배지: 목록 캐시에서 파생 (따로 저장하지 않음) */
export function useGroupUnreadTotal(): number {
  return totalGroupUnread(useGroups().data);
}
