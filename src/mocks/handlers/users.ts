// API_CONTRACT 2.3 사용자 조회
import { http, HttpResponse } from 'msw';

import type { User, UserProfile } from '@/domain';
import { ENDPOINTS } from '@/transport/api/endpoints';

import { state } from '../state.ts';
import { apiError, param, requireAuth, url } from './support.ts';

export function profileOf(user: User): UserProfile {
  const presence = state.presences.find((p) => p.userId === user.id);
  return presence === undefined
    ? { user, online: false }
    : { user, online: true, position: presence.position };
}

export const usersHandlers = [
  http.get(url(ENDPOINTS.userProfile), ({ request, params }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const userId = param(params, 'userId');
    const user = userId === state.me.id ? state.me : state.users.find((u) => u.id === userId);
    if (user === undefined) {
      return apiError(404, 'NOT_FOUND', 'user not found', { resource: 'user' });
    }
    return HttpResponse.json(profileOf(user));
  }),

  http.get(url(ENDPOINTS.searchUsers), ({ request }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const q = new URL(request.url).searchParams.get('nickname') ?? '';
    if (q.length < 1) {
      return HttpResponse.json({ items: [] });
    }
    const items = state.users
      .filter((u) => u.nickname.includes(q))
      .slice(0, 20)
      .map(profileOf);
    return HttpResponse.json({ items });
  }),
];
