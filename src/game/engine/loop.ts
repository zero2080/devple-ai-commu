// rAF 기반 고정 로직 틱(60Hz) + 가변 렌더 (ARCHITECTURE 2.2). React 무관.
export interface LoopCallbacks {
  /** 고정 간격으로 호출. dtMs는 항상 tickMs */
  update: (dtMs: number, nowMs: number) => void;
  /** 프레임마다 1회. alpha는 다음 틱까지의 진행률(0~1) */
  render: (alpha: number, nowMs: number) => void;
}

export interface LoopOptions {
  tickMs?: number;
  /** 탭 복귀 등으로 프레임 간격이 커졌을 때 한 프레임에 처리할 최대 시간 (spiral of death 방지) */
  maxFrameMs?: number;
  requestFrame?: (cb: (t: number) => void) => number;
  cancelFrame?: (handle: number) => void;
}

export const DEFAULT_TICK_MS = 1000 / 60;

export class GameLoop {
  private readonly callbacks: LoopCallbacks;
  private readonly tickMs: number;
  private readonly maxFrameMs: number;
  private readonly requestFrame: (cb: (t: number) => void) => number;
  private readonly cancelFrame: (handle: number) => void;
  private handle: number | null = null;
  private lastFrameMs: number | null = null;
  private accumulatorMs = 0;
  private readonly onFrame = (nowMs: number): void => {
    if (this.handle === null) {
      return;
    }
    const last = this.lastFrameMs ?? nowMs;
    this.lastFrameMs = nowMs;
    this.accumulatorMs += Math.min(nowMs - last, this.maxFrameMs);
    while (this.accumulatorMs >= this.tickMs) {
      this.callbacks.update(this.tickMs, nowMs);
      this.accumulatorMs -= this.tickMs;
    }
    this.callbacks.render(this.accumulatorMs / this.tickMs, nowMs);
    this.handle = this.requestFrame(this.onFrame);
  };

  constructor(callbacks: LoopCallbacks, options: LoopOptions = {}) {
    this.callbacks = callbacks;
    this.tickMs = options.tickMs ?? DEFAULT_TICK_MS;
    this.maxFrameMs = options.maxFrameMs ?? 250;
    this.requestFrame = options.requestFrame ?? ((cb) => requestAnimationFrame(cb));
    this.cancelFrame =
      options.cancelFrame ??
      ((h) => {
        cancelAnimationFrame(h);
      });
  }

  get isRunning(): boolean {
    return this.handle !== null;
  }

  start(): void {
    if (this.handle !== null) {
      return;
    }
    this.lastFrameMs = null;
    this.accumulatorMs = 0;
    this.handle = this.requestFrame(this.onFrame);
  }

  stop(): void {
    if (this.handle === null) {
      return;
    }
    this.cancelFrame(this.handle);
    this.handle = null;
  }
}
