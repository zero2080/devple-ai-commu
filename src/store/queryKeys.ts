// 쿼리 키는 여기 한 곳에 모은다 (CONVENTIONS 7장)
export const queryKeys = {
  /** DM 대화 목록 (무한 쿼리, 최근순) */
  dmConversations: () => ['dm', 'conversations'] as const,
  /** 모든 DM 스레드 (회수·읽음처럼 대화를 가로지르는 갱신용 접두) */
  dmThreads: () => ['dm', 'threads'] as const,
  /** 상대 userId별 DM 스레드 (무한 쿼리, 페이지는 최신순) */
  dmThread: (peerId: string) => ['dm', 'threads', peerId] as const,
  /** 사용자 캐시 — 합성 응답의 peer·sender를 분해해 둔다 (DOMAIN 9) */
  user: (userId: string) => ['users', 'byId', userId] as const,
  userProfile: (userId: string) => ['users', 'profile', userId] as const,
  userSearch: (nickname: string) => ['users', 'search', nickname] as const,
};
