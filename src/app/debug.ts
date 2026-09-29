// 개발·E2E 검증용 훅. DEV 빌드에서만 window.__devple로 스토어를 노출한다 (프로덕션 번들에서는 제거됨).
import { useAuthStore } from '@/store/authStore';
import { useWorldStore } from '@/store/worldStore';

export interface DevpleDebug {
  worldStore: typeof useWorldStore;
  authStore: typeof useAuthStore;
}

declare global {
  interface Window {
    __devple?: DevpleDebug;
  }
}

export function exposeDebugHooks(): void {
  if (import.meta.env.DEV) {
    window.__devple = { worldStore: useWorldStore, authStore: useAuthStore };
  }
}
