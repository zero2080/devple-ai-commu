// API_CONTRACT 2.2 본인
import { http, HttpResponse } from 'msw';

import { normalizeAppearance, validateAppearance, type Appearance } from '@/domain';
import { ENDPOINTS } from '@/transport/api/endpoints';

import { emitViaExpress } from '../bridge.ts';
import { SERVER_CONFIG } from '../data/config.ts';
import { isNicknameTaken, state } from '../state.ts';
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
    const hasAppearance = body.appearance !== undefined;

    // API_CONTRACT 2.2 검증 표: 틀린 필드를 전부 details.fields에 담아 400, 그 다음 닉네임 중복 409
    const fields: Record<string, string> = {};
    if (nickname !== undefined) {
      const length = Array.from(nickname).length;
      if (length < 2 || length > 12) fields.nickname = 'length';
    }
    if (statusMessage !== undefined && Array.from(statusMessage).length > 40) {
      fields.statusMessage = 'length';
    }
    if (hasAppearance) {
      // 전체 교체 검증 (API_CONTRACT 2.2): required · unknown · slot_mismatch, 필드 경로 appearance.<경로>
      Object.assign(fields, validateAppearance(body.appearance, SERVER_CONFIG.avatarOptions));
    }
    if (Object.keys(fields).length > 0) {
      return apiError(400, 'VALIDATION_FAILED', 'invalid fields', { fields });
    }
    if (nickname !== undefined && isNicknameTaken(nickname, state.me.id)) {
      return apiError(409, 'NICKNAME_TAKEN', 'nickname already in use');
    }

    const changed: { nickname?: string; appearance?: Appearance } = {};
    if (nickname !== undefined && nickname !== state.me.nickname) {
      state.me.nickname = nickname;
      changed.nickname = nickname;
    }
    if (statusMessage !== undefined) {
      state.me.statusMessage = statusMessage;
    }
    if (hasAppearance) {
      // 검증을 통과했으므로 Appearance다. 정규화해 저장 (hair.primary 등은 버린다, DOMAIN 3.7)
      const next = normalizeAppearance(body.appearance as Appearance);
      if (JSON.stringify(next) !== JSON.stringify(normalizeAppearance(state.me.appearance))) {
        state.me.appearance = next;
        changed.appearance = next;
      }
    }
    if (Object.keys(changed).length > 0) {
      // 같은 맵 접속자에게 presence.updated (변경된 nickname·appearance 전체만). 방송은 Express가 하므로 브리지로 위임
      void emitViaExpress('presence.updated', { userId: state.me.id, ...changed });
    }
    return HttpResponse.json(state.me);
  }),

  // PUT /me/position, PUT /me/presence는 Express mock이 담당한다 (ARCHITECTURE 9장)
];
