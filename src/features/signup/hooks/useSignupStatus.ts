import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/store/queryKeys';
import { getSignupStatus } from '@/transport/api/auth';

/** 대기 중이면 이만큼마다 다시 확인한다 */
export const SIGNUP_POLL_MS = 30_000;

/**
 * GET /signup/{requestId}. 상태 화면은 열 때마다 서버에 다시 묻는다 — 공유 캐시 기본 staleTime(30초)이면
 * 승인된 뒤 다시 들어와도 예전 "대기"가 보였다 (11b E2E에서 발견). 404(없는 번호)는 다시 시도하지 않는다
 */
export function useSignupStatus(requestId: string) {
  return useQuery({
    queryKey: queryKeys.signupStatus(requestId),
    queryFn: () => getSignupStatus(requestId),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? SIGNUP_POLL_MS : false),
  });
}
