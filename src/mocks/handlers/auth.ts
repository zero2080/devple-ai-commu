// API_CONTRACT 2.1 (SSE 티켓 제외 — Express mock 담당)
import { http, HttpResponse } from 'msw';

import { ENDPOINTS } from '@/transport/api/endpoints';

import { ACCESS_TOKEN_TTL_SEC, DEMO_ACCESS_KEY, SERVER_CONFIG } from '../data/config.ts';
import { nextId, state } from '../state.ts';
import { apiError, noContent, param, readJson, requireAuth, str, url } from './support.ts';

const REFRESH_COOKIE = 'refreshToken';

function issueAccessToken(): string {
  state.session.serial += 1;
  state.session.accessToken = `mock-access-${String(state.session.serial)}`;
  return state.session.accessToken;
}

function refreshCookieHeader(value: string, maxAgeSec: number): string {
  return `${REFRESH_COOKIE}=${value}; Path=/api/v1/auth; Max-Age=${String(maxAgeSec)}; SameSite=Strict`;
}

function isNicknameTaken(nickname: string): boolean {
  return (
    state.me.nickname === nickname ||
    state.users.some((u) => u.nickname === nickname) ||
    state.signups.some((s) => s.status === 'pending' && s.nickname === nickname)
  );
}

export const authHandlers = [
  http.post(url(ENDPOINTS.signup), async ({ request }) => {
    const body = await readJson(request);
    const email = str(body, 'email') ?? '';
    const nickname = str(body, 'nickname') ?? '';
    const phone = str(body, 'phone') ?? '';
    const fields: Record<string, string> = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fields.email = 'invalid';
    if (Array.from(nickname).length < 2 || Array.from(nickname).length > 12)
      fields.nickname = 'length 2~12';
    if (!/^[0-9-]{8,20}$/.test(phone)) fields.phone = 'digits and hyphens, 8~20';
    if (Object.keys(fields).length > 0) {
      return apiError(400, 'VALIDATION_FAILED', 'invalid fields', { fields });
    }
    if (isNicknameTaken(nickname)) {
      return apiError(409, 'NICKNAME_TAKEN', 'nickname already in use');
    }
    const id = nextId('sr');
    state.signups.push({ id, email, nickname, phone, status: 'pending', createdAt: Date.now() });
    return HttpResponse.json({ requestId: id, status: 'pending' }, { status: 201 });
  }),

  http.get(url(ENDPOINTS.signupStatus), ({ params }) => {
    const found = state.signups.find((s) => s.id === param(params, 'requestId'));
    if (found === undefined) {
      return apiError(404, 'NOT_FOUND', 'signup request not found', { resource: 'signup' });
    }
    return HttpResponse.json(
      found.rejectReason === undefined
        ? { status: found.status }
        : { status: found.status, rejectReason: found.rejectReason },
    );
  }),

  http.post(url(ENDPOINTS.login), async ({ request }) => {
    const body = await readJson(request);
    if (str(body, 'accessKey') !== DEMO_ACCESS_KEY) {
      return apiError(401, 'AUTH_INVALID_KEY', 'access key mismatch');
    }
    const accessToken = issueAccessToken();
    return HttpResponse.json(
      { accessToken, expiresIn: ACCESS_TOKEN_TTL_SEC, me: state.me, config: SERVER_CONFIG },
      {
        headers: {
          'Set-Cookie': refreshCookieHeader(
            `mock-refresh-${String(state.session.serial)}`,
            14 * 86_400,
          ),
        },
      },
    );
  }),

  http.post(url(ENDPOINTS.refresh), ({ cookies }) => {
    // 새로고침 후에도 세션이 복구되도록 쿠키가 있으면 인정한다 (MSW 상태는 페이지마다 초기화되므로)
    if (typeof cookies[REFRESH_COOKIE] !== 'string' || cookies[REFRESH_COOKIE] === '') {
      return apiError(401, 'AUTH_REQUIRED', 'refresh token missing');
    }
    const accessToken = issueAccessToken();
    return HttpResponse.json(
      { accessToken, expiresIn: ACCESS_TOKEN_TTL_SEC },
      {
        headers: {
          'Set-Cookie': refreshCookieHeader(
            `mock-refresh-${String(state.session.serial)}`,
            14 * 86_400,
          ),
        },
      },
    );
  }),

  http.post(url(ENDPOINTS.logout), ({ request }) => {
    const denied = requireAuth(request);
    if (denied !== null) return denied;
    state.session.accessToken = null;
    return noContent({ headers: { 'Set-Cookie': refreshCookieHeader('', 0) } });
  }),
];
