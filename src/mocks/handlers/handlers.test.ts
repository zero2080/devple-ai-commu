import { describe, expect, it } from 'vitest';

import { ENDPOINT_LIST, ENDPOINTS } from '@/transport/api/endpoints';

import { handlers } from './index.ts';
import { BASE } from './support.ts';

describe('MSW 핸들러', () => {
  it('SSE 티켓을 제외한 엔드포인트 전부와 1:1이다 (36 + Express 1 = 37)', () => {
    const expected = new Set(
      ENDPOINT_LIST.filter((e) => e !== ENDPOINTS.sseTicket).map((e) => `${e.method} ${e.path}`),
    );
    const actual = new Set(
      handlers.map(
        (h) => `${String(h.info.method).toUpperCase()} ${String(h.info.path).slice(BASE.length)}`,
      ),
    );
    expect([...actual].sort()).toEqual([...expected].sort());
    expect(handlers).toHaveLength(36);
    expect(handlers.length + 1).toBe(ENDPOINT_LIST.length);
  });
});
