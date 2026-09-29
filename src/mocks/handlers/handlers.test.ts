import { describe, expect, it } from 'vitest';

import { ENDPOINT_LIST, ENDPOINTS } from '@/transport/api/endpoints';

import { handlers } from './index.ts';
import { BASE } from './support.ts';
import { EXPRESS_MOCK_ENDPOINT_NAMES } from '../data/config.ts';

describe('MSW 핸들러', () => {
  it('Express 담당 4개를 제외한 엔드포인트 전부와 1:1이다 (33 + Express 4 = 37)', () => {
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
    expect(handlers).toHaveLength(33);
    expect(handlers.length + EXPRESS_MOCK_ENDPOINT_NAMES.length).toBe(ENDPOINT_LIST.length);
  });
});
