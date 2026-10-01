// Mock 서버 공통 메시지 규칙 (DOMAIN 2.3 5.1). MSW 핸들러와 Express가 같은 판정을 쓴다.
import { hasForbiddenContentChar, nfcLength } from '../../domain/text.ts';

/** 서버 규칙: content에서 http/https URL만, 최대 5개 */
export function extractLinks(content: string): string[] {
  const matches = content.match(/https?:\/\/[^\s<>"']+/g) ?? [];
  return matches.slice(0, 5);
}

/** 공백만 불가, 내용 금지 문자 불가, NFC 값의 코드 포인트 길이 제한. 통과하면 null */
export function contentError(content: string, maxLength: number): string | null {
  if (content.trim() === '') {
    return 'content must not be blank';
  }
  if (hasForbiddenContentChar(content)) {
    return 'content contains forbidden characters';
  }
  if (nfcLength(content) > maxLength) {
    return `content exceeds ${String(maxLength)} code points`;
  }
  return null;
}
