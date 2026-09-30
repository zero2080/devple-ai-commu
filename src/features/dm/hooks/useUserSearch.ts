import { useQuery, useQueryClient } from '@tanstack/react-query';

import { rememberUser } from '@/store/dmCache';
import { queryKeys } from '@/store/queryKeys';
import { searchUsers } from '@/transport/api/users';

/** 닉네임 검색 (API_CONTRACT 2.3: 부분 일치, 최대 20건, 본인 제외). 1자 이상일 때만 */
export function useUserSearch(nickname: string) {
  const qc = useQueryClient();
  const q = nickname.trim();
  return useQuery({
    queryKey: queryKeys.userSearch(q),
    queryFn: async () => {
      const result = await searchUsers(q);
      for (const profile of result.items) {
        rememberUser(qc, profile.user);
      }
      return result.items;
    },
    enabled: q.length > 0,
    staleTime: 10_000,
  });
}
