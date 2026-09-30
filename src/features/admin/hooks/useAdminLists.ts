import { useInfiniteQuery } from '@tanstack/react-query';

import type { SignupStatus, UserStatus } from '@/domain';
import { queryKeys } from '@/store/queryKeys';
import { fetchAdminUsers, fetchSignups } from '@/transport/api/admin';

export type UserFilter = UserStatus | 'all';

/** GET /admin/signups?status= (커서 "더 보기") */
export function useAdminSignups(status: SignupStatus) {
  return useInfiniteQuery({
    queryKey: queryKeys.adminSignups(status),
    queryFn: ({ pageParam }) =>
      fetchSignups({ status, ...(pageParam === undefined ? {} : { cursor: pageParam }) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** GET /admin/users?status= — Me(email·phone 포함) */
export function useAdminUsers(filter: UserFilter) {
  return useInfiniteQuery({
    queryKey: queryKeys.adminUsers(filter),
    queryFn: ({ pageParam }) =>
      fetchAdminUsers({
        ...(filter === 'all' ? {} : { status: filter }),
        ...(pageParam === undefined ? {} : { cursor: pageParam }),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
