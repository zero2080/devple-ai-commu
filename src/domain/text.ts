/* eslint-disable no-control-regex -- 제어 문자 검출이 이 파일의 목적 */
// 텍스트 금지 문자·길이 (DOMAIN 2.3 5.1·8장). 서버와 같은 집합 — 프론트 사전 검사와 Mock 서버가 함께 쓴다. 순수 함수

/**
 * 내용 금지 집합: C0(줄바꿈 U+000A만 허용)·DEL·C1, 폭 0 공백·비결합자·방향 표식(ZWJ U+200D는 허용 — 결합 이모지),
 * 양방향 임베딩·재정의·격리, 단어 결합자·보이지 않는 연산자, BOM
 */
const CONTENT_FORBIDDEN =
  /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B-\u200C\u200E-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/u;
/** 닉네임 = 내용 금지 집합 + 줄바꿈 + ZWJ (한 줄, 같아 보이는 다른 닉네임 방지) */
const NICKNAME_FORBIDDEN =
  /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B-\u200C\u200E-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\u000A\u200D]/u;
/** 짝 없는 서로게이트 (JSON 이스케이프 등으로 들어온 깨진 문자). u 플래그 없이 UTF-16 단위로 본다 */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

export function hasForbiddenContentChar(text: string): boolean {
  return CONTENT_FORBIDDEN.test(text) || LONE_SURROGATE.test(text);
}

export function hasForbiddenNicknameChar(text: string): boolean {
  return NICKNAME_FORBIDDEN.test(text) || LONE_SURROGATE.test(text);
}

/** 길이 = NFC로 정규화한 값의 코드 포인트 수 (결합 이모지는 구성 코드 포인트만큼) */
export function nfcLength(text: string): number {
  return Array.from(text.normalize('NFC')).length;
}
