// 세션 수명 (ARCHITECTURE 6장): 로그인·복구·로그아웃. 스토어에 쓰는 유일한 인증 경로.
// SSE 연결·자리비움 추적도 세션과 함께 산다: 로그인·복구 직후 시작, 로그아웃·정지에서 종료 (2026-09-30 결정 4, 10단계).
import {
  connectSse,
  disconnectSse,
  startPresenceTracking,
  stopPresenceTracking,
} from '@/features/realtime';
import { useAuthStore, type AuthNotice } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { queryClient } from '@/store/queryClient';
import { useUiStore } from '@/store/uiStore';
import { useWorldStore } from '@/store/worldStore';
import { login, logout } from '@/transport/api/auth';
import { getMe } from '@/transport/api/me';
import { refreshAccessToken } from '@/transport/http';

/** 세션이 살아 있는 동안 도는 것들: SSE(정지 이벤트 훅 포함)·자리비움 추적 */
function startRealtime(): void {
  connectSse({
    onSuspended: () => {
      endSession('suspended');
    },
  });
  startPresenceTracking();
}

function resetClientState(): void {
  useWorldStore.getState().reset();
  useChatStore.getState().reset();
  useUiStore.getState().resetUi();
  queryClient.clear(); // 다른 사람이 같은 탭에서 로그인해도 이전 DM이 보이지 않게
}

/** 접근 키 로그인 → 세션·내 userId 저장 */
export async function loginWithAccessKey(accessKey: string): Promise<void> {
  // 다시 시도하면 강제 종료 안내는 지운다 (실패 이유는 폼 오류가 보여준다 — 같은 문구 두 번 방지)
  useAuthStore.getState().setNotice(null);
  const session = await login({ accessKey });
  useAuthStore.getState().setSession(session);
  useWorldStore.getState().setMyUserId(session.me.id);
  startRealtime();
}

/** 새로고침 후 복구: refresh 쿠키로 Access 재발급 → GET /me. 실패하면 anonymous */
export async function restoreSession(): Promise<void> {
  try {
    await refreshAccessToken();
    const { me, config } = await getMe();
    useAuthStore.getState().setMe(me, config);
    useWorldStore.getState().setMyUserId(me.id);
    startRealtime();
  } catch {
    useAuthStore.getState().setAnonymous();
  }
}

/** 로그아웃: SSE·자리비움 종료 → 서버 무효화 → 스토어 초기화 */
export async function logoutSession(): Promise<void> {
  stopPresenceTracking();
  disconnectSse();
  try {
    await logout();
  } catch {
    // 서버 무효화 실패해도 클라이언트 세션은 지운다
  }
  useAuthStore.getState().clear();
  resetClientState();
}

/**
 * 서버가 세션을 끝냄 (정지: SSE system.suspended 또는 REST 403 USER_SUSPENDED, ARCHITECTURE 6장).
 * SSE는 재연결 없이 닫고, 서버가 이미 refresh를 무효화했으므로 POST /auth/logout은 보내지 않는다.
 * 여러 경로로 동시에 불려도 두 번째부터는 아무것도 하지 않는다
 */
export function endSession(reason: AuthNotice): void {
  if (useAuthStore.getState().status !== 'authenticated') {
    return;
  }
  stopPresenceTracking();
  disconnectSse();
  useAuthStore.getState().clear();
  useAuthStore.getState().setNotice(reason);
  resetClientState();
}
