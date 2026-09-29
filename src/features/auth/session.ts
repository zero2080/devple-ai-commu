// 세션 수명 (ARCHITECTURE 6장): 로그인·복구·로그아웃. 스토어에 쓰는 유일한 인증 경로.
import { useAuthStore } from '@/store/authStore';
import { useWorldStore } from '@/store/worldStore';
import { login, logout } from '@/transport/api/auth';
import { getMe } from '@/transport/api/me';
import { refreshAccessToken } from '@/transport/http';

/** 접근 키 로그인 → 세션·내 userId 저장 */
export async function loginWithAccessKey(accessKey: string): Promise<void> {
  const session = await login({ accessKey });
  useAuthStore.getState().setSession(session);
  useWorldStore.getState().setMyUserId(session.me.id);
}

/** 새로고침 후 복구: refresh 쿠키로 Access 재발급 → GET /me. 실패하면 anonymous */
export async function restoreSession(): Promise<void> {
  try {
    await refreshAccessToken();
    const { me, config } = await getMe();
    useAuthStore.getState().setMe(me, config);
    useWorldStore.getState().setMyUserId(me.id);
  } catch {
    useAuthStore.getState().setAnonymous();
  }
}

/** 로그아웃: 서버 무효화 → 스토어 초기화 (SSE 종료는 호출자가 먼저) */
export async function logoutSession(): Promise<void> {
  try {
    await logout();
  } catch {
    // 서버 무효화 실패해도 클라이언트 세션은 지운다
  }
  useAuthStore.getState().clear();
  useWorldStore.getState().reset();
}
