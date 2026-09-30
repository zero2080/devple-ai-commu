// DM 식별 (ARCHITECTURE 7장): 이벤트는 conversationId, REST는 상대 userId. 매핑은 participantIds.
import type { PositionMap } from './occupancy';
import { isWithinRadius } from './proximity';
import type { DmConversation, Position } from './types';

/** 대화의 상대 userId. myId가 참여자가 아니면 데이터 불일치이므로 throw */
export function peerIdOf(
  conversation: Pick<DmConversation, 'participantIds'>,
  myId: string,
): string {
  const [first, second] = conversation.participantIds;
  if (first === myId) {
    return second;
  }
  if (second === myId) {
    return first;
  }
  throw new Error(`user ${myId} is not a participant of the conversation`);
}

/**
 * DM 말풍선을 누구 머리 위에 띄울지 (PRD 5.5, ARCHITECTURE 2.3). 띄우지 않으면 null (패널에만).
 * - 받은 DM: 발신자가 내 근접 반경 안이면 발신자
 * - 내가 보낸 DM: 상대가 반경 안이면 나 (상대 화면과 같은 판단)
 */
export function dmBubbleSpeaker(
  senderId: string,
  peerId: string,
  myUserId: string,
  myPosition: Position | null,
  positions: PositionMap,
  radius: number,
): string | null {
  if (myPosition === null) {
    return null;
  }
  const otherId = senderId === myUserId ? peerId : senderId;
  const other = positions.get(otherId);
  if (other?.mapId !== myPosition.mapId) {
    return null; // 접속 안 함(undefined)이거나 다른 맵
  }
  return isWithinRadius(myPosition, other, radius) ? senderId : null;
}
