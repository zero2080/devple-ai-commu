// API_CONTRACT 2.2 본인
import { http, HttpResponse } from 'msw';

import { ENDPOINTS } from '@/transport/api/endpoints';

import { SERVER_CONFIG } from '../data/config.ts';
import { state } from '../state.ts';
import { apiError, readJson, requireAuth, str, url } from './support.ts';

export const meHandlers = [
  http.get(url(ENDPOINTS.me), ({ request }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    return HttpResponse.json({ me: state.me, config: SERVER_CONFIG });
  }),

  http.patch(url(ENDPOINTS.updateMe), async ({ request }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const body = await readJson(request);
    const nickname = str(body, 'nickname');
    const statusMessage = str(body, 'statusMessage');
    const avatarId = str(body, 'avatarId');
    if (nickname !== undefined) {
      const length = Array.from(nickname).length;
      if (length < 2 || length > 12) {
        return apiError(400, 'VALIDATION_FAILED', 'invalid fields', {
          fields: { nickname: 'length 2~12' },
        });
      }
      if (state.users.some((u) => u.nickname === nickname)) {
        return apiError(409, 'NICKNAME_TAKEN', 'nickname already in use');
      }
      state.me.nickname = nickname;
    }
    if (statusMessage !== undefined) {
      if (Array.from(statusMessage).length > 40) {
        return apiError(400, 'VALIDATION_FAILED', 'invalid fields', {
          fields: { statusMessage: 'max 40' },
        });
      }
      state.me.statusMessage = statusMessage;
    }
    if (avatarId !== undefined) {
      state.me.avatarId = avatarId;
    }
    return HttpResponse.json(state.me);
  }),

  // PUT /me/position, PUT /me/presence는 Express mock이 담당한다 (ARCHITECTURE 9장)
];
