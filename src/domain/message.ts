// 메시지 표시 규칙 (ARCHITECTURE 2.3). 글자 수는 DOMAIN.md 5.1과 같이 코드 포인트 기준.

export const BUBBLE_BASE_MS = 3000;
export const BUBBLE_PER_CODE_POINT_MS = 50;
export const BUBBLE_MIN_WITH_LINKS_MS = 6000;
export const BUBBLE_MAX_MS = 8000;

/** 코드 포인트 수. 이모지 1개 = 1자 (UTF-16 서로게이트 쌍을 1로 센다) */
export function codePointLength(content: string): number {
  return Array.from(content).length;
}

/** 말풍선 표시 시간: 3초 + 코드 포인트당 50ms, 링크가 있으면 최소 6초, 최대 8초 */
export function bubbleDurationMs(content: string, hasLinks: boolean): number {
  const raw = BUBBLE_BASE_MS + BUBBLE_PER_CODE_POINT_MS * codePointLength(content);
  const withLinkFloor = hasLinks ? Math.max(raw, BUBBLE_MIN_WITH_LINKS_MS) : raw;
  return Math.min(withLinkFloor, BUBBLE_MAX_MS);
}

export type ComposeState = 'empty' | 'too_long' | 'ok';

/**
 * 입력창 전송 가능 여부 (DOMAIN 5.1의 클라이언트 쪽 사전 확인). 공백만이면 empty, 코드 포인트가 max를 넘으면 too_long.
 * 제어 문자·NFC 등 나머지 규칙은 서버가 검증한다 (권위는 서버)
 */
export function composeState(content: string, maxLength: number): ComposeState {
  if (content.trim() === '') {
    return 'empty';
  }
  return codePointLength(content) > maxLength ? 'too_long' : 'ok';
}

/** 서버가 NFC로 저장하므로 내 전송분과 SSE 수신분을 비교할 때 같은 형태로 맞춘다 */
export function sameMessageText(a: string, b: string): boolean {
  return a.normalize('NFC') === b.normalize('NFC');
}
