// 링크 버튼 표시 규칙 (ARCHITECTURE 2.4). 서버가 준 links[]만 다룬다 — 본문에서 URL을 찾지 않는다 (CLAUDE.md 핵심 제약 4).

/** http·https만 연다. 서버가 이미 걸렀지만 window.open 전에 한 번 더 확인한다 */
export function isOpenableLink(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** 버튼 라벨용 호스트명. 국제화 도메인은 punycode 그대로 (동형 문자 속임 방지). 열 수 없으면 null */
export function linkLabel(url: string): string | null {
  if (!isOpenableLink(url)) {
    return null;
  }
  return new URL(url).hostname;
}
