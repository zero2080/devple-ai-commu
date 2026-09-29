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
