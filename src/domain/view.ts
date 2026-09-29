// DOMAIN.md 7장: 프론트 전용 파생 상태 (서버와 무관). 서버 타입(./types.ts)에 섞지 않는다.
import type { Presence } from './types';

export interface SpeechBubble {
  id: string; // messageId
  userId: string;
  content: string;
  links: string[]; // 있으면 말풍선에 "링크 열기" 버튼 표시
  variant: 'public' | 'dm';
  expiresAt: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

export interface RemoteCharacter {
  presence: Presence;
  renderPixel: PixelPoint; // 보간 중인 픽셀 좌표 (월드 기준)
  targetPixel: PixelPoint;
  animFrame: number;
}
