// UI 상태 뼈대 (ARCHITECTURE 7장): 열린 패널, 선택된 DM 대상, 줌 배율
import { create } from 'zustand';

import { DEFAULT_ZOOM, type ZoomLevel } from '@/game/constants';

export type Panel = 'dm' | 'group' | 'profile' | null;

export interface UiState {
  zoom: ZoomLevel;
  openPanel: Panel;
  setZoom: (zoom: ZoomLevel) => void;
  setOpenPanel: (panel: Panel) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  zoom: DEFAULT_ZOOM,
  openPanel: null,
  setZoom: (zoom) => {
    set({ zoom });
  },
  setOpenPanel: (openPanel) => {
    set({ openPanel });
  },
}));
