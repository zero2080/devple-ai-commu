// 채팅 휘발 상태 뼈대 (ARCHITECTURE 7장). 7단계에서 말풍선·근접 대화 로그를 채운다.
// 서버 원본 목록(DM·그룹·히스토리)은 여기 두지 않고 TanStack Query 캐시에만 둔다.
import { create } from 'zustand';

import type { SpeechBubble } from '@/domain';

export interface ChatState {
  bubbles: readonly SpeechBubble[];
  reset: () => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  bubbles: [],
  reset: () => {
    set({ bubbles: [] });
  },
}));
