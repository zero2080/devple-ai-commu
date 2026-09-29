// MSW 워커. VITE_MOCK=true일 때만 main.tsx가 startMockWorker()를 호출한다.
// /api/v1/sse 접두 요청(스트림·티켓)은 MSW가 건드리지 않고 통과시켜 Vite proxy → Express mock으로 보낸다.
import { setupWorker } from 'msw/browser';

import { handlers } from './handlers/index.ts';

export const worker = setupWorker(...handlers);

/** msw 3 NetworkFrame: { protocol: 'http', data: { request } } */
function requestUrlOf(frame: unknown): string | null {
  if (typeof frame !== 'object' || frame === null || !('data' in frame)) {
    return null;
  }
  const data = frame.data;
  if (typeof data === 'object' && data !== null && 'request' in data) {
    const request = data.request;
    if (request instanceof Request) {
      return request.url;
    }
  }
  return null;
}

export function isApiRequest(url: string): boolean {
  return new URL(url, 'http://localhost').pathname.startsWith('/api/');
}

export function isSseMockRequest(url: string): boolean {
  return new URL(url, 'http://localhost').pathname.startsWith('/api/v1/sse');
}

export async function startMockWorker(): Promise<void> {
  await worker.start({
    serviceWorker: { url: '/mockServiceWorker.js' },
    onUnhandledFrame: ({ frame, defaults }) => {
      const url = requestUrlOf(frame);
      // 계약 경로(/api/)만 경고한다. 문서·정적 자산·SSE(Express mock)는 조용히 통과
      if (url === null || !isApiRequest(url) || isSseMockRequest(url)) {
        return;
      }
      defaults.warn();
    },
  });
}
