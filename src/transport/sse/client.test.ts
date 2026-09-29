import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SseEnvelope } from '../schemas';
import {
  buildSseUrl,
  computeBackoffMs,
  DEFAULT_BACKOFF,
  SseClient,
  type EventSourceLike,
  type SseConnectionState,
} from './client';

class FakeEventSource implements EventSourceLike {
  static instances: FakeEventSource[] = [];
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;
  private readonly listeners = new Map<string, (event: MessageEvent) => void>();
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    this.listeners.set(type, listener);
  }

  close(): void {
    this.closed = true;
  }

  open(): void {
    this.onopen?.(new Event('open'));
  }

  fail(): void {
    this.onerror?.(new Event('error'));
  }

  emit(type: string, data: unknown, lastEventId = ''): void {
    this.listeners.get(type)?.(new MessageEvent(type, { data: JSON.stringify(data), lastEventId }));
  }

  get listenerTypes(): string[] {
    return [...this.listeners.keys()];
  }
}

const BASE = '/api/v1';

function setup(overrides: { idleTimeoutMs?: number } = { idleTimeoutMs: 0 }) {
  let ticketNo = 0;
  const requestTicket = vi.fn(() => Promise.resolve(`t${String(++ticketNo)}`));
  const onEnvelope = vi.fn<(envelope: SseEnvelope) => void>();
  const states: SseConnectionState[] = [];
  const client = new SseClient({
    requestTicket,
    onEnvelope,
    onStateChange: (s) => states.push(s),
    baseUrl: BASE,
    createEventSource: (url) => new FakeEventSource(url),
    random: () => 0.5, // 지터 0
    ...overrides,
  });
  return { client, requestTicket, onEnvelope, states };
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.instances = [];
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('computeBackoffMs', () => {
  it('1s → 2s → 4s … 최대 30s로 늘어난다 (지터 0)', () => {
    const noJitter = () => 0.5;
    expect(
      [0, 1, 2, 3, 4, 5, 6].map((n) => computeBackoffMs(n, DEFAULT_BACKOFF, noJitter)),
    ).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });

  it('지터는 ±20% 안이다', () => {
    expect(computeBackoffMs(0, DEFAULT_BACKOFF, () => 0)).toBe(800);
    expect(computeBackoffMs(0, DEFAULT_BACKOFF, () => 1)).toBe(1200);
  });
});

describe('buildSseUrl', () => {
  it('티켓만 있으면 lastEventId를 붙이지 않는다', () => {
    expect(buildSseUrl(BASE, 't1', null)).toBe('/api/v1/sse?ticket=t1');
    expect(buildSseUrl(BASE, 't1', '42')).toBe('/api/v1/sse?ticket=t1&lastEventId=42');
  });
});

describe('SseClient', () => {
  it('연결 시 새 티켓으로 EventSource를 만들고 이벤트 17종을 구독한다', async () => {
    const { client, requestTicket, states } = setup();
    await client.connect();

    expect(requestTicket).toHaveBeenCalledTimes(1);
    const source = FakeEventSource.instances[0];
    expect(source?.url).toBe('/api/v1/sse?ticket=t1');
    expect(source?.listenerTypes).toHaveLength(17);
    source?.open();
    expect(client.connectionState).toBe('open');
    expect(states).toEqual(['connecting', 'open']);
  });

  it('봉투를 파싱해 onEnvelope에 넘기고 lastEventId를 기억한다', async () => {
    const { client, onEnvelope } = setup();
    await client.connect();
    const source = FakeEventSource.instances[0];
    const envelope = { id: '42', type: 'presence.left', ts: 1, payload: { userId: 'u1' } };

    source?.emit('presence.left', envelope, '42');
    expect(onEnvelope).toHaveBeenCalledWith(envelope);
    expect(client.lastEventId).toBe('42');
  });

  it('잘못된 JSON·봉투는 경고 후 무시한다', async () => {
    const { client, onEnvelope } = setup();
    await client.connect();
    const source = FakeEventSource.instances[0];

    source?.emit('presence.left', { id: 1 }); // ts·type 없음
    expect(onEnvelope).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it('에러 시 즉시 닫고, 백오프 후 새 티켓 + lastEventId 쿼리로 재연결한다', async () => {
    const { client, requestTicket } = setup();
    await client.connect();
    const first = FakeEventSource.instances[0];
    first?.open();
    first?.emit(
      'presence.left',
      { id: '42', type: 'presence.left', ts: 1, payload: { userId: 'u1' } },
      '42',
    );

    first?.fail();
    expect(first?.closed).toBe(true);
    expect(client.connectionState).toBe('reconnecting');
    expect(requestTicket).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(requestTicket).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(requestTicket).toHaveBeenCalledTimes(2);
    expect(FakeEventSource.instances[1]?.url).toBe('/api/v1/sse?ticket=t2&lastEventId=42');
  });

  it('연속 실패하면 백오프가 두 배씩 늘고, 연결이 열리면 초기화된다', async () => {
    const { client, requestTicket } = setup();
    await client.connect();
    FakeEventSource.instances[0]?.fail();
    await vi.advanceTimersByTimeAsync(1000); // 1s
    expect(requestTicket).toHaveBeenCalledTimes(2);
    FakeEventSource.instances[1]?.fail();
    await vi.advanceTimersByTimeAsync(1999);
    expect(requestTicket).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); // 2s
    expect(requestTicket).toHaveBeenCalledTimes(3);

    FakeEventSource.instances[2]?.open();
    FakeEventSource.instances[2]?.fail();
    await vi.advanceTimersByTimeAsync(1000); // 다시 1s
    expect(requestTicket).toHaveBeenCalledTimes(4);
  });

  it('티켓 발급이 실패해도 백오프 후 다시 시도한다', async () => {
    const requestTicket = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('401'))
      .mockResolvedValue('t2');
    const client = new SseClient({
      requestTicket,
      onEnvelope: () => undefined,
      baseUrl: BASE,
      createEventSource: (url) => new FakeEventSource(url),
      random: () => 0.5,
    });
    await client.connect();
    expect(FakeEventSource.instances).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(requestTicket).toHaveBeenCalledTimes(2);
    expect(FakeEventSource.instances[0]?.url).toBe('/api/v1/sse?ticket=t2');
  });

  it('close() 후에는 재연결하지 않는다', async () => {
    const { client, requestTicket } = setup();
    await client.connect();
    FakeEventSource.instances[0]?.fail();
    client.close();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(requestTicket).toHaveBeenCalledTimes(1);
    expect(client.connectionState).toBe('closed');
  });

  it('기본 30초 무수신이면 재연결한다 (하트비트 이벤트가 리셋)', async () => {
    const { client, requestTicket } = setup({});
    await client.connect();
    FakeEventSource.instances[0]?.open();
    await vi.advanceTimersByTimeAsync(29_999);
    expect(FakeEventSource.instances[0]?.closed).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeEventSource.instances[0]?.closed).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(requestTicket).toHaveBeenCalledTimes(2);
  });
});
