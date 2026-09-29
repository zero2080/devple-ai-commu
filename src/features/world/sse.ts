// SSE 연결 수명 (ARCHITECTURE 4장): 탭당 EventSource 1개. 핸들러 16종을 registry에 등록하고 봉투를 디스패치한다.
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
