// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ENDPOINTS } from './api/endpoints';
import {
  ApiError,
  configureHttp,
  NetworkError,
  REFRESH_RETRY_DELAY_MS,
  request,
  resetHttpStateForTests,
  type TokenProvider,
} from './http';

const BASE = 'http://localhost/api/v1';
const okSchema = z.object({ ok: z.boolean() });

interface FakeTokens extends TokenProvider {
  token: string | null;
  cleared: number;
}

function makeTokens(initial: string | null): FakeTokens {
  const tokens: FakeTokens = {
    token: initial,
    cleared: 0,
    getAccessToken: () => tokens.token,
    setAccessToken: (token) => {
      tokens.token = token;
    },
    clear: () => {
      tokens.token = null;
      tokens.cleared += 1;
    },
  };
  return tokens;
}

/** GET /me: 'fresh' 토큰만 성공, 그 외 401 AUTH_REQUIRED */
function meRequiresFresh() {
  return http.get(`${BASE}/me`, ({ request: req }) => {
    if (req.headers.get('Authorization') === 'Bearer fresh') {
      return HttpResponse.json({ ok: true });
    }
    return HttpResponse.json({ code: 'AUTH_REQUIRED', message: 'expired' }, { status: 401 });
  });
}

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  resetHttpStateForTests();
});
afterAll(() => {
  server.close();
});

