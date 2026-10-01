import { describe, expect, it } from 'vitest';

import { distProblems } from './dist-checks.ts';

const index = { path: 'index.html', content: '<script src="/assets/index.js"></script>' };

describe('distProblems (운영 번들에 Mock 없음, DEPLOYMENT 3.1)', () => {
  it('깨끗한 번들은 문제없음', () => {
    expect(distProblems([index, { path: 'assets/index.js', content: 'const a=1;' }])).toEqual([]);
  });

  it('MSW 워커 파일·Mock 흔적·index.html 없음을 잡는다', () => {
    expect(
      distProblems([
        { path: 'mockServiceWorker.js', content: '' },
        { path: 'assets/index.js', content: 'fetch("/__mock/reset");setupWorker()' },
      ]),
    ).toEqual([
      'index.html 없음 — pnpm build를 먼저',
      'mockServiceWorker.js가 dist에 있음 (VITE_MOCK=false로 빌드했는지)',
      'assets/index.js: Mock 흔적 "setupWorker"',
      'assets/index.js: Mock 흔적 "/__mock/"',
    ]);
  });

  it('base64 data URL 안에서 우연히 겹친 글자는 무시하고, 그림 파일은 보지 않는다', () => {
    const png = 'data:image/png;base64,QUFBHttpResponseQUFB';
    expect(
      distProblems([
        index,
        { path: 'assets/index.js', content: `const u="${png}";` },
        { path: 'assets/a.png', content: 'HttpResponse' },
      ]),
    ).toEqual([]);
  });
});
