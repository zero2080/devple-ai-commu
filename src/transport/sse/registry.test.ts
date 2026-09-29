import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { SSE_EVENT_TYPES, type SseEnvelope } from '../schemas';
import { ALL_SSE_HANDLERS } from './handlers';
import { defineSseHandler, SseRegistry } from './registry';

function envelope(type: string, payload: unknown): SseEnvelope {
  return { id: '1', type, ts: 1, payload };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SseRegistry.dispatch', () => {
  it('payload를 스키마로 파싱해 handle에 넘긴다', () => {
    const handle = vi.fn();
    const registry = new SseRegistry();
    registry.register(
      defineSseHandler({ type: 'presence.left', schema: z.object({ userId: z.string() }), handle }),
    );

    expect(registry.dispatch(envelope('presence.left', { userId: 'u1' }))).toBe('handled');
    expect(handle).toHaveBeenCalledWith({ userId: 'u1' }, expect.objectContaining({ id: '1' }));
  });

  it('파싱 실패는 console.warn 후 무시한다 (연결 유지)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const handle = vi.fn();
    const registry = new SseRegistry();
    registry.register(
      defineSseHandler({ type: 'presence.left', schema: z.object({ userId: z.string() }), handle }),
    );

    expect(registry.dispatch(envelope('presence.left', { userId: 42 }))).toBe('invalid');
    expect(handle).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('등록되지 않은 type은 unknown으로 경고한다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const registry = new SseRegistry();
    expect(registry.dispatch(envelope('nope', {}))).toBe('unknown');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('handle이 없는 핸들러는 파싱만 한다', () => {
    const registry = new SseRegistry();
    registry.register(defineSseHandler({ type: 'system.suspended', schema: z.object({}) }));
    expect(registry.dispatch(envelope('system.suspended', {}))).toBe('parsed');
  });

  it('같은 type을 두 번 등록하면 throw한다', () => {
    const registry = new SseRegistry();
    const handler = defineSseHandler({ type: 'system.suspended', schema: z.object({}) });
    registry.register(handler);
    expect(() => {
      registry.register(handler);
    }).toThrow(/already registered/);
  });
});

describe('ALL_SSE_HANDLERS', () => {
  it('API_CONTRACT 3.3 이벤트 16종과 1:1이다', () => {
    const types = ALL_SSE_HANDLERS.map((h) => h.type).sort();
    expect(types).toEqual([...SSE_EVENT_TYPES].sort());
    expect(types).toHaveLength(16);
  });

  it('registry에 전부 등록된다', () => {
    const registry = new SseRegistry();
    registry.registerAll(ALL_SSE_HANDLERS);
    expect(registry.size).toBe(16);
  });
});
