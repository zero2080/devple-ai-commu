// UI 상태 (ARCHITECTURE 7장): 줌 배율, 하단 패널 탭, 열린 DM 상대·그룹, 그룹 안내, 열린 프로필 카드
import { create } from 'zustand';

import { DEFAULT_ZOOM, type ZoomLevel } from '@/game/constants';

export type ChatTab = 'public' | 'dm' | 'group';

/** 열어 둔 그룹에서 빠졌을 때 목록 위에 남기는 안내 (group.removed) */
export interface GroupNotice {
  name: string;
  reason: 'kicked' | 'dissolved';
}

export interface UiState {
  zoom: ZoomLevel;
  chatTab: ChatTab;
  /** 열린 DM 스레드의 상대. null이면 DM 탭은 목록 */
  dmPeerId: string | null;
  /** 열린 그룹 스레드. null이면 그룹 탭은 목록 */
  groupId: string | null;
  groupNotice: GroupNotice | null;
  profileUserId: string | null;
  setZoom: (zoom: ZoomLevel) => void;
  setChatTab: (tab: ChatTab) => void;
  /** DM 탭으로 옮기고 그 상대의 스레드를 연다. 프로필 카드는 닫는다 */
  openDm: (peerId: string) => void;
  closeDmThread: () => void;
  /** 그룹 탭으로 옮기고 그 그룹의 스레드를 연다. 안내·프로필 카드는 닫는다 */
  openGroup: (groupId: string) => void;
  closeGroupThread: () => void;
  /** 그룹에서 빠짐: 그 그룹이 열려 있으면 닫고, 안내가 있으면 남긴다 */
  leaveGroupView: (groupId: string, notice: GroupNotice | null) => void;
  dismissGroupNotice: () => void;
  openProfile: (userId: string) => void;
  closeProfile: () => void;
  resetUi: () => void;
}

const initial = {
  zoom: DEFAULT_ZOOM,
  chatTab: 'public' as ChatTab,
  dmPeerId: null,
  groupId: null,
  groupNotice: null,
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
  openGroup: (groupId) => {
    set({ chatTab: 'group', groupId, groupNotice: null, profileUserId: null });
  },
  closeGroupThread: () => {
    set({ groupId: null });
  },
  leaveGroupView: (groupId, notice) => {
    set((s) => ({
      groupId: s.groupId === groupId ? null : s.groupId,
      groupNotice: notice ?? s.groupNotice,
    }));
  },
  dismissGroupNotice: () => {
    set({ groupNotice: null });
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
