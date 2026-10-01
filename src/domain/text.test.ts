import { describe, expect, it } from 'vitest';

import { hasForbiddenContentChar, hasForbiddenNicknameChar, nfcLength } from './text';

const FAMILY = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}'; // 👨\u200D👩\u200D👧 (ZWJ 시퀀스, 5 코드 포인트)
const NFD_HAN = '\u1112\u1161\u11AB'; // '한'을 분해한 형태 (3 코드 포인트)

describe('hasForbiddenContentChar (DOMAIN 2.3 5.1 내용 금지 집합)', () => {
  it.each([
    ['NUL', 'a\u0000b'],
    ['탭 (C0)', 'a\tb'],
    ['C0 U+000B', 'a\u000Bb'],
    ['C0 U+001F', 'a\u001Fb'],
    ['DEL', 'a\u007Fb'],
    ['C1 U+0080', 'a\u0080b'],
    ['C1 U+009F', 'a\u009Fb'],
    ['폭 0 공백 U+200B', 'a\u200Bb'],
    ['비결합자 U+200C', 'a\u200Cb'],
    ['LRM U+200E', 'a\u200Eb'],
    ['RLM U+200F', 'a\u200Fb'],
    ['임베딩 U+202A', 'a\u202Ab'],
    ['RTL override U+202E', 'a\u202Eb'],
    ['단어 결합자 U+2060', 'a\u2060b'],
    ['보이지 않는 연산자 U+2064', 'a\u2064b'],
    ['격리 U+2066', 'a\u2066b'],
    ['격리 끝 U+2069', 'a\u2069b'],
    ['BOM U+FEFF', 'a\uFEFFb'],
    ['짝 없는 high surrogate', 'a\uD83Db'],
    ['짝 없는 low surrogate', 'a\uDC4Db'],
    ['끝에 남은 high surrogate', 'ab\uD83D'],
  ])('%s는 금지', (_name, text) => {
    expect(hasForbiddenContentChar(text)).toBe(true);
  });

  it('줄바꿈·ZWJ 결합 이모지·일반 이모지·한글은 허용', () => {
    expect(hasForbiddenContentChar('안녕\n반가워')).toBe(false);
    expect(hasForbiddenContentChar(`가족 ${FAMILY} 🧑\u200D💻`)).toBe(false);
    expect(hasForbiddenContentChar('👍 ok')).toBe(false);
    expect(hasForbiddenContentChar('\u2065')).toBe(false); // 표에 없는 칸 (U+2065는 미지정)
  });
});

describe('hasForbiddenNicknameChar (DOMAIN 2.3 8장: 내용 금지 집합 + 줄바꿈 + ZWJ)', () => {
  it('내용 금지 문자에 더해 줄바꿈과 ZWJ도 막는다', () => {
    expect(hasForbiddenNicknameChar('도트\n')).toBe(true);
    expect(hasForbiddenNicknameChar('도\u200D트')).toBe(true);
    expect(hasForbiddenNicknameChar('도\u202E트')).toBe(true);
    expect(hasForbiddenNicknameChar('도\t트')).toBe(true);
    expect(hasForbiddenNicknameChar('도트 👍')).toBe(false);
  });
});

describe('nfcLength (NFC 값의 코드 포인트 수)', () => {
  it('분해형 한글은 합쳐서 세고, 결합 이모지는 구성 코드 포인트만큼', () => {
    expect(NFD_HAN.length).toBe(3);
    expect(nfcLength(NFD_HAN)).toBe(1);
    expect(nfcLength(FAMILY)).toBe(5);
    expect(nfcLength('👍')).toBe(1);
    expect(nfcLength('')).toBe(0);
  });
});
