// SSE 연결 수명 = 세션 (ARCHITECTURE 4.1·6장): 로그인·세션 복구 직후 연결, 로그아웃에서 종료. 페이지 effect가 아니라
// 세션 함수가 호출하므로 StrictMode 이중 effect로 티켓이 낭비되지 않는다. 탭당 EventSource 1개, 핸들러 17종 등록.
import { useWorldStore } from '@/store/worldStore';
import { createSseTicket } from '@/transport/api/auth';
import { SseClient } from '@/transport/sse/client';
import { ALL_SSE_HANDLERS } from '@/transport/sse/handlers';
import { SseRegistry } from '@/transport/sse/registry';
import { resyncAll } from '@/transport/sse/resync';

const registry = new SseRegistry();
registry.registerAll(ALL_SSE_HANDLERS);

let client: SseClient | null = null;

export interface SseHooks {
  /** system.suspended 수신 즉시 (세션 종료는 features/auth, 재연결하지 않는다) */
  onSuspended?: () => void;
}

export function connectSse(hooks: SseHooks = {}): SseClient {
  if (client !== null) {
    return client;
  }
  client = new SseClient({
    requestTicket: async () => (await createSseTicket()).ticket,
    onEnvelope: (envelope) => {
      registry.dispatch(envelope);
      if (envelope.type === 'system.suspended') {
        hooks.onSuspended?.();
      }
    },
    onStateChange: (state) => {
      useWorldStore.getState().setSseState(state);
    },
    // 60초 넘게 끊겼다가 다시 열림: 서버 재전송 버퍼 밖이라 REST로 다시 맞춘다 (API_CONTRACT 3.5)
    onResync: () => {
      void resyncAll();
    },
  });
  void client.connect();
  return client;
}

export function disconnectSse(): void {
  client?.close();
  client = null;
}

export function currentSseClient(): SseClient | null {
  return client;
}
