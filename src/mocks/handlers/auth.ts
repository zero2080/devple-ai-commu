// API_CONTRACT 2.1 (SSE 티켓 제외 — Express mock 담당)
import { http, HttpResponse } from 'msw';

import { validateSignup } from '@/domain';
import { ENDPOINTS } from '@/transport/api/endpoints';

import { ACCESS_TOKEN_TTL_SEC, DEMO_ACCESS_KEY, SERVER_CONFIG } from '../data/config.ts';
import { isEmailTaken, isNicknameTaken, nextId, state } from '../state.ts';
import { apiError, noContent, param, readJson, requireAuth, str, url } from './support.ts';

const REFRESH_COOKIE = 'refreshToken';

function issueAccessToken(): string {
  state.session.serial += 1;
  state.session.accessToken = `mock-access-${String(state.session.serial)}`;
  return state.session.accessToken;
}

/** 계약은 Path=/api/v1/auth지만 MSW는 document.cookie로 요청 쿠키를 읽으므로 mock에서는 Path=/ (새로고침 후 세션 복구용) */
function refreshCookieHeader(value: string, maxAgeSec: number): string {
  return `${REFRESH_COOKIE}=${value}; Path=/; Max-Age=${String(maxAgeSec)}; SameSite=Strict`;
}

/**
 * 서버의 접근 키 정규화 (API_CONTRACT 2.1): 공백·하이픈 무시, 대소문자 무시, 혼동 문자 O→0, I·L→1.
 * 클라이언트는 앞뒤 공백만 지우고 보낸다 — 정규화는 서버(여기서는 Mock) 몫
 */
export function normalizeAccessKey(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
}

export const authHandlers = [
  http.post(url(ENDPOINTS.signup), async ({ request }) => {
    const body = await readJson(request);
    const email = str(body, 'email') ?? '';
    const nickname = str(body, 'nickname') ?? '';
    const phone = str(body, 'phone') ?? '';
    // API_CONTRACT 2.1: 형식·길이 → 400 (fields 사유 어휘), 그다음 닉네임·이메일 중복 → 409
    const fields = validateSignup({ email, nickname, phone });
    if (Object.keys(fields).length > 0) {
      return apiError(400, 'VALIDATION_FAILED', 'invalid fields', { fields });
    }
    if (isNicknameTaken(nickname)) {
      return apiError(409, 'NICKNAME_TAKEN', 'nickname already in use');
    }
    if (isEmailTaken(email)) {
      return apiError(409, 'EMAIL_TAKEN', 'email already registered or pending');
    }
    const id = nextId('sr');
    state.signups.push({
      id,
      email: email.trim(),
      nickname: nickname.trim(), // 앞뒤 공백 제거 후 저장 (API_CONTRACT 2.1)
      phone: phone.trim(),
      status: 'pending',
      createdAt: Date.now(),
    });
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
    if (normalizeAccessKey(str(body, 'accessKey') ?? '') !== normalizeAccessKey(DEMO_ACCESS_KEY)) {
      return apiError(401, 'AUTH_INVALID_KEY', 'access key mismatch');
    }
    if (state.me.status === 'suspended') {
      return apiError(403, 'USER_SUSPENDED', 'account suspended');
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
    if (state.me.status === 'suspended') {
      return apiError(401, 'AUTH_REQUIRED', 'refresh token revoked (suspended)'); // 정지 시 refresh 전부 무효
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
