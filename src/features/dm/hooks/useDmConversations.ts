import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';

import type { DmConversation } from '@/domain';
import { splitConversationPage, totalUnread, type ConversationsData } from '@/store/dmCache';
import { queryKeys } from '@/store/queryKeys';
import type { CursorPage } from '@/store/threadCache';
import { fetchDmConversations } from '@/transport/api/dm';

/** GET /dm (최근순, 커서). peer는 사용자 캐시로 분해해 넣는다 (DOMAIN 9) */
export function useDmConversations() {
  const qc = useQueryClient();
  return useInfiniteQuery<
    CursorPage<DmConversation>,
    Error,
    ConversationsData,
    ReturnType<typeof queryKeys.dmConversations>,
    string | undefined
  >({
    queryKey: queryKeys.dmConversations(),
    queryFn: async ({ pageParam }) =>
      splitConversationPage(qc, await fetchDmConversations(pageParam)),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** DM 탭 배지: 목록 캐시에서 파생 (ARCHITECTURE 7 — 따로 저장하지 않음) */
export function useDmUnreadTotal(): number {
  return totalUnread(useDmConversations().data);
}
