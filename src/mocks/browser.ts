// MSW 워커. VITE_MOCK=true일 때만 main.tsx가 startMockWorker()를 호출한다.
// /api/v1/sse 접두 요청(스트림·티켓)은 MSW가 건드리지 않고 통과시켜 Vite proxy → Express mock으로 보낸다.
import { setupWorker } from 'msw/browser';

import { handlers } from './handlers/index.ts';

export const worker = setupWorker(...handlers);

function requestUrlOf(frame: unknown): string | null {
  if (typeof frame === 'object' && frame !== null && 'request' in frame) {
    const request = frame.request;
    if (request instanceof Request) {
      return request.url;
    }
  }
  return null;
}

export function isSseMockRequest(url: string): boolean {
  return new URL(url, 'http://localhost').pathname.startsWith('/api/v1/sse');
}

export async function startMockWorker(): Promise<void> {
  await worker.start({
    serviceWorker: { url: '/mockServiceWorker.js' },
    onUnhandledFrame: ({ frame, defaults }) => {
      const url = requestUrlOf(frame);
      if (url !== null && isSseMockRequest(url)) {
        return; // Express mock으로 통과
      }
      defaults.warn();
    },
  });
}
