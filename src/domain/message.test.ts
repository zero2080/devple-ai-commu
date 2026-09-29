import { describe, expect, it } from 'vitest';

import { bubbleDurationMs, codePointLength } from './message';

describe('codePointLength', () => {
  it('빈 문자열은 0이다', () => {
    expect(codePointLength('')).toBe(0);
  });

  it('한글과 이모지를 코드 포인트 1개로 센다', () => {
    expect(codePointLength('가나다')).toBe(3);
    expect(codePointLength('👍')).toBe(1); // UTF-16 length는 2
    expect(codePointLength('a👍b')).toBe(3);
  });
});

describe('bubbleDurationMs', () => {
  it('기본 3초에 코드 포인트당 50ms를 더한다', () => {
    expect(bubbleDurationMs('', false)).toBe(3000);
    expect(bubbleDurationMs('가'.repeat(20), false)).toBe(4000);
  });

  it('링크가 있으면 최소 6초다', () => {
    expect(bubbleDurationMs('짧음', true)).toBe(6000);
  });

  it('링크가 있어도 계산값이 6초를 넘으면 계산값을 쓴다', () => {
    expect(bubbleDurationMs('가'.repeat(70), true)).toBe(6500);
  });

  it('8초를 넘지 않는다', () => {
    expect(bubbleDurationMs('가'.repeat(200), false)).toBe(8000);
    expect(bubbleDurationMs('가'.repeat(200), true)).toBe(8000);
  });
});
