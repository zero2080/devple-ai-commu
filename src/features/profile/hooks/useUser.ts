import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { User } from '@/domain';
import { rememberUser } from '@/store/dmCache';
import { queryKeys } from '@/store/queryKeys';
import { getUserProfile } from '@/transport/api/users';

const USER_STALE_MS = 5 * 60_000;

/** 사용자 캐시(users.byId). 대화 목록·이벤트가 분해해 넣은 값을 쓰고, 없으면 프로필로 받아온다 (DOMAIN 9) */
export function useUser(userId: string) {
  const qc = useQueryClient();
  return useQuery<User>({
    queryKey: queryKeys.user(userId),
    queryFn: async () => {
      const { user } = await getUserProfile(userId);
      rememberUser(qc, user);
      return user;
    },
    staleTime: USER_STALE_MS,
  });
}
