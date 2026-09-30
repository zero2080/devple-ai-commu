// 세션 수명 (ARCHITECTURE 6장): 로그인·복구·로그아웃. 스토어에 쓰는 유일한 인증 경로.
// SSE 연결도 세션과 함께 산다: 로그인·복구 직후 연결, 로그아웃에서 종료 (2026-09-30 결정 4).
import { connectSse, disconnectSse } from '@/features/realtime';
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
  connectSse();
}

/** 새로고침 후 복구: refresh 쿠키로 Access 재발급 → GET /me. 실패하면 anonymous */
export async function restoreSession(): Promise<void> {
  try {
    await refreshAccessToken();
    const { me, config } = await getMe();
    useAuthStore.getState().setMe(me, config);
    useWorldStore.getState().setMyUserId(me.id);
    connectSse();
  } catch {
    useAuthStore.getState().setAnonymous();
  }
}

/** 로그아웃: SSE 종료 → 서버 무효화 → 스토어 초기화 */
export async function logoutSession(): Promise<void> {
  disconnectSse();
  try {
    await logout();
  } catch {
    // 서버 무효화 실패해도 클라이언트 세션은 지운다
  }
  useAuthStore.getState().clear();
  useWorldStore.getState().reset();
}
