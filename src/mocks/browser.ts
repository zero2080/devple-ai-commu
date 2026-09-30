// MSW 워커. VITE_MOCK=true일 때만 main.tsx가 startMockWorker()를 호출한다.
// Express mock 경로(SSE·티켓·월드 REST)는 MSW가 건드리지 않고 통과시켜 Vite proxy → Express로 보낸다.
import { setupWorker } from 'msw/browser';

import { EXPRESS_MOCK_PATH_PREFIXES } from './data/config.ts';
import { readMyMessagesBy, receiveDmFrom, seedDm } from './dmSim.ts';
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

/** Express mock이 담당하는 경로 (SSE·티켓·월드 REST) */
export function isExpressMockRequest(url: string): boolean {
  const pathname = new URL(url, 'http://localhost').pathname;
  return EXPRESS_MOCK_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** DEV 트리거 (ARCHITECTURE 9장): 콘솔이나 E2E에서 가짜 상대의 DM·읽음을 흉내 낸다 */
export interface DevpleMockControls {
  dmFrom: (userId: string, content: string) => string | null;
  readBy: (userId: string) => number;
  seedDm: (userId: string, count: number) => number;
}

declare global {
  interface Window {
    __devpleMock?: DevpleMockControls;
  }
}

export async function startMockWorker(): Promise<void> {
  if (import.meta.env.DEV) {
    window.__devpleMock = {
      dmFrom: (userId, content) => receiveDmFrom(userId, content)?.id ?? null,
      readBy: (userId) => readMyMessagesBy(userId),
      seedDm: (userId, count) => seedDm(userId, count),
    };
  }
  await worker.start({
    serviceWorker: { url: '/mockServiceWorker.js' },
    onUnhandledFrame: ({ frame, defaults }) => {
      const url = requestUrlOf(frame);
      // 계약 경로(/api/)만 경고한다. 문서·정적 자산·SSE(Express mock)는 조용히 통과
      if (url === null || !isApiRequest(url) || isExpressMockRequest(url)) {
        return;
      }
      defaults.warn();
    },
  });
}
