// API_CONTRACT 2.8 운영자
import { http, HttpResponse } from 'msw';

import type { Notice, User } from '@/domain';
import { ENDPOINTS } from '@/transport/api/endpoints';

import { SERVER_CONFIG } from '../data/config.ts';
import { contentError } from '../data/messages.ts';
import { nextId, state, userAsMe } from '../state.ts';
import { apiError, noContent, page, param, readJson, requireAdmin, str, url } from './support.ts';

function findUser(id: string): User | undefined {
  return state.users.find((u) => u.id === id);
}

export const adminHandlers = [
  http.get(url(ENDPOINTS.adminSignups), ({ request }) => {
    const denied = requireAdmin(request);
    if (denied !== null) return denied;
    const status = new URL(request.url).searchParams.get('status');
    const items = state.signups.filter((s) => status === null || s.status === status);
    return HttpResponse.json(page(items));
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
      avatarId: 'char_01',
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
    signup.status = 'rejected';
    signup.rejectReason = str(await readJson(request), 'reason') ?? '';
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
    const user = findUser(param(params, 'id'));
    if (user === undefined) {
      return apiError(404, 'NOT_FOUND', 'user not found', { resource: 'user' });
    }
    user.status = 'suspended';
    state.presences = state.presences.filter((p) => p.userId !== user.id);
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
    return HttpResponse.json(notice, { status: 201 });
  }),
];
