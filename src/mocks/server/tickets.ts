// SSE 접속 티켓: 30초 유효, 1회용 (API_CONTRACT 2.1·3.1). MSW와 상태를 공유할 수 없어 Express가 발급·검증한다.
export interface TicketStoreOptions {
  ttlMs?: number;
  now?: () => number;
  random?: () => number;
}

export class TicketStore {
  private readonly tickets = new Map<string, number>(); // ticket → expiresAt
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly random: () => number;
  private serial = 0;

  constructor(options: TicketStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? 30_000;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
  }

  get ttlSeconds(): number {
    return Math.round(this.ttlMs / 1000);
  }

  issue(): string {
    this.serial += 1;
    const ticket = `t_${String(this.serial)}_${Math.floor(this.random() * 1e9).toString(36)}`;
    this.tickets.set(ticket, this.now() + this.ttlMs);
    return ticket;
  }

  /** 유효하면 소비(삭제)하고 true. 없음·만료·재사용은 false */
  consume(ticket: string): boolean {
    const expiresAt = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    return expiresAt !== undefined && expiresAt >= this.now();
  }

  /** 만료된 티켓 정리 */
  sweep(): void {
    const now = this.now();
    for (const [ticket, expiresAt] of this.tickets) {
      if (expiresAt < now) {
        this.tickets.delete(ticket);
      }
    }
  }
}
