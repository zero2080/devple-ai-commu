import { useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type { User } from '@/domain';
import { queryKeys } from '@/store/queryKeys';
import { rememberUser } from '@/store/userCache';
import { getUserProfile } from '@/transport/api/users';

const USER_STALE_MS = 5 * 60_000;

function userQuery(qc: QueryClient, userId: string) {
  return {
    queryKey: queryKeys.user(userId),
    queryFn: async (): Promise<User> => {
      const { user } = await getUserProfile(userId);
      rememberUser(qc, user);
      return user;
    },
    staleTime: USER_STALE_MS,
  };
}

/** 사용자 캐시(users.byId). 대화 목록·이벤트가 분해해 넣은 값을 쓰고, 없으면 프로필로 받아온다 (DOMAIN 9) */
export function useUser(userId: string) {
  const qc = useQueryClient();
  return useQuery<User>(userQuery(qc, userId));
}

/**
 * 여러 사용자를 한 번에 (그룹 스레드 발신자 닉네임). enabled가 false면 캐시에 있는 것만 쓰고 받아오지 않는다 —
 * 상세 응답이 멤버를 먼저 캐시에 넣은 뒤 켜서 멤버가 아닌 발신자(나간 사람)만 받게 한다
 */
export function useUsers(userIds: readonly string[], enabled = true): ReadonlyMap<string, User> {
  const qc = useQueryClient();
  const unique = [...new Set(userIds)];
  const results = useQueries({
    queries: unique.map((id) => ({ ...userQuery(qc, id), enabled })),
  });
  const users = new Map<string, User>();
  results.forEach((result, index) => {
    const id = unique[index];
    if (id !== undefined && result.data !== undefined) {
      users.set(id, result.data);
    }
  });
  return users;
}
