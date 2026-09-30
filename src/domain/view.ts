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
  animFrame: number; // GRAPHICS 2.1 프레임 인덱스 (0~3)
}

/**
 * 근접 대화 로그 한 줄 (ARCHITECTURE 7). 공개 대화는 히스토리 API가 없고 발신자가 떠날 수 있어
 * 발화 시점 닉네임을 함께 둔다. 세션 한정 휘발성 로그
 */
export interface PublicLogEntry {
  id: string; // messageId
  senderId: string;
  senderNickname: string;
  content: string;
  links: string[];
  createdAt: number;
}

export type PendingStatus = 'sending' | 'failed';

/** 낙관적 전송 중인 내 공개 메시지 (CONVENTIONS 7). 서버 id가 없으므로 tempId로 식별 */
export interface PendingPublic {
  tempId: string;
  content: string;
  status: PendingStatus;
  createdAt: number;
  errorCode?: string;
}

/** 낙관적 전송 중인 내 DM (상대별) */
export interface PendingDm extends PendingPublic {
  peerId: string;
}
