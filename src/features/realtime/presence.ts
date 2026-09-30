// 자리비움 추적 (ARCHITECTURE 3.5, PRD 5.2): 입력이 AWAY_TIMEOUT_MS 없으면 away, 다시 입력하면 online.
// 입력마다 타이머를 다시 걸지 않는다 — 마지막 입력 시각만 기록하고, 타이머가 깨어나 남은 시간을 다시 잰다.
// 서버가 받아들인 상태(confirmed)와 원하는 상태(desired)가 다르면 한 번에 하나씩 보낸다. 실패하면 다음 입력·만료 때 다시.
import type { PresenceState } from '@/domain';
import { AWAY_TIMEOUT_MS } from '@/game/constants';
import { updatePresence } from '@/transport/api/me';

export interface PresenceTrackerOptions {
  timeoutMs: number;
  send: (state: PresenceState) => Promise<void>;
  now?: () => number;
}

export class PresenceTracker {
  private desired: PresenceState = 'online';
  /** 접속 직후 서버의 내 상태는 online */
  private confirmed: PresenceState = 'online';
  private lastInput = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sending = false;
  private running = false;
  private timeoutMs: number;
  private readonly options: PresenceTrackerOptions;

  constructor(options: PresenceTrackerOptions) {
    this.options = options;
    this.timeoutMs = options.timeoutMs;
  }

  get state(): PresenceState {
    return this.confirmed;
  }

  start(): void {
    this.running = true;
    this.lastInput = this.now();
    this.arm(this.timeoutMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** 입력 이벤트마다 호출 (pointermove 포함 — 가볍게 유지) */
  input(): void {
    if (!this.running) {
      return;
    }
    this.lastInput = this.now();
    this.desired = 'online';
    this.flush();
  }

  /** DEV·E2E: 만료 시간을 바꾸고 지금부터 다시 잰다 */
  setTimeoutMs(ms: number): void {
    this.timeoutMs = ms;
    if (this.running) {
      this.arm(Math.max(0, ms - (this.now() - this.lastInput)));
    }
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  private arm(delay: number): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.check();
    }, delay);
  }

  private check(): void {
    if (!this.running) {
      return;
    }
    const idle = this.now() - this.lastInput;
    if (idle >= this.timeoutMs) {
      this.desired = 'away';
      this.flush();
      this.arm(this.timeoutMs); // away 전송이 실패했으면 다음 만료에 다시
    } else {
      this.arm(this.timeoutMs - idle);
    }
  }

  private flush(): void {
    if (this.sending || this.desired === this.confirmed) {
      return;
    }
    const target = this.desired;
    this.sending = true;
    this.options
      .send(target)
      .then(
        () => {
          this.confirmed = target;
          return true;
        },
        (error: unknown) => {
          console.warn(`[presence] ${target} failed, will retry`, error);
          return false;
        },
      )
      .then((ok) => {
        this.sending = false;
        // 보내는 동안 원하는 상태가 또 바뀌었으면 이어서 보낸다
        if (ok && this.running) {
          this.flush();
        }
      })
      .catch(() => undefined);
  }
}

const INPUT_EVENTS = ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart'] as const;
const LISTEN = { capture: true, passive: true } as const;

let tracker: PresenceTracker | null = null;
const onInput = (): void => {
  tracker?.input();
};

/** 세션 시작 시 (로그인·복구). 이미 돌고 있으면 그대로 */
export function startPresenceTracking(): void {
  if (tracker !== null) {
    return;
  }
  tracker = new PresenceTracker({ timeoutMs: AWAY_TIMEOUT_MS, send: updatePresence });
  tracker.start();
  for (const type of INPUT_EVENTS) {
    window.addEventListener(type, onInput, LISTEN);
  }
  if (import.meta.env.DEV && window.__devple !== undefined) {
    window.__devple.setAwayTimeoutMs = (ms) => {
      tracker?.setTimeoutMs(ms);
    };
  }
}

/** 세션 종료 시 (로그아웃·정지) */
export function stopPresenceTracking(): void {
  for (const type of INPUT_EVENTS) {
    window.removeEventListener(type, onInput, LISTEN);
  }
  tracker?.stop();
  tracker = null;
}
