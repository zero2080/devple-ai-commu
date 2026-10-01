// 쿼리 키는 여기 한 곳에 모은다 (CONVENTIONS 7장)
export const queryKeys = {
  /** DM 대화 목록 (무한 쿼리, 최근순) */
  dmConversations: () => ['dm', 'conversations'] as const,
  /** 모든 DM 스레드 (회수·읽음처럼 대화를 가로지르는 갱신용 접두) */
  dmThreads: () => ['dm', 'threads'] as const,
  /** 상대 userId별 DM 스레드 (무한 쿼리, 페이지는 최신순) */
  dmThread: (peerId: string) => ['dm', 'threads', peerId] as const,
  /** 내가 속한 그룹 목록 (페이지네이션 없음) */
  groups: () => ['groups', 'list'] as const,
  /** 모든 그룹 상세 (접두, 재동기화용) */
  groupDetails: () => ['groups', 'detail'] as const,
  /** 그룹 상세 { group, members } — 멤버의 user는 사용자 캐시로 분해 */
  groupDetail: (groupId: string) => ['groups', 'detail', groupId] as const,
  /** 모든 그룹 스레드 (접두) */
  groupThreads: () => ['groups', 'threads'] as const,
  /** 그룹 스레드 (무한 쿼리, 페이지는 최신순) */
  groupThread: (groupId: string) => ['groups', 'threads', groupId] as const,
  /** 가입 신청 상태 (로그인 불필요, 11b단계) */
  signupStatus: (requestId: string) => ['signup', requestId] as const,
  /** 운영자 콘솔 전체 (접두) */
  admin: () => ['admin'] as const,
  /** 모든 가입 신청 목록 (접두) */
  adminSignupLists: () => ['admin', 'signups'] as const,
  /** 모든 회원 목록 (접두) */
  adminUserLists: () => ['admin', 'users'] as const,
  /** 가입 신청 목록 (무한 쿼리). status 없으면 전체 */
  adminSignups: (status: string) => ['admin', 'signups', status] as const,
  /** 회원 목록 (무한 쿼리, Me — email/phone 포함). status 'all'이면 전체 */
  adminUsers: (status: string) => ['admin', 'users', status] as const,
  /** 사용자 캐시 — 합성 응답의 peer·sender를 분해해 둔다 (DOMAIN 9) */
  user: (userId: string) => ['users', 'byId', userId] as const,
  userProfile: (userId: string) => ['users', 'profile', userId] as const,
  userSearch: (nickname: string) => ['users', 'search', nickname] as const,
};
