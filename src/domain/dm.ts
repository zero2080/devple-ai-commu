// DM 식별 (ARCHITECTURE 7장): 이벤트는 conversationId, REST는 상대 userId. 매핑은 participantIds.
import type { DmConversation } from './types';

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
