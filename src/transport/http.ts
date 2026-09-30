// fetch 래퍼 1개 (ARCHITECTURE 5장). base URL, JSON, Bearer 첨부, 401 시 refresh 후 1회 재시도.
// 토큰 저장소(authStore)는 여기서 import하지 않고 TokenProvider로 주입받는다 (transport는 store를 알되 결합하지 않음).
import type { z } from 'zod';

import { ENDPOINTS, withParams, type HttpMethod } from './api/endpoints';
import { apiErrorBodySchema, refreshResponseSchema, type ApiErrorCode } from './schemas';

export interface TokenProvider {
  getAccessToken(): string | null;
  /** refresh 성공 시 호출. expiresIn은 초 */
  setAccessToken(token: string, expiresIn: number): void;
  /** refresh 실패(세션 만료) 시 호출 */
  clear(): void;
}

export interface HttpConfig {
  baseUrl: string;
  tokens: TokenProvider;
  fetchImpl?: typeof fetch;
  /** 인증 요청이 403 USER_SUSPENDED를 받으면 호출 (세션 종료는 features/auth가, ARCHITECTURE 6장) */
  onSuspended?: () => void;
}

/** 계약된 에러 응답 `{ code, message, details? }` (API_CONTRACT 1.3) */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | (string & Record<never, never>);
  readonly details: Record<string, unknown> | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** 응답 자체를 못 받은 경우 (네트워크 단절 등). 계약 코드가 아니므로 별도 클래스 */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('network request failed');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

export interface RequestOptions {
  method: HttpMethod;
  path: string;
  params?: Record<string, string>;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  /** 인증 헤더 첨부 여부. 기본 true */
  auth?: boolean;
  /** 쿠키 첨부 (refresh·logout). 기본 false */
  credentials?: boolean;
  /** pagehide 시 마지막 위치 전송용 (ARCHITECTURE 3.3) */
  keepalive?: boolean;
  signal?: AbortSignal;
}

const noTokens: TokenProvider = {
  getAccessToken: () => null,
  setAccessToken: () => undefined,
  clear: () => undefined,
};

let config: HttpConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  tokens: noTokens,
};

/** 앱 진입 시 1회 호출. 테스트에서는 절대 URL과 가짜 TokenProvider를 넣는다 */
export function configureHttp(next: Partial<HttpConfig>): void {
  config = { ...config, ...next };
}

export function getHttpConfig(): Readonly<HttpConfig> {
  return config;
}

function buildUrl(options: RequestOptions): string {
  const path = options.params ? withParams(options.path, options.params) : options.path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return config.baseUrl + path + (qs === '' ? '' : `?${qs}`);
}

async function parseError(response: Response): Promise<ApiError> {
  const retryAfterHeader = response.headers.get('Retry-After');
  const retryAfter = retryAfterHeader === null ? undefined : Number(retryAfterHeader);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  const parsed = apiErrorBodySchema.safeParse(body);
  if (parsed.success) {
    return new ApiError(
      response.status,
      parsed.data.code,
      parsed.data.message,
      parsed.data.details,
      Number.isFinite(retryAfter) ? retryAfter : undefined,
    );
  }
  return new ApiError(response.status, 'INTERNAL', `HTTP ${String(response.status)}`);
}

async function rawFetch(options: RequestOptions, accessToken: string | null): Promise<Response> {
  const headers = new Headers({ Accept: 'application/json' });
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  }
  if ((options.auth ?? true) && accessToken !== null) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  const fetchImpl = config.fetchImpl ?? fetch;
  try {
    return await fetchImpl(buildUrl(options), {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: options.credentials === true ? 'include' : 'same-origin',
      keepalive: options.keepalive ?? false,
      signal: options.signal,
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }
}

/* ---------- refresh: 단일 진행 (ARCHITECTURE 5장) ---------- */

let refreshInFlight: Promise<string> | null = null;

/**
 * POST /auth/refresh (쿠키 자동 첨부). 동시에 여러 401이 나도 요청은 1회만 보내고
 * 나머지는 같은 promise를 기다린다. 쿠키가 회전되므로 두 번째 refresh는 실패한다.
 */
export function refreshAccessToken(): Promise<string> {
  refreshInFlight ??= (async () => {
    try {
      const response = await rawFetch(
        {
          method: ENDPOINTS.refresh.method,
          path: ENDPOINTS.refresh.path,
          auth: false,
          credentials: true,
        },
        null,
      );
      if (!response.ok) {
        config.tokens.clear();
        throw await parseError(response);
      }
      const data = refreshResponseSchema.parse(await response.json());
      config.tokens.setAccessToken(data.accessToken, data.expiresIn);
      return data.accessToken;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** 테스트용: 진행 중 refresh 상태 초기화 */
export function resetHttpStateForTests(): void {
  refreshInFlight = null;
}

/* ---------- 공개 API ---------- */

/**
 * 요청을 보내고 응답 본문을 schema로 파싱한다. 204는 undefined.
 * 401 AUTH_REQUIRED면 refresh 후 1회 재시도 (auth: true인 요청만).
 */
export async function request<T extends z.ZodType>(
  options: RequestOptions,
  schema: T,
): Promise<z.infer<T>>;
export async function request(options: RequestOptions): Promise<undefined>;
export async function request(options: RequestOptions, schema?: z.ZodType): Promise<unknown> {
  let response = await rawFetch(options, config.tokens.getAccessToken());

  if (response.status === 401 && (options.auth ?? true)) {
    const error = await parseError(response.clone());
    if (error.code === 'AUTH_REQUIRED') {
      const token = await refreshAccessToken();
      response = await rawFetch(options, token);
    }
  }

  if (!response.ok) {
    const error = await parseError(response);
    if ((options.auth ?? true) && error.status === 403 && error.code === 'USER_SUSPENDED') {
      config.onSuspended?.();
    }
    throw error;
  }
  if (response.status === 204 || schema === undefined) {
    return undefined;
  }
  return schema.parse(await response.json());
}
