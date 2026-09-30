import { describe, expect, it } from 'vitest';

import { ENDPOINT_LIST, ENDPOINTS } from '@/transport/api/endpoints';

import { handlers } from './index.ts';
import { BASE } from './support.ts';
import { EXPRESS_MOCK_ENDPOINT_NAMES } from '../data/config.ts';

describe('MSW 핸들러', () => {
  it('Express 담당 5개를 제외한 엔드포인트 전부와 1:1이다 (32 + Express 5 = 37)', () => {
    const expressOwned = new Set<unknown>(
      EXPRESS_MOCK_ENDPOINT_NAMES.map((name) => ENDPOINTS[name]),
    );
    const expected = new Set(
      ENDPOINT_LIST.filter((e) => !expressOwned.has(e)).map((e) => `${e.method} ${e.path}`),
    );
    const actual = new Set(
      handlers.map(
        (h) => `${String(h.info.method).toUpperCase()} ${String(h.info.path).slice(BASE.length)}`,
      ),
    );
    expect([...actual].sort()).toEqual([...expected].sort());
    expect(handlers).toHaveLength(32);
    expect(handlers.length + EXPRESS_MOCK_ENDPOINT_NAMES.length).toBe(ENDPOINT_LIST.length);
  });
});
