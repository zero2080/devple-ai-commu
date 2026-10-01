import { describe, expect, it } from 'vitest';

import { bubbleDurationMs, codePointLength, composeState, sameMessageText } from './message';

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

describe('composeState', () => {
  it('공백만이면 empty다', () => {
    expect(composeState('', 200)).toBe('empty');
    expect(composeState('  \n ', 200)).toBe('empty');
  });

  it('코드 포인트 기준으로 길이를 센다 (이모지 1자)', () => {
    expect(composeState('👍'.repeat(200), 200)).toBe('ok');
    expect(composeState('가'.repeat(201), 200)).toBe('too_long');
  });
});

describe('sameMessageText', () => {
  it('NFC로 정규화해 비교한다 (분리형 한글 = 완성형)', () => {
    expect(sameMessageText('\u1100\u1161', '가')).toBe(true);
    expect(sameMessageText('가', '나')).toBe(false);
  });
});

describe('composeState — DOMAIN 2.3 5.1 사전 검사', () => {
  it('금지 문자가 있으면 invalid, ZWJ 결합 이모지는 ok', () => {
    expect(composeState('안녕\u200B', 200)).toBe('invalid');
    expect(composeState('a\u202Eb', 200)).toBe('invalid');
    expect(composeState('가족 \u{1F468}\u200D\u{1F469}\u200D\u{1F467}', 200)).toBe('ok');
  });

  it('길이는 NFC 값으로 센다 (분해형 한글 100자 = 원문 300 코드 포인트)', () => {
    const nfd = '\u1112\u1161\u11AB'.repeat(100);
    expect(composeState(nfd, 200)).toBe('ok');
    expect(composeState(nfd, 99)).toBe('too_long');
  });
});
