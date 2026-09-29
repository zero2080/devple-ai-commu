import { describe, expect, it } from 'vitest';

import * as admin from './admin';
import * as auth from './auth';
import * as chat from './chat';
import * as dm from './dm';
import { ENDPOINT_LIST, ENDPOINTS, withParams } from './endpoints';
import * as groups from './groups';
import * as me from './me';
import * as users from './users';
import * as world from './world';

const API_MODULES = [auth, me, users, world, chat, dm, groups, admin];

describe('ENDPOINTS', () => {
  it('API_CONTRACT 2장 엔드포인트 37개를 정의한다', () => {
    expect(ENDPOINT_LIST).toHaveLength(37);
  });

  it('method + path 조합은 유일하다', () => {
    const keys = ENDPOINT_LIST.map((e) => `${e.method} ${e.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('api 모듈의 export 함수 수 = 엔드포인트 수 (함수 하나 = 엔드포인트 하나)', () => {
    const count = API_MODULES.reduce(
      (sum, mod) => sum + Object.values(mod).filter((v) => typeof v === 'function').length,
      0,
    );
    expect(count).toBe(ENDPOINT_LIST.length);
  });

  it('SSE 티켓은 REST 엔드포인트에 포함된다 (Mock에서는 Express가 담당)', () => {
    expect(ENDPOINTS.sseTicket).toEqual({ method: 'POST', path: '/sse/ticket' });
  });
});

describe('withParams', () => {
  it(':param을 값으로 치환하고 encodeURIComponent를 적용한다', () => {
    expect(withParams('/dm/:userId/messages', { userId: 'u/1' })).toBe('/dm/u%2F1/messages');
    expect(withParams('/groups/:groupId/members/:userId', { groupId: 'g1', userId: 'u1' })).toBe(
      '/groups/g1/members/u1',
    );
  });

  it('파라미터가 빠지면 throw한다', () => {
    expect(() => withParams('/users/:userId', {})).toThrow(/missing path param "userId"/);
  });
});
