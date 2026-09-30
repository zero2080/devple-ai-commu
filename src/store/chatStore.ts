// 채팅 휘발 상태 (ARCHITECTURE 7장): 말풍선, 근접 대화 로그(세션 한정), 전송 중인 내 공개 메시지.
// 서버 원본 목록(DM·그룹·히스토리)은 여기 두지 않고 TanStack Query 캐시에만 둔다 (8단계~).
import { create } from 'zustand';

import {
  bubbleDurationMs,
  sameMessageText,
  type ChatPublicEvent,
  type PendingDm,
  type PendingPublic,
  type PublicLogEntry,
  type PublicMessage,
  type SpeechBubble,
} from '@/domain';

/** 근접 대화 로그 상한 (세션 메모리 보호). 넘으면 오래된 것부터 버린다 */
export const PUBLIC_LOG_LIMIT = 200;

export interface ChatState {
  /** 사용자당 1개. 같은 사람이 다시 말하면 대체 (ARCHITECTURE 2.3) */
  bubbles: readonly SpeechBubble[];
  /** 확정된 근접 대화 (오래된 것 → 최신) */
  publicLog: readonly PublicLogEntry[];
  /** 전송 중·실패한 내 공개 메시지 */
  pendingPublic: readonly PendingPublic[];
  /** 전송 중·실패한 내 DM (상대별). 확정된 DM은 Query 캐시에만 둔다 */
  pendingDm: readonly PendingDm[];
  /** SSE chat.public 수신. myUserId는 내 전송분 확정에 쓴다 */
  receivePublic: (event: ChatPublicEvent, myUserId: string | null, now: number) => void;
  /** 낙관적 전송 시작. tempId를 돌려준다 */
  addPending: (content: string, now: number) => string;
  /** POST 201. SSE가 먼저 확정했으면 pending만 지운다 */
  confirmPending: (
    tempId: string,
    message: PublicMessage,
    senderNickname: string,
    now: number,
  ) => void;
  failPending: (tempId: string, errorCode: string) => void;
  /** 재전송 직전 상태를 sending으로 되돌린다 */
  markSending: (tempId: string) => void;
  /** 실패한(보내지지 않은) 항목만 지운다. 전송된 메시지는 불변 */
  dismissPending: (tempId: string) => void;
  removeBubble: (messageId: string) => void;
  /** 말풍선을 띄운다 (DM 등). 같은 사용자의 이전 말풍선을 대체 */
  showBubble: (
    message: { id: string; userId: string; content: string; links: string[] },
    variant: SpeechBubble['variant'],
    now: number,
  ) => void;
  addPendingDm: (peerId: string, content: string, now: number) => string;
  /** 201 확정 또는 에코로 해소 */
  removePendingDm: (tempId: string) => void;
  /** 에코(chat.dm)가 201보다 먼저 오면 같은 상대·같은 본문(NFC)의 가장 오래된 sending을 해소 */
  resolvePendingDmByEcho: (peerId: string, content: string) => void;
  failPendingDm: (tempId: string, errorCode: string) => void;
  markSendingDm: (tempId: string) => void;
  dismissPendingDm: (tempId: string) => void;
  reset: () => void;
}

let tempSeq = 0;

function toLogEntry(message: PublicMessage, senderNickname: string): PublicLogEntry {
  return {
    id: message.id,
    senderId: message.senderId,
    senderNickname,
    content: message.content,
    links: message.links,
    createdAt: message.createdAt,
  };
}

function toBubble(
  message: { id: string; userId: string; content: string; links: string[] },
  variant: SpeechBubble['variant'],
  now: number,
): SpeechBubble {
  return {
    id: message.id,
    userId: message.userId,
    content: message.content,
    links: message.links,
    variant,
    expiresAt: now + bubbleDurationMs(message.content, message.links.length > 0),
  };
}

const publicBubble = (message: PublicMessage, now: number): SpeechBubble =>
  toBubble(
    { id: message.id, userId: message.senderId, content: message.content, links: message.links },
    'public',
    now,
  );

function appendLog(log: readonly PublicLogEntry[], entry: PublicLogEntry): PublicLogEntry[] {
  const next = [...log, entry];
  return next.length > PUBLIC_LOG_LIMIT ? next.slice(next.length - PUBLIC_LOG_LIMIT) : next;
}

function replaceBubble(bubbles: readonly SpeechBubble[], bubble: SpeechBubble): SpeechBubble[] {
  return [...bubbles.filter((b) => b.userId !== bubble.userId), bubble];
}

