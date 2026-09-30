import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { UserProfile } from '@/domain';
import { rememberUser } from '@/store/dmCache';
import { queryKeys } from '@/store/queryKeys';
import { getUserProfile } from '@/transport/api/users';

/** 프로필 카드용 GET /users/{id} (접속 여부·위치 포함). user는 사용자 캐시에도 넣는다 */
export function useUserProfile(userId: string | null) {
  const qc = useQueryClient();
  return useQuery<UserProfile>({
    queryKey: queryKeys.userProfile(userId ?? ''),
    queryFn: async () => {
      const profile = await getUserProfile(userId ?? '');
      rememberUser(qc, profile.user);
      return profile;
    },
    enabled: userId !== null,
    staleTime: 10_000,
  });
}
