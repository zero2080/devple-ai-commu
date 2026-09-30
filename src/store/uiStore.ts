// UI 상태 (ARCHITECTURE 7장): 줌 배율, 하단 패널 탭, 열린 DM 상대, 열린 프로필 카드
import { create } from 'zustand';

import { DEFAULT_ZOOM, type ZoomLevel } from '@/game/constants';

export type ChatTab = 'public' | 'dm';

export interface UiState {
  zoom: ZoomLevel;
  chatTab: ChatTab;
  /** 열린 DM 스레드의 상대. null이면 DM 탭은 목록 */
  dmPeerId: string | null;
  profileUserId: string | null;
  setZoom: (zoom: ZoomLevel) => void;
  setChatTab: (tab: ChatTab) => void;
  /** DM 탭으로 옮기고 그 상대의 스레드를 연다. 프로필 카드는 닫는다 */
  openDm: (peerId: string) => void;
  closeDmThread: () => void;
  openProfile: (userId: string) => void;
  closeProfile: () => void;
  resetUi: () => void;
}

const initial = {
  zoom: DEFAULT_ZOOM,
  chatTab: 'public' as ChatTab,
  dmPeerId: null,
  profileUserId: null,
};

export const useUiStore = create<UiState>()((set) => ({
  ...initial,
  setZoom: (zoom) => {
    set({ zoom });
  },
  setChatTab: (chatTab) => {
    set({ chatTab });
  },
  openDm: (peerId) => {
    set({ chatTab: 'dm', dmPeerId: peerId, profileUserId: null });
  },
  closeDmThread: () => {
    set({ dmPeerId: null });
  },
  openProfile: (profileUserId) => {
    set({ profileUserId });
  },
  closeProfile: () => {
    set({ profileUserId: null });
  },
  resetUi: () => {
    set(initial);
  },
}));
