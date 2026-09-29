import { describe, expect, it } from 'vitest';

import { TicketStore } from './tickets.ts';

describe('TicketStore', () => {
  it('발급한 티켓은 한 번만 소비된다', () => {
    const store = new TicketStore({ now: () => 1000, random: () => 0.5 });
    const ticket = store.issue();
    expect(store.consume(ticket)).toBe(true);
    expect(store.consume(ticket)).toBe(false);
  });

  it('30초가 지나면 무효다', () => {
    let now = 1000;
    const store = new TicketStore({ now: () => now, ttlMs: 30_000 });
    const ticket = store.issue();
    now += 30_001;
    expect(store.consume(ticket)).toBe(false);
  });

  it('모르는 티켓은 거부한다', () => {
    const store = new TicketStore();
    expect(store.consume('nope')).toBe(false);
  });
});
