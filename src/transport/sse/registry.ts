// SSE 이벤트 type → handler 등록·디스패치 (CONVENTIONS 7장).
// payload는 handler.schema로 파싱하고, 실패하면 console.warn + 무시 (연결은 유지).
import type { z } from 'zod';

import type { SseEnvelope, SseEventType } from '../schemas';

export interface SseHandler<S extends z.ZodType = z.ZodType> {
  type: SseEventType;
  schema: S;
  /** 없으면 파싱만 한다 (ROADMAP 3단계). 5단계부터 스토어 갱신 로직을 채운다 */
  handle?(payload: z.infer<S>, envelope: SseEnvelope): void;
}

/** 타입 추론용 헬퍼. handler 파일은 이걸로 정의한다 */
export function defineSseHandler<S extends z.ZodType>(handler: SseHandler<S>): SseHandler<S> {
  return handler;
}

export type DispatchResult = 'handled' | 'parsed' | 'invalid' | 'unknown';

export class SseRegistry {
  private readonly handlers = new Map<string, SseHandler>();

  register(handler: SseHandler): void {
    if (this.handlers.has(handler.type)) {
      throw new Error(`SSE handler for "${handler.type}" is already registered`);
    }
    this.handlers.set(handler.type, handler);
  }

  registerAll(handlers: Iterable<SseHandler>): void {
    for (const handler of handlers) {
      this.register(handler);
    }
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }

  get size(): number {
    return this.handlers.size;
  }

  dispatch(envelope: SseEnvelope): DispatchResult {
    const handler = this.handlers.get(envelope.type);
    if (handler === undefined) {
      console.warn(`[sse] unknown event type "${envelope.type}" (id=${envelope.id})`);
      return 'unknown';
    }
    const parsed = handler.schema.safeParse(envelope.payload);
    if (!parsed.success) {
      console.warn(
        `[sse] invalid payload for "${envelope.type}" (id=${envelope.id})`,
        parsed.error.issues,
      );
      return 'invalid';
    }
    if (handler.handle === undefined) {
      return 'parsed';
    }
    handler.handle(parsed.data, envelope);
    return 'handled';
  }
}
