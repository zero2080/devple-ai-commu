// 사용자 캐시 users.byId (DOMAIN 9). 합성 응답·이벤트의 peer·sender·member.user를 분해해 여기에 둔다
import type { QueryClient } from '@tanstack/react-query';

import type { User } from '@/domain';

import { queryKeys } from './queryKeys';

export function rememberUser(qc: QueryClient, user: User): void {
  qc.setQueryData(queryKeys.user(user.id), user);
}

/** presence.updated의 닉네임·외형을 캐시에 있는 사용자에게 반영 (없으면 그대로 — 다음 조회 때 받는다) */
export function patchUser(
  qc: QueryClient,
  userId: string,
  patch: Partial<Pick<User, 'nickname' | 'appearance'>>,
): void {
  qc.setQueryData<User>(queryKeys.user(userId), (old) =>
    old === undefined
      ? old
      : {
          ...old,
          ...(patch.nickname === undefined ? {} : { nickname: patch.nickname }),
          ...(patch.appearance === undefined ? {} : { appearance: patch.appearance }),
        },
  );
}
