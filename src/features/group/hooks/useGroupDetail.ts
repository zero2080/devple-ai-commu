import { useQuery, useQueryClient } from '@tanstack/react-query';

import { splitGroupDetail, type GroupDetailData } from '@/store/groupCache';
import { queryKeys } from '@/store/queryKeys';
import { fetchGroupDetail } from '@/transport/api/groups';

/** GET /groups/{id}: 멤버 user는 사용자 캐시로 분해하고 기본 엔티티만 둔다 (DOMAIN 9) */
export function useGroupDetail(groupId: string) {
  const qc = useQueryClient();
  return useQuery<GroupDetailData>({
    queryKey: queryKeys.groupDetail(groupId),
    queryFn: async () => splitGroupDetail(qc, await fetchGroupDetail(groupId)),
  });
}
