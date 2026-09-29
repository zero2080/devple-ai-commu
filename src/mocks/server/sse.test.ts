import { describe, expect, it } from 'vitest';

import { formatSseEvent, SseHub, type SseSink } from './sse.ts';

function sink(): SseSink & { chunks: string[]; ended: boolean } {
  const s = {
    chunks: [] as string[],
    ended: false,
    write: (chunk: string) => {
      s.chunks.push(chunk);
    },
    end: () => {
      s.ended = true;
    },
  };
  return s;
}

describe('formatSseEvent', () => {
  it('id·event·data 필드를 만들고 data 안의 id/type이 같다', () => {
    const frame = formatSseEvent({ id: '7', type: 'chat.public', ts: 1, payload: { a: 1 } });
    expect(frame).toBe(
      'id: 7\nevent: chat.public\ndata: {"id":"7","type":"chat.public","ts":1,"payload":{"a":1}}\n\n',
    );
  });
});

describe('SseHub', () => {
  it('broadcast는 전역 단조 증가 id로 모든 연결에 쓴다', () => {
    const hub = new SseHub();
    const a = sink();
    const b = sink();
    hub.add(a);
    hub.add(b);
    const first = hub.broadcast('system.notice', { id: 'n1' });
    const second = hub.broadcast('system.notice', { id: 'n2' });
    expect(Number(second.id)).toBe(Number(first.id) + 1);
    expect(a.chunks).toHaveLength(2);
    expect(b.chunks).toHaveLength(2);
    hub.heartbeat(123);
    expect(a.chunks[2]).toContain('event: system.heartbeat');
    expect(a.chunks[2]).toContain('"serverTime":123');
  });

  it('disconnectAll은 연결을 끝내고 비운다', () => {
    const hub = new SseHub();
    const a = sink();
    hub.add(a);
    expect(hub.disconnectAll()).toBe(1);
    expect(a.ended).toBe(true);
    expect(hub.size).toBe(0);
  });
});
