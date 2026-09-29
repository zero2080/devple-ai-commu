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
