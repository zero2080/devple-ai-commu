// SSE 연결 수명 = 세션 (ARCHITECTURE 4.1·6장): 로그인·세션 복구 직후 연결, 로그아웃에서 종료. 페이지 effect가 아니라
// 세션 함수가 호출하므로 StrictMode 이중 effect로 티켓이 낭비되지 않는다. 탭당 EventSource 1개, 핸들러 17종 등록.
import { useWorldStore } from '@/store/worldStore';
import { createSseTicket } from '@/transport/api/auth';
import { SseClient } from '@/transport/sse/client';
import { ALL_SSE_HANDLERS } from '@/transport/sse/handlers';
import { SseRegistry } from '@/transport/sse/registry';

const registry = new SseRegistry();
registry.registerAll(ALL_SSE_HANDLERS);

let client: SseClient | null = null;

export function connectSse(): SseClient {
  if (client !== null) {
    return client;
  }
  client = new SseClient({
    requestTicket: async () => (await createSseTicket()).ticket,
    onEnvelope: (envelope) => {
      registry.dispatch(envelope);
    },
    onStateChange: (state) => {
      useWorldStore.getState().setSseState(state);
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
