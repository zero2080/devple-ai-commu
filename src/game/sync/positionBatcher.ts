// 위치 배칭 전송 (ARCHITECTURE 3.3). Game Engine 소속: 타이밍·seq만 관리하고 전송은 transport에 위임.
// - 주기(ServerConfig.positionBatchMs, 기본 200ms)마다 마지막 위치만 전송. 바뀌지 않았으면 전송 안 함
// - seq는 Date.now() 밀리초 정수(API_CONTRACT 2.2). 같은 ms에 두 번 보내면 +1로 단조 증가 보장
// - pagehide 시 fetch keepalive로 마지막 위치 전송 (sendBeacon은 PUT·헤더 불가)
import type { Position } from '@/domain';
import type { UpdatePositionBody } from '@/transport/api/me';
import { ApiError } from '@/transport/http';
import { positionRejectedDetailsSchema } from '@/transport/schemas';

export interface PositionRejectedDetails {
  position: Position;
  seq: number;
  reason: 'collision' | 'too_far' | 'occupied';
}

/** pagehide 리스너를 붙일 대상 (window 또는 테스트용 EventTarget) */
export interface PageHideTarget {
  addEventListener(type: 'pagehide', listener: () => void): void;
  removeEventListener(type: 'pagehide', listener: () => void): void;
}

export interface PositionBatcherOptions {
  /** ServerConfig.positionBatchMs */
  intervalMs: number;
  send: (body: UpdatePositionBody, options: { keepalive: boolean }) => Promise<void>;
  /** 409 POSITION_REJECTED. 6단계에서 details.position으로 스냅 + 경로 재계산 */
  onRejected?: (details: PositionRejectedDetails) => void;
  /** 409 외 실패 (네트워크 등). 다음 틱에 마지막 위치를 다시 보낸다 */
  onError?: (error: unknown) => void;
  now?: () => number;
  /** pagehide 리스너 대상. 기본 window, 테스트·비브라우저는 null */
  pageHideTarget?: PageHideTarget | null;
}

export function isSamePosition(a: Position, b: Position): boolean {
  return a.mapId === b.mapId && a.x === b.x && a.y === b.y && a.dir === b.dir;
}

export class PositionBatcher {
  private pending: Position | null = null;
  private lastSent: Position | null = null;
  private lastSeq = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly options: PositionBatcherOptions;
  private readonly now: () => number;
  private readonly pageHideTarget: PositionBatcherOptions['pageHideTarget'];
  private readonly handlePageHide = (): void => {
    void this.flush({ keepalive: true });
  };

  constructor(options: PositionBatcherOptions) {
    this.options = options;
    this.now = options.now ?? Date.now;
    this.pageHideTarget =
      options.pageHideTarget === undefined
        ? typeof window === 'undefined'
          ? null
          : window
        : options.pageHideTarget;
  }

  get isRunning(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer !== null) {
      return;
    }
    this.timer = setInterval(() => {
      void this.flush();
    }, this.options.intervalMs);
    this.pageHideTarget?.addEventListener('pagehide', this.handlePageHide);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.pageHideTarget?.removeEventListener('pagehide', this.handlePageHide);
  }

  /** 로컬 예측 이동 때마다 호출. 마지막 값만 남는다 */
  push(position: Position): void {
    this.pending = position;
  }

  /** 서버가 마지막으로 인정한 위치 (409 보정 후 갱신됨) */
  get lastAcknowledged(): Position | null {
    return this.lastSent;
  }

  async flush(options: { keepalive?: boolean } = {}): Promise<void> {
    const position = this.pending;
    if (position === null) {
      return;
    }
    this.pending = null;
    if (this.lastSent !== null && isSamePosition(position, this.lastSent)) {
      return;
    }
    const seq = this.nextSeq();
    const previous = this.lastSent;
    this.lastSent = position;
    try {
      await this.options.send({ ...position, seq }, { keepalive: options.keepalive ?? false });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'POSITION_REJECTED') {
        const details = positionRejectedDetailsSchema.safeParse(error.details);
        if (details.success) {
          this.lastSent = details.data.position;
          this.options.onRejected?.(details.data);
        } else {
          this.lastSent = previous;
        }
        return;
      }
      // 전송 실패: 다음 틱에 같은 위치를 다시 보내도록 되돌린다
      this.lastSent = previous;
      this.restorePending(position);
      this.options.onError?.(error);
    }
  }

  /** 전송 실패 시 되돌리기. 그 사이 새 push가 없었을 때만 (await 이후라 별도 메서드에서 읽는다) */
  private restorePending(position: Position): void {
    this.pending ??= position;
  }

  private nextSeq(): number {
    const now = Math.floor(this.now());
    const seq = now > this.lastSeq ? now : this.lastSeq + 1;
    this.lastSeq = seq;
    return seq;
  }
}
