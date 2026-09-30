// SSE 클라이언트 (ARCHITECTURE 4장). 탭당 EventSource 1개, 재연결은 항상 수동.
// 티켓이 1회용이라 브라우저 자동 재연결(같은 URL)은 401로 실패한다 → onerror에서 close() 후 새 티켓으로 새 EventSource.
// 수동 재연결에는 Last-Event-ID 헤더가 붙지 않으므로 마지막 id를 쿼리 lastEventId로 넘긴다.
import { getHttpConfig } from '../http';
import { SSE_EVENT_TYPES, sseEnvelopeSchema, type SseEnvelope } from '../schemas';

export type SseConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

/** 브라우저 EventSource 중 이 클라이언트가 쓰는 부분. 테스트에서 가짜로 대체한다 */
export interface EventSourceLike {
  onopen: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
  close(): void;
}

export interface BackoffOptions {
  initialMs: number;
  maxMs: number;
  /** ±비율. 0.2면 ±20% */
  jitter: number;
}

export interface SseClientOptions {
  /** POST /sse/ticket. 1회용이라 연결·재연결마다 새로 받는다 */
  requestTicket: () => Promise<string>;
  onEnvelope: (envelope: SseEnvelope) => void;
  onStateChange?: (state: SseConnectionState) => void;
  /** 기본값은 http 설정의 baseUrl */
  baseUrl?: string;
  createEventSource?: (url: string) => EventSourceLike;
  /** 무수신 감시(ms). 기본 30초 (서버 `system.heartbeat` 15초 간격, API_CONTRACT 3.1). 0이면 끔 */
  idleTimeoutMs?: number;
  backoff?: Partial<BackoffOptions>;
  /** 지터용. 기본 Math.random */
  random?: () => number;
  /** 끊긴 시각부터 다시 열릴 때까지 resyncAfterMs를 넘으면 호출 (서버 재전송 버퍼 밖, ARCHITECTURE 4.1) */
  onResync?: () => void;
  /** 기본 60초 (서버 재전송 버퍼, API_CONTRACT 3.5) */
  resyncAfterMs?: number;
  /** 시각. 기본 Date.now */
  now?: () => number;
}

export const DEFAULT_BACKOFF: BackoffOptions = { initialMs: 1000, maxMs: 30000, jitter: 0.2 };
export const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
export const DEFAULT_RESYNC_AFTER_MS = 60_000;

/** attempt번째(0부터) 재시도 대기: 1s → 2s → 4s … 최대 30s, 지터 ±20% */
export function computeBackoffMs(
  attempt: number,
  backoff: BackoffOptions = DEFAULT_BACKOFF,
  random: () => number = Math.random,
): number {
  const base = Math.min(backoff.initialMs * 2 ** attempt, backoff.maxMs);
  const spread = base * backoff.jitter;
  return Math.round(base - spread + random() * 2 * spread);
}

export function buildSseUrl(baseUrl: string, ticket: string, lastEventId: string | null): string {
  const search = new URLSearchParams({ ticket });
  if (lastEventId !== null) {
    search.set('lastEventId', lastEventId);
  }
  return `${baseUrl}/sse?${search.toString()}`;
}

function defaultCreateEventSource(url: string): EventSourceLike {
  return new EventSource(url);
}

export class SseClient {
  private source: EventSourceLike | null = null;
  private state: SseConnectionState = 'idle';
  private lastId: string | null = null;
  private attempt = 0;
  private connectSeq = 0;
  private closedByUser = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  /** 열려 있던 연결이 처음 끊긴 시각. 다시 열리면 null */
  private lostAt: number | null = null;
  private readonly backoff: BackoffOptions;
  private readonly options: SseClientOptions;

  constructor(options: SseClientOptions) {
    this.options = options;
    this.backoff = { ...DEFAULT_BACKOFF, ...options.backoff };
  }

  get connectionState(): SseConnectionState {
    return this.state;
  }

  get lastEventId(): string | null {
    return this.lastId;
  }

  /** 연결 시작. EventSource 생성까지 기다린다 (open 이벤트는 기다리지 않음) */
  async connect(): Promise<void> {
    this.closedByUser = false;
    this.attempt = 0;
    await this.open();
  }

  /** 사용자 종료 (로그아웃 등). 이후 재연결하지 않는다 */
  close(): void {
    this.closedByUser = true;
    this.connectSeq += 1;
    this.clearTimers();
    this.source?.close();
    this.source = null;
    this.setState('closed');
  }

  private async open(): Promise<void> {
    const seq = ++this.connectSeq;
    this.setState(this.attempt === 0 ? 'connecting' : 'reconnecting');

    let ticket: string;
    try {
      ticket = await this.options.requestTicket();
    } catch (error) {
      if (seq !== this.connectSeq || this.closedByUser) {
        return;
      }
      console.warn('[sse] ticket request failed, will retry', error);
      this.scheduleReconnect();
      return;
    }
    if (seq !== this.connectSeq || this.closedByUser) {
      return;
    }

    const baseUrl = this.options.baseUrl ?? getHttpConfig().baseUrl;
    const create = this.options.createEventSource ?? defaultCreateEventSource;
    const source = create(buildSseUrl(baseUrl, ticket, this.lastId));
    this.source = source;

    source.onopen = () => {
      if (source !== this.source) {
        return;
      }
      this.attempt = 0;
      const gap = this.lostAt === null ? 0 : this.now() - this.lostAt;
      this.lostAt = null;
      this.setState('open');
      this.resetIdleTimer();
      if (gap > (this.options.resyncAfterMs ?? DEFAULT_RESYNC_AFTER_MS)) {
        this.options.onResync?.();
      }
    };
    source.onerror = () => {
      if (source !== this.source) {
        return;
      }
      // 자동 재연결(같은 URL·소진된 티켓)을 막기 위해 즉시 닫고 새 티켓으로 다시 연다
      source.close();
      this.source = null;
      this.markLost();
      this.scheduleReconnect();
    };
    for (const type of SSE_EVENT_TYPES) {
      source.addEventListener(type, (event) => {
        if (source === this.source) {
          this.handleMessage(event);
        }
      });
    }
  }

  private handleMessage(event: MessageEvent): void {
    this.resetIdleTimer();
    if (event.lastEventId !== '') {
      this.lastId = event.lastEventId;
    }
    let json: unknown;
    try {
      json = JSON.parse(String(event.data));
    } catch {
      console.warn('[sse] non-JSON event data ignored');
      return;
    }
    const parsed = sseEnvelopeSchema.safeParse(json);
    if (!parsed.success) {
      console.warn('[sse] invalid envelope ignored', parsed.error.issues);
      return;
    }
    this.options.onEnvelope(parsed.data);
  }

  private scheduleReconnect(): void {
    if (this.closedByUser) {
      return;
    }
    this.clearTimers();
    this.setState('reconnecting');
    const delay = computeBackoffMs(this.attempt, this.backoff, this.options.random ?? Math.random);
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.open();
    }, delay);
  }

  private resetIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    const timeout = this.options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    if (timeout <= 0) {
      return;
    }
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      console.warn(`[sse] no event for ${String(timeout)}ms, reconnecting`);
      this.source?.close();
      this.source = null;
      this.markLost();
      this.scheduleReconnect();
    }, timeout);
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  /** 첫 끊김 시각만 기록한다 (재시도가 이어져도 갱신하지 않음) */
  private markLost(): void {
    this.lostAt ??= this.now();
  }

  private clearTimers(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private setState(next: SseConnectionState): void {
    if (this.state === next) {
      return;
    }
    this.state = next;
    this.options.onStateChange?.(next);
  }
}
