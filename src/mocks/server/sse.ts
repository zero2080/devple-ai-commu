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
  private readonly sinks = new Set<SseSink>();
  private nextId = 1;

  get size(): number {
    return this.sinks.size;
  }

  add(sink: SseSink): void {
    this.sinks.add(sink);
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
    for (const sink of this.sinks) {
      sink.write(frame);
    }
    return envelope;
  }

  /** 15초 생존 신호 (API_CONTRACT 3.1). 주석 대신 이벤트로 보내야 EventSource가 관찰한다 */
  heartbeat(now: number = Date.now()): SseEnvelopeLike {
    return this.broadcast('system.heartbeat', { serverTime: now });
  }

  /** 개발용 강제 끊김: 모든 연결을 닫아 클라이언트 onerror를 유발한다 */
  disconnectAll(): number {
    const count = this.sinks.size;
    for (const sink of this.sinks) {
      sink.end();
    }
    this.sinks.clear();
    return count;
  }
}
