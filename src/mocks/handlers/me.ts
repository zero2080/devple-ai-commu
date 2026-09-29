// API_CONTRACT 2.2 본인
import { http, HttpResponse } from 'msw';

import { ENDPOINTS } from '@/transport/api/endpoints';

import { SERVER_CONFIG } from '../data/config.ts';
import { isBlocked, MAIN_MAP } from '../data/map.ts';
import { state } from '../state.ts';
import { apiError, noContent, num, readJson, requireAuth, str, url } from './support.ts';

const DIRECTIONS = new Set(['up', 'down', 'left', 'right']);

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

  http.put(url(ENDPOINTS.updatePosition), async ({ request }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const body = await readJson(request);
    const mapId = str(body, 'mapId');
    const x = num(body, 'x');
    const y = num(body, 'y');
    const dir = str(body, 'dir');
    const seq = num(body, 'seq');
    if (
      mapId !== MAIN_MAP.id ||
      x === undefined ||
      y === undefined ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      dir === undefined ||
      !DIRECTIONS.has(dir) ||
      seq === undefined
    ) {
      return apiError(400, 'VALIDATION_FAILED', 'invalid position payload');
    }
    if (seq <= state.myPositionSeq) {
      return noContent(); // 오래된 seq는 204로 무시 (에러 아님)
    }
    const reject = (reason: 'collision' | 'too_far' | 'occupied') =>
      apiError(409, 'POSITION_REJECTED', reason, {
        position: state.myPosition,
        seq: state.myPositionSeq,
        reason,
      });
    if (isBlocked(MAIN_MAP, x, y)) {
      return reject('collision');
    }
    const now = Date.now();
    const elapsedMs =
      state.myPositionAt === 0 ? Number.POSITIVE_INFINITY : now - state.myPositionAt;
    const allowed = Math.max(3, elapsedMs / 100);
    const distance = Math.max(Math.abs(x - state.myPosition.x), Math.abs(y - state.myPosition.y));
    if (distance > allowed) {
      return reject('too_far');
    }
    if (
      state.presences.some(
        (p) => p.userId !== state.me.id && p.position.x === x && p.position.y === y,
      )
    ) {
      return reject('occupied');
    }
    state.myPosition = { mapId, x, y, dir: dir as 'up' | 'down' | 'left' | 'right' };
    state.myPositionSeq = seq;
    state.myPositionAt = now;
    return noContent();
  }),

  http.put(url(ENDPOINTS.updatePresence), async ({ request }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    const body = await readJson(request);
    const presence = str(body, 'state');
    if (presence !== 'online' && presence !== 'away') {
      return apiError(400, 'VALIDATION_FAILED', 'state must be online|away');
    }
    state.myPresence = presence;
    return noContent();
  }),
];
