import { useInfiniteQuery } from '@tanstack/react-query';

import { queryKeys } from '@/store/queryKeys';
import { fetchDmMessages } from '@/transport/api/dm';

import { DM_PAGE_LIMIT } from '../constants';

/** GET /dm/{userId}/messages 무한 쿼리. 페이지는 최신순, cursor = 이전 페이지의 가장 오래된 id */
export function useDmThread(peerId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.dmThread(peerId),
    queryFn: ({ pageParam }) =>
      fetchDmMessages(peerId, {
        ...(pageParam === undefined ? {} : { cursor: pageParam }),
        limit: DM_PAGE_LIMIT,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
