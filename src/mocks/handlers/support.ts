// 핸들러 공통: URL, 에러 응답, 인증 가드, 파라미터
import { HttpResponse, type PathParams } from 'msw';

import type { Endpoint } from '@/transport/api/endpoints';

import { state } from '../state.ts';

export const BASE = '/api/v1';

export function url(endpoint: Endpoint): string {
  return `${BASE}${endpoint.path}`;
}

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): Response {
  return HttpResponse.json(details === undefined ? { code, message } : { code, message, details }, {
    status,
  });
}

export function noContent(init?: ResponseInit): Response {
  return new HttpResponse(null, { status: 204, ...init });
}

/** Authorization: Bearer <현재 토큰> 검사. 실패하면 401 응답, 성공하면 null */
export function requireAuth(request: Request): Response | null {
  const header = request.headers.get('Authorization');
  const token = header?.startsWith('Bearer ') === true ? header.slice(7) : null;
  if (token === null || state.session.accessToken === null || token !== state.session.accessToken) {
    return apiError(401, 'AUTH_REQUIRED', 'access token missing or expired');
  }
  if (state.me.status === 'suspended') {
    return apiError(403, 'USER_SUSPENDED', 'account suspended');
  }
  return null;
}

export function requireAdmin(request: Request): Response | null {
  const denied = requireAuth(request);
  if (denied !== null) {
    return denied;
  }
  if (state.me.role !== 'admin') {
    return apiError(403, 'FORBIDDEN', 'admin only');
  }
  return null;
}

export function param(params: PathParams, name: string): string {
  const value = params[name];
  if (typeof value === 'string') {
    return decodeURIComponent(value);
  }
  throw new Error(`missing path param ${name}`);
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function str(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === 'string' ? value : undefined;
}

export function num(body: Record<string, unknown>, key: string): number | undefined {
  const value = body[key];
  return typeof value === 'number' ? value : undefined;
}

export function page<T>(items: T[]): { items: T[]; nextCursor: null } {
  return { items, nextCursor: null };
}

/** 운영자 가입 목록 한 페이지 크기 (API_CONTRACT 2.8) */
export const SIGNUP_PAGE_SIZE = 50;

/**
 * 정렬된 목록의 커서 페이지. 커서는 불투명 문자열(여기서는 다음 시작 위치) — 클라이언트는 그대로 돌려보내기만 한다.
 * 모르는 커서면 첫 페이지
 */
export function offsetPage<T>(
  items: readonly T[],
  cursor: string | null,
  size: number,
): { items: T[]; nextCursor: string | null } {
  const parsed = cursor === null ? 0 : Number.parseInt(cursor, 10);
  const start = Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
  const end = start + size;
  return { items: items.slice(start, end), nextCursor: end < items.length ? String(end) : null };
}

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;

/**
 * 메시지 히스토리 커서 페이지네이션 (API_CONTRACT 2.6·2.7): messages는 최신순,
 * cursor = 이전 페이지의 가장 오래된 id. 모르는 커서면 빈 페이지
 */
export function cursorPage<T extends { id: string }>(
  messages: readonly T[],
  cursor: string | null,
  limitParam: string | null,
): { items: T[]; nextCursor: string | null } {
  const limit = Math.min(
    Math.max(Number(limitParam ?? DEFAULT_PAGE_LIMIT) || DEFAULT_PAGE_LIMIT, 1),
    MAX_PAGE_LIMIT,
  );
  const start = cursor === null ? 0 : messages.findIndex((m) => m.id === cursor) + 1;
  if (cursor !== null && start === 0) {
    return { items: [], nextCursor: null };
  }
  const items = messages.slice(start, start + limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor: start + limit < messages.length && last !== undefined ? last.id : null,
  };
}

/** 가짜 상대 봇 기본 지연 (ms) */
const DEFAULT_BOT_MS = 5000;

/** 가짜 상대 봇 지연 (DM·그룹 공통). VITE_MOCK_BOT_MS=0이면 끔 (E2E) */
export function botDelayMs(): number {
  return Number(import.meta.env.VITE_MOCK_BOT_MS ?? DEFAULT_BOT_MS);
}
