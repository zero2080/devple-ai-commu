// 인증 상태: 토큰·내 정보·서버 설정 (ARCHITECTURE 7장). 토큰은 메모리에만 (CONVENTIONS 8장).
import { create } from 'zustand';

import type { AuthSession, Me, ServerConfig } from '@/domain';
import type { TokenProvider } from '@/transport/http';

export type AuthStatus = 'unknown' | 'anonymous' | 'authenticated';

/** 로그인 화면에 남길 안내 (세션이 강제로 끝난 이유) */
export type AuthNotice = 'suspended';

export interface AuthState {
  status: AuthStatus;
  accessToken: string | null;
  /** epoch ms. 선제 갱신 판단용 */
  expiresAt: number | null;
  me: Me | null;
  config: ServerConfig | null;
  notice: AuthNotice | null;
  setSession: (session: AuthSession) => void;
  setAccessToken: (token: string, expiresInSec: number) => void;
  setMe: (me: Me, config: ServerConfig) => void;
  setAnonymous: () => void;
  clear: () => void;
  setNotice: (notice: AuthNotice | null) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'unknown',
  accessToken: null,
  expiresAt: null,
  me: null,
  config: null,
  notice: null,
  setSession: (session) => {
    set({
      notice: null,
      status: 'authenticated',
      accessToken: session.accessToken,
      expiresAt: Date.now() + session.expiresIn * 1000,
      me: session.me,
      config: session.config,
    });
  },
  setAccessToken: (token, expiresInSec) => {
    set({ accessToken: token, expiresAt: Date.now() + expiresInSec * 1000 });
  },
  setMe: (me, config) => {
    set({ status: 'authenticated', me, config });
  },
  setAnonymous: () => {
    set({ status: 'anonymous', accessToken: null, expiresAt: null, me: null, config: null });
  },
  clear: () => {
    set({ status: 'anonymous', accessToken: null, expiresAt: null, me: null, config: null });
  },
  setNotice: (notice) => {
    set({ notice });
  },
}));

/** transport/http.ts에 주입하는 토큰 저장소 어댑터 */
export const authTokenProvider: TokenProvider = {
  getAccessToken: () => useAuthStore.getState().accessToken,
  setAccessToken: (token, expiresIn) => {
    useAuthStore.getState().setAccessToken(token, expiresIn);
  },
  clear: () => {
    useAuthStore.getState().clear();
  },
};
