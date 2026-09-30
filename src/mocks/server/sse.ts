// SSE 프레임 조립과 연결 허브 (API_CONTRACT 3.1·3.2)
export interface SseSink {
  write(chunk: string): void;
  end(): void;
}

export interface SseEnvelopeLike {
  id: string;
  type: string;
  ts: number;
  payload: unknown;
}

/** `id: N\nevent: type\ndata: {...}\n\n` — id와 data.id, event와 data.type이 같다 */
export function formatSseEvent(envelope: SseEnvelopeLike): string {
  return `id: ${envelope.id}\nevent: ${envelope.type}\ndata: ${JSON.stringify(envelope)}\n\n`;
}

export class SseHub {
  /** sink → 연결한 사용자 id (티켓 바인딩) */
  private readonly sinks = new Map<SseSink, string>();
  private nextId = 1;

  get size(): number {
    return this.sinks.size;
  }

  add(sink: SseSink, userId = ''): void {
    this.sinks.set(sink, userId);
  }

  remove(sink: SseSink): void {
    this.sinks.delete(sink);
  }

  /** 전역 단조 증가 id를 붙여 봉투를 만든다 */
  envelope(type: string, payload: unknown, ts: number = Date.now()): SseEnvelopeLike {
    const id = String(this.nextId);
    this.nextId += 1;
    return { id, type, ts, payload };
  }

  sendTo(sink: SseSink, type: string, payload: unknown): SseEnvelopeLike {
    const envelope = this.envelope(type, payload);
    sink.write(formatSseEvent(envelope));
    return envelope;
  }

  broadcast(type: string, payload: unknown): SseEnvelopeLike {
    const envelope = this.envelope(type, payload);
    const frame = formatSseEvent(envelope);
    for (const sink of this.sinks.keys()) {
      sink.write(frame);
    }
    return envelope;
  }

  /** 수신자를 고른 방송 (근접 판정 등). 조건을 만족한 연결 수를 돌려준다 */
  broadcastWhere(
    type: string,
    payload: unknown,
    accept: (userId: string) => boolean,
  ): { envelope: SseEnvelopeLike; recipients: number } {
    const envelope = this.envelope(type, payload);
    const frame = formatSseEvent(envelope);
    let recipients = 0;
    for (const [sink, userId] of this.sinks) {
      if (accept(userId)) {
        sink.write(frame);
        recipients += 1;
      }
    }
    return { envelope, recipients };
  }

  /** 연결된 사용자 id 목록 (중복 제거) */
  connectedUserIds(): string[] {
    return [...new Set(this.sinks.values())];
  }

  /** 15초 생존 신호 (API_CONTRACT 3.1). 주석 대신 이벤트로 보내야 EventSource가 관찰한다 */
  heartbeat(now: number = Date.now()): SseEnvelopeLike {
    return this.broadcast('system.heartbeat', { serverTime: now });
  }

  /** 개발용 강제 끊김: 모든 연결을 닫아 클라이언트 onerror를 유발한다 */
  disconnectAll(): number {
    const count = this.sinks.size;
    for (const sink of this.sinks.keys()) {
      sink.end();
    }
    this.sinks.clear();
    return count;
  }
}
