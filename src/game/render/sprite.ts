// 걷기 애니메이션과 프레임 그리기 (GRAPHICS 2.3·2.4, ARCHITECTURE 2.1)
import type { Direction } from '@/domain';

import { AVATAR_FRAME_HEIGHT, AVATAR_FRAME_WIDTH } from '../constants';

/** 걷기 프레임 1장 시간 (타일당 150ms 이동 = 2프레임/타일) */
export const WALK_FRAME_MS = 75;
/** 걷기 재생 순서: 왼발 → 서기 → 오른발 → 서기 */
const WALK_SEQUENCE = [1, 2, 3, 0] as const;
const ROWS: Readonly<Record<Direction, number>> = { down: 0, left: 1, right: 2, up: 3 };

/** 시트의 행 (GRAPHICS 2.4) */
export function rowOf(dir: Direction): number {
  return ROWS[dir];
}

/** 캐릭터마다 하나. 타일 사이 짧은 정지(원격 보간 경계 등)에서 걷기 주기가 처음부터 다시 시작하지 않게 한다 */
export interface WalkState {
  /** 걷기 주기 시작 시각. null = 서 있음 */
  startedAt: number | null;
  /** 걷다가 멈춘 시각. null = 걷는 중이거나 서 있음 */
  stoppedAt: number | null;
}

export function createWalkState(): WalkState {
  return { startedAt: null, stoppedAt: null };
}

/**
 * 이번 프레임에 그릴 프레임 번호. 이동 중이면 1→2→3→0을 75ms씩, 멈추면 0.
 * 멈춘 지 WALK_FRAME_MS 이하면 걷기 주기를 이어간다 (보간 구간 경계에서 한두 프레임씩 끊기는 것 방지)
 */
export function advanceWalk(state: WalkState, moving: boolean, nowMs: number): number {
  if (state.stoppedAt !== null && nowMs - state.stoppedAt > WALK_FRAME_MS) {
    state.startedAt = null;
    state.stoppedAt = null;
  }
  if (moving) {
    state.startedAt ??= nowMs;
    state.stoppedAt = null;
  } else if (state.startedAt !== null) {
    state.stoppedAt ??= nowMs;
  }
  if (state.startedAt === null) {
    return 0;
  }
  const step = Math.floor((nowMs - state.startedAt) / WALK_FRAME_MS) % WALK_SEQUENCE.length;
  return WALK_SEQUENCE[step] ?? 0;
}

/** 합성 시트에서 (dir, frame)을 잘라 프레임 왼쪽 위(left, top, 정수 월드 px)에 1x로 그린다 */
export function drawAvatarFrame(
  ctx: CanvasRenderingContext2D,
  sheet: CanvasImageSource,
  dir: Direction,
  frame: number,
  left: number,
  top: number,
): void {
  ctx.drawImage(
    sheet,
    frame * AVATAR_FRAME_WIDTH,
    rowOf(dir) * AVATAR_FRAME_HEIGHT,
    AVATAR_FRAME_WIDTH,
    AVATAR_FRAME_HEIGHT,
    left,
    top,
    AVATAR_FRAME_WIDTH,
    AVATAR_FRAME_HEIGHT,
  );
}