describe('request: 401 재시도', () => {
  it('401 AUTH_REQUIRED면 refresh 후 1회 재시도한다', async () => {
    let refreshCalls = 0;
    server.use(
      meRequiresFresh(),
      http.post(`${BASE}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ accessToken: 'fresh', expiresIn: 900 });
      }),
    );
    const tokens = makeTokens('stale');
    configureHttp({ baseUrl: BASE, tokens });

    await expect(request({ ...ENDPOINTS.me }, okSchema)).resolves.toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
    expect(tokens.token).toBe('fresh');
  });

  it('동시 401 3건이어도 refresh는 1회만 호출된다 (쿠키 회전이라 두 번째는 실패)', async () => {
    let refreshCalls = 0;
    server.use(
      meRequiresFresh(),
      http.post(`${BASE}/auth/refresh`, () => {
        refreshCalls += 1;
        if (refreshCalls > 1) {
          return HttpResponse.json({ code: 'AUTH_REQUIRED', message: 'rotated' }, { status: 401 });
        }
        return HttpResponse.json({ accessToken: 'fresh', expiresIn: 900 });
      }),
    );
    configureHttp({ baseUrl: BASE, tokens: makeTokens('stale') });

    const results = await Promise.all([
      request({ ...ENDPOINTS.me }, okSchema),
      request({ ...ENDPOINTS.me }, okSchema),
      request({ ...ENDPOINTS.me }, okSchema),
    ]);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
  });

  it('refresh가 401이면 잠시 뒤 한 번 더 시도한다 — 다른 탭이 방금 쿠키를 회전시킨 경우 (서버 FYI)', async () => {
    let refreshCalls = 0;
    server.use(
      meRequiresFresh(),
      http.post(`${BASE}/auth/refresh`, () => {
        refreshCalls += 1;
        return refreshCalls === 1
          ? HttpResponse.json({ code: 'AUTH_REQUIRED', message: 'rotated' }, { status: 401 })
          : HttpResponse.json({ accessToken: 'fresh', expiresIn: 900 });
      }),
    );
    const tokens = makeTokens('stale');
    configureHttp({ baseUrl: BASE, tokens });
    const started = Date.now();

    await expect(request({ ...ENDPOINTS.me }, okSchema)).resolves.toEqual({ ok: true });
    expect(refreshCalls).toBe(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(REFRESH_RETRY_DELAY_MS - 20);
    expect(tokens.cleared).toBe(0);
    expect(tokens.token).toBe('fresh');
  });

  it('refresh가 다시 시도해도 실패하면 토큰을 지우고 ApiError를 던진다', async () => {
    let refreshCalls = 0;
    server.use(
      meRequiresFresh(),
      http.post(`${BASE}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json(
          { code: 'AUTH_REQUIRED', message: 'refresh expired' },
          { status: 401 },
        );
      }),
    );
    const tokens = makeTokens('stale');
    configureHttp({ baseUrl: BASE, tokens });

    await expect(request({ ...ENDPOINTS.me }, okSchema)).rejects.toMatchObject({
      name: 'ApiError',
      code: 'AUTH_REQUIRED',
      status: 401,
    });
    expect(refreshCalls).toBe(2); // 한 번만 다시 시도
    expect(tokens.cleared).toBe(1);
    expect(tokens.token).toBeNull();
  });

  it('auth: false 요청은 401이어도 refresh하지 않고 그대로 던진다', async () => {
    let refreshCalls = 0;
    server.use(
      http.post(`${BASE}/auth/login`, () =>
        HttpResponse.json({ code: 'AUTH_INVALID_KEY', message: 'bad key' }, { status: 401 }),
      ),
      http.post(`${BASE}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ accessToken: 'fresh', expiresIn: 900 });
      }),
    );
    configureHttp({ baseUrl: BASE, tokens: makeTokens(null) });

    await expect(
      request({ ...ENDPOINTS.login, body: { accessKey: 'x' }, auth: false }, okSchema),
    ).rejects.toMatchObject({ code: 'AUTH_INVALID_KEY' });
    expect(refreshCalls).toBe(0);
  });
});

describe('request: 정지 (403 USER_SUSPENDED)', () => {
  it('인증 요청이 USER_SUSPENDED면 onSuspended를 부르고 던진다. auth: false(로그인)는 부르지 않는다', async () => {
    let suspended = 0;
    const suspendedBody = { code: 'USER_SUSPENDED', message: 'suspended' };
    server.use(
      http.get(`${BASE}/me`, () => HttpResponse.json(suspendedBody, { status: 403 })),
      http.post(`${BASE}/auth/login`, () => HttpResponse.json(suspendedBody, { status: 403 })),
      http.get(`${BASE}/groups`, () =>
        HttpResponse.json({ code: 'FORBIDDEN', message: 'no' }, { status: 403 }),
      ),
    );
    configureHttp({
      baseUrl: BASE,
      tokens: makeTokens('tok'),
      onSuspended: () => {
        suspended += 1;
      },
    });
    await expect(request({ ...ENDPOINTS.me }, okSchema)).rejects.toMatchObject({
      code: 'USER_SUSPENDED',
    });
    expect(suspended).toBe(1);
    await expect(
      request({ ...ENDPOINTS.login, body: { accessKey: 'x' }, auth: false }, okSchema),
    ).rejects.toMatchObject({ code: 'USER_SUSPENDED' });
    await expect(request({ ...ENDPOINTS.groups }, okSchema)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(suspended).toBe(1);
  });
});

describe('request: 응답 매핑', () => {
  it('204는 undefined를 돌려준다', async () => {
    server.use(http.put(`${BASE}/me/presence`, () => new HttpResponse(null, { status: 204 })));
    configureHttp({ baseUrl: BASE, tokens: makeTokens('t') });
    await expect(
      request({ ...ENDPOINTS.updatePresence, body: { state: 'away' } }),
    ).resolves.toBeUndefined();
  });

  it('에러 본문을 ApiError(status, code, details, retryAfterSeconds)로 매핑한다', async () => {
    server.use(
      http.put(`${BASE}/me/position`, () =>
        HttpResponse.json(
          {
            code: 'POSITION_REJECTED',
            message: 'occupied',
            details: {
              position: { mapId: 'main', x: 1, y: 1, dir: 'down' },
              seq: 1,
              reason: 'occupied',
            },
          },
          { status: 409, headers: { 'Retry-After': '3' } },
        ),
      ),
    );
    configureHttp({ baseUrl: BASE, tokens: makeTokens('t') });

    const error = await request({ ...ENDPOINTS.updatePosition, body: {} }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(409);
    expect(apiError.code).toBe('POSITION_REJECTED');
    expect(apiError.details).toMatchObject({ reason: 'occupied', seq: 1 });
    expect(apiError.retryAfterSeconds).toBe(3);
  });

  it('계약 형식이 아닌 에러 본문은 INTERNAL로 매핑한다', async () => {
    server.use(http.get(`${BASE}/me`, () => HttpResponse.text('boom', { status: 500 })));
    configureHttp({ baseUrl: BASE, tokens: makeTokens('t') });
    await expect(request({ ...ENDPOINTS.me }, okSchema)).rejects.toMatchObject({
      code: 'INTERNAL',
      status: 500,
    });
  });

  it('Bearer 헤더·JSON 본문·쿼리·경로 파라미터를 붙인다', async () => {
    let seen: {
      auth: string | null;
      contentType: string | null;
      body: unknown;
      url: string;
    } | null = null;
    server.use(
      http.post(`${BASE}/dm/:userId/messages`, async ({ request: req }) => {
        seen = {
          auth: req.headers.get('Authorization'),
          contentType: req.headers.get('Content-Type'),
          body: await req.json(),
          url: req.url,
        };
        return HttpResponse.json({ ok: true });
      }),
    );
    configureHttp({ baseUrl: BASE, tokens: makeTokens('tok') });

    await request(
      {
        ...ENDPOINTS.sendDm,
        params: { userId: 'u 1' },
        body: { content: 'hi' },
        query: { limit: 5 },
      },
      okSchema,
    );
    expect(seen).toEqual({
      auth: 'Bearer tok',
      contentType: 'application/json; charset=utf-8',
      body: { content: 'hi' },
      url: `${BASE}/dm/u%201/messages?limit=5`,
    });
  });

  it('응답을 못 받으면 NetworkError를 던진다', async () => {
    server.use(http.get(`${BASE}/me`, () => HttpResponse.error()));
    configureHttp({ baseUrl: BASE, tokens: makeTokens('t') });
    await expect(request({ ...ENDPOINTS.me }, okSchema)).rejects.toBeInstanceOf(NetworkError);
  });
});
