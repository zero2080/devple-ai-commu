// API_CONTRACT 2장 엔드포인트 37개. api 모듈과 Mock 핸들러 수 검사가 공유한다 (ROADMAP 3·4단계).
// path는 MSW 문법(`:param`)으로 적고, 실제 호출 시 withParams로 치환한다.

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface Endpoint {
  method: HttpMethod;
  path: string;
}

function ep(method: HttpMethod, path: string): Endpoint {
  return { method, path };
}

export const ENDPOINTS = {
  // 2.1 가입 · 인증
  signup: ep('POST', '/signup'),
  signupStatus: ep('GET', '/signup/:requestId'),
  login: ep('POST', '/auth/login'),
  refresh: ep('POST', '/auth/refresh'),
  logout: ep('POST', '/auth/logout'),
  sseTicket: ep('POST', '/sse/ticket'),
  // 2.2 본인
  me: ep('GET', '/me'),
  updateMe: ep('PATCH', '/me'),
  updatePosition: ep('PUT', '/me/position'),
  updatePresence: ep('PUT', '/me/presence'),
  // 2.3 사용자 조회
  userProfile: ep('GET', '/users/:userId'),
  searchUsers: ep('GET', '/users'),
  // 2.4 월드
  worldPresences: ep('GET', '/world/:mapId/presences'),
  // 2.5 공개 근접 대화
  sendPublic: ep('POST', '/chat/public'),
  // 2.6 DM
  dmConversations: ep('GET', '/dm'),
  dmMessages: ep('GET', '/dm/:userId/messages'),
  sendDm: ep('POST', '/dm/:userId/messages'),
  recallDm: ep('POST', '/dm/messages/:messageId/recall'),
  readDm: ep('POST', '/dm/:userId/read'),
  // 2.7 그룹
  groups: ep('GET', '/groups'),
  createGroup: ep('POST', '/groups'),
  groupDetail: ep('GET', '/groups/:groupId'),
  renameGroup: ep('PATCH', '/groups/:groupId'),
  dissolveGroup: ep('DELETE', '/groups/:groupId'),
  inviteGroupMember: ep('POST', '/groups/:groupId/members'),
  removeGroupMember: ep('DELETE', '/groups/:groupId/members/:userId'),
  groupMessages: ep('GET', '/groups/:groupId/messages'),
  sendGroupMessage: ep('POST', '/groups/:groupId/messages'),
  readGroup: ep('POST', '/groups/:groupId/read'),
  // 2.8 운영자
  adminSignups: ep('GET', '/admin/signups'),
  approveSignup: ep('POST', '/admin/signups/:id/approve'),
  rejectSignup: ep('POST', '/admin/signups/:id/reject'),
  adminUsers: ep('GET', '/admin/users'),
  suspendUser: ep('POST', '/admin/users/:id/suspend'),
  unsuspendUser: ep('POST', '/admin/users/:id/unsuspend'),
  reissueAccessKey: ep('POST', '/admin/users/:id/reissue-key'),
  postNotice: ep('POST', '/admin/notices'),
} as const satisfies Record<string, Endpoint>;

export type EndpointName = keyof typeof ENDPOINTS;

export const ENDPOINT_LIST: readonly Endpoint[] = Object.values(ENDPOINTS);

/** `/dm/:userId/messages` + { userId: 'u1' } → `/dm/u1/messages`. 값은 encodeURIComponent */
export function withParams(path: string, params: Record<string, string>): string {
  return path.replace(/:([A-Za-z]+)/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`missing path param "${name}" for ${path}`);
    }
    return encodeURIComponent(value);
  });
}
