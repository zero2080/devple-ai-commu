import { useInfiniteQuery } from '@tanstack/react-query';

import { queryKeys } from '@/store/queryKeys';
import { fetchGroupMessages } from '@/transport/api/groups';

import { GROUP_PAGE_LIMIT } from '../constants';

/** GET /groups/{id}/messages 무한 쿼리. 페이지는 최신순, cursor = 이전 페이지의 가장 오래된 id */
export function useGroupThread(groupId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.groupThread(groupId),
    queryFn: ({ pageParam }) =>
      fetchGroupMessages(groupId, {
        ...(pageParam === undefined ? {} : { cursor: pageParam }),
        limit: GROUP_PAGE_LIMIT,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
