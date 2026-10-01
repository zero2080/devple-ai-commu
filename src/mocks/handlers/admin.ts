// API_CONTRACT 2.8 운영자
import { http, HttpResponse } from 'msw';

import type { Notice, User } from '@/domain';
import { ENDPOINTS } from '@/transport/api/endpoints';

import { emitViaExpress } from '../bridge.ts';
import { defaultAppearance } from '../data/avatar.ts';
import { SERVER_CONFIG } from '../data/config.ts';
import { contentError } from '../data/messages.ts';
import { nextId, state, userAsMe } from '../state.ts';
import {
  apiError,
  noContent,
  offsetPage,
  page,
  param,
  readJson,
  requireAdmin,
  SIGNUP_PAGE_SIZE,
  str,
  url,
} from './support.ts';

function findUser(id: string): User | undefined {
  return state.users.find((u) => u.id === id);
}

export const adminHandlers = [
  http.get(url(ENDPOINTS.adminSignups), ({ request }) => {
    const denied = requireAdmin(request);
    if (denied !== null) return denied;
    const query = new URL(request.url).searchParams;
    const status = query.get('status');
    // API_CONTRACT 2.3 2.8: 대기는 오래된 순(먼저 온 신청부터 심사), 그 밖·미지정은 최신순. 50건씩, 불투명 커서
    const oldestFirst = status === 'pending';
    const items = state.signups
      .filter((s) => status === null || s.status === status)
      .sort((a, b) => (oldestFirst ? a.createdAt - b.createdAt : b.createdAt - a.createdAt));
    return HttpResponse.json(offsetPage(items, query.get('cursor'), SIGNUP_PAGE_SIZE));
  }),

  http.post(url(ENDPOINTS.approveSignup), ({ request, params }) => {
    const denied = requireAdmin(request);
    if (denied !== null) return denied;
    const signup = state.signups.find((s) => s.id === param(params, 'id'));
    if (signup === undefined) {
      return apiError(404, 'NOT_FOUND', 'signup not found', { resource: 'signup' });
    }
    if (signup.status !== 'pending') {
      return apiError(409, 'SIGNUP_ALREADY_REVIEWED', 'already reviewed');
    }
    const now = Date.now();
    const user: User = {
      id: nextId('u'),
      nickname: signup.nickname,
      appearance: defaultAppearance(),
      role: 'member',
      status: 'active',
      createdAt: now,
    };
    state.users.push(user);
    signup.status = 'approved';
    signup.reviewedAt = now;
    signup.reviewedBy = state.me.id;
    return HttpResponse.json({ userId: user.id });
  }),

  http.post(url(ENDPOINTS.rejectSignup), async ({ request, params }) => {
    const denied = requireAdmin(request);
    if (denied !== null) return denied;
    const signup = state.signups.find((s) => s.id === param(params, 'id'));
    if (signup === undefined) {
      return apiError(404, 'NOT_FOUND', 'signup not found', { resource: 'signup' });
    }
    if (signup.status !== 'pending') {
      return apiError(409, 'SIGNUP_ALREADY_REVIEWED', 'already reviewed');
    }
    // API_CONTRACT 2.3 2.8: 없음 → required, 공백뿐이거나 앞뒤 공백 제거 후 200자 초과 → length, 공백 제거한 값을 저장
    const raw = str(await readJson(request), 'reason');
    if (raw === undefined) {
      return apiError(400, 'VALIDATION_FAILED', 'invalid fields', {
        fields: { reason: 'required' },
      });
    }
    const reason = raw.trim();
    const reasonLength = Array.from(reason).length;
    if (reasonLength < 1 || reasonLength > 200) {
      return apiError(400, 'VALIDATION_FAILED', 'invalid fields', { fields: { reason: 'length' } });
    }
    signup.status = 'rejected';
    signup.rejectReason = reason;
    signup.reviewedAt = Date.now();
    signup.reviewedBy = state.me.id;
    return noContent();
  }),

  http.get(url(ENDPOINTS.adminUsers), ({ request }) => {
    const denied = requireAdmin(request);
    if (denied !== null) return denied;
    const status = new URL(request.url).searchParams.get('status');
    const items = [state.me, ...state.users.map(userAsMe)].filter(
      (u) => status === null || u.status === status,
    );
    return HttpResponse.json(page(items));
  }),

  http.post(url(ENDPOINTS.suspendUser), ({ request, params }) => {
    const denied = requireAdmin(request);
    if (denied !== null) return denied;
    if (param(params, 'id') === state.me.id) {
      return apiError(403, 'FORBIDDEN', 'cannot suspend yourself'); // API_CONTRACT 1.5
    }
    const user = findUser(param(params, 'id'));
    if (user === undefined) {
      return apiError(404, 'NOT_FOUND', 'user not found', { resource: 'user' });
    }
    const wasActive = user.status === 'active';
    user.status = 'suspended';
    state.presences = state.presences.filter((p) => p.userId !== user.id);
    if (wasActive) {
      // 대상은 system.suspended 뒤 SSE가 끊기므로 같은 맵 접속자에게 presence.left (가짜 사용자라 연결은 없음)
      void emitViaExpress('presence.left', { userId: user.id });
    }
    return noContent();
  }),

  http.post(url(ENDPOINTS.unsuspendUser), ({ request, params }) => {
    const denied = requireAdmin(request);
    if (denied !== null) return denied;
    const user = findUser(param(params, 'id'));
    if (user === undefined) {
      return apiError(404, 'NOT_FOUND', 'user not found', { resource: 'user' });
    }
    user.status = 'active';
    return noContent();
  }),

  http.post(url(ENDPOINTS.reissueAccessKey), ({ request, params }) => {
    const denied = requireAdmin(request);
    if (denied !== null) return denied;
    const id = param(params, 'id');
    if (id !== state.me.id && findUser(id) === undefined) {
      return apiError(404, 'NOT_FOUND', 'user not found', { resource: 'user' });
    }
    return noContent();
  }),

  http.post(url(ENDPOINTS.postNotice), async ({ request }) => {
    const denied = requireAdmin(request);
    if (denied !== null) return denied;
    const content = str(await readJson(request), 'content') ?? '';
    const problem = contentError(content, SERVER_CONFIG.maxMessageLength);
    if (problem !== null) {
      return apiError(400, 'MESSAGE_INVALID_CONTENT', problem);
    }
    const notice: Notice = {
      id: nextId('n'),
      content,
      createdBy: state.me.id,
      createdAt: Date.now(),
    };
    state.notices.push(notice);
    void emitViaExpress('system.notice', notice); // 접속자 전원 (API_CONTRACT 2.8)
    return HttpResponse.json(notice, { status: 201 });
  }),
];