export const useChatStore = create<ChatState>()((set, get) => ({
  bubbles: [],
  publicLog: [],
  pendingPublic: [],
  pendingDm: [],

  receivePublic: (event, myUserId, now) => {
    const state = get();
    if (state.publicLog.some((entry) => entry.id === event.id)) {
      return; // POST 201이 먼저 확정했거나 중복 수신
    }
    let pendingPublic = state.pendingPublic;
    if (event.senderId === myUserId) {
      // SSE가 먼저 온 내 메시지: 본문이 같은 가장 오래된 sending 항목을 해소 (ARCHITECTURE 7)
      const match = pendingPublic.find(
        (p) => p.status === 'sending' && sameMessageText(p.content, event.content),
      );
      if (match !== undefined) {
        pendingPublic = pendingPublic.filter((p) => p !== match);
      }
    }
    set({
      publicLog: appendLog(state.publicLog, toLogEntry(event, event.sender.nickname)),
      pendingPublic,
      bubbles: replaceBubble(state.bubbles, publicBubble(event, now)),
    });
  },

  addPending: (content, now) => {
    tempSeq += 1;
    const tempId = `tmp_${String(now)}_${String(tempSeq)}`;
    set((s) => ({
      pendingPublic: [...s.pendingPublic, { tempId, content, status: 'sending', createdAt: now }],
    }));
    return tempId;
  },

  confirmPending: (tempId, message, senderNickname, now) => {
    const state = get();
    const pendingPublic = state.pendingPublic.filter((p) => p.tempId !== tempId);
    if (state.publicLog.some((entry) => entry.id === message.id)) {
      set({ pendingPublic }); // SSE가 먼저 확정
      return;
    }
    set({
      pendingPublic,
      publicLog: appendLog(state.publicLog, toLogEntry(message, senderNickname)),
      bubbles: replaceBubble(state.bubbles, publicBubble(message, now)),
    });
  },

  failPending: (tempId, errorCode) => {
    set((s) => ({
      pendingPublic: s.pendingPublic.map((p) =>
        p.tempId === tempId ? { ...p, status: 'failed', errorCode } : p,
      ),
    }));
  },

  markSending: (tempId) => {
    set((s) => ({
      pendingPublic: s.pendingPublic.map((p) =>
        p.tempId === tempId
          ? { tempId: p.tempId, content: p.content, status: 'sending', createdAt: p.createdAt }
          : p,
      ),
    }));
  },

  dismissPending: (tempId) => {
    set((s) => ({
      pendingPublic: s.pendingPublic.filter((p) => !(p.tempId === tempId && p.status === 'failed')),
    }));
  },

  removeBubble: (messageId) => {
    set((s) => ({ bubbles: s.bubbles.filter((b) => b.id !== messageId) }));
  },

  showBubble: (message, variant, now) => {
    set((s) => ({ bubbles: replaceBubble(s.bubbles, toBubble(message, variant, now)) }));
  },

  addPendingDm: (peerId, content, now) => {
    tempSeq += 1;
    const tempId = `tmpdm_${String(now)}_${String(tempSeq)}`;
    set((s) => ({
      pendingDm: [...s.pendingDm, { tempId, peerId, content, status: 'sending', createdAt: now }],
    }));
    return tempId;
  },

  removePendingDm: (tempId) => {
    set((s) => ({ pendingDm: s.pendingDm.filter((p) => p.tempId !== tempId) }));
  },

  resolvePendingDmByEcho: (peerId, content) => {
    const match = get().pendingDm.find(
      (p) => p.peerId === peerId && p.status === 'sending' && sameMessageText(p.content, content),
    );
    if (match !== undefined) {
      set((s) => ({ pendingDm: s.pendingDm.filter((p) => p !== match) }));
    }
  },

  failPendingDm: (tempId, errorCode) => {
    set((s) => ({
      pendingDm: s.pendingDm.map((p) =>
        p.tempId === tempId ? { ...p, status: 'failed', errorCode } : p,
      ),
    }));
  },

  markSendingDm: (tempId) => {
    set((s) => ({
      pendingDm: s.pendingDm.map((p) =>
        p.tempId === tempId
          ? {
              tempId: p.tempId,
              peerId: p.peerId,
              content: p.content,
              status: 'sending',
              createdAt: p.createdAt,
            }
          : p,
      ),
    }));
  },

  dismissPendingDm: (tempId) => {
    set((s) => ({
      pendingDm: s.pendingDm.filter((p) => !(p.tempId === tempId && p.status === 'failed')),
    }));
  },

  reset: () => {
    set({ bubbles: [], publicLog: [], pendingPublic: [], pendingDm: [] });
  },
}));
