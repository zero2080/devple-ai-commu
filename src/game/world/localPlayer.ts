// 내 캐릭터 클라이언트 예측 이동 (ARCHITECTURE 3.2·3.2.1). 서버 응답을 기다리지 않는다.
// - 타일당 MOVE_DURATION_MS 보간, 키/클릭 공통
// - 다음 타일이 벽·점유면 이동 없이 dir만 (벽에 부딪힌 것과 동일)
// - 자동 이동(경로 추종)은 키 입력이 들어오면 취소, 막히면 현재 타일에서 재계산(스로틀), 재계산해도 불가면 가장 가까운 타일
// - 409 보정은 snapTo: 즉시 되돌리고 경로 재계산 (한 칸 튕김 허용)
import {
  createPathGrid,
  directionTo,
  isOccupied,
  isSameTile,
  isWall,
  planRoute,
  stepTile,
  type Direction,
  type MapGrid,
  type PixelPoint,
  type Position,
  type PositionMap,
  type TilePoint,
} from '@/domain';

import { MOVE_DURATION_MS, TILE_SIZE } from '../constants';

export const REPLAN_THROTTLE_MS = 100;

export interface LocalPlayerOptions {
  map: MapGrid;
  mapId: string;
  /** 다른 접속자 위치 (본인 포함이어도 됨 — myUserId로 제외) */
  positions: () => PositionMap;
  myUserId: () => string | null;
  /** 타일 도착 또는 방향 변경 시. 배처 push·스토어 갱신용 */
  onArrive: (position: Position) => void;
  moveDurationMs?: number;
  replanThrottleMs?: number;
}

interface MoveInProgress {
  from: TilePoint;
  to: TilePoint;
  startedAt: number;
}

export class LocalPlayer {
  private readonly options: LocalPlayerOptions;
  private readonly moveDurationMs: number;
  private readonly replanThrottleMs: number;
  private tile: TilePoint = { x: 0, y: 0 };
  private dir: Direction = 'down';
  private spawned = false;
  private moving: MoveInProgress | null = null;
  private heldDir: Direction | null = null;
  private route: TilePoint[] = [];
  private routeTarget: TilePoint | null = null;
  private faceGoalAtEnd: TilePoint | null = null;
  private lastReplanAt = Number.NEGATIVE_INFINITY;
  private readonly renderBuffer: PixelPoint = { x: 0, y: 0 };

  constructor(options: LocalPlayerOptions) {
    this.options = options;
    this.moveDurationMs = options.moveDurationMs ?? MOVE_DURATION_MS;
    this.replanThrottleMs = options.replanThrottleMs ?? REPLAN_THROTTLE_MS;
  }

  get isSpawned(): boolean {
    return this.spawned;
  }

  get position(): Position {
    return { mapId: this.options.mapId, x: this.tile.x, y: this.tile.y, dir: this.dir };
  }

  get isMoving(): boolean {
    return this.moving !== null;
  }

  get hasRoute(): boolean {
    return this.routeTarget !== null;
  }

  /** world.snapshot의 본인 Presence로 초기 위치를 잡는다 (클라이언트가 스폰 좌표를 가정하지 않음) */
  spawn(position: Position): void {
    this.tile = { x: position.x, y: position.y };
    this.dir = position.dir;
    this.spawned = true;
    this.moving = null;
    this.clearRoute();
  }

  /** 키 입력. 방향이 있으면 자동 이동 취소 */
  setHeldDirection(direction: Direction | null): void {
    this.heldDir = direction;
    if (direction !== null) {
      this.clearRoute();
    }
  }

  /** 클릭/탭 목적지. 이동 중이면 도착할 타일에서 시작하는 경로를 만든다 */
  moveTo(target: TilePoint, nowMs: number): void {
    this.routeTarget = { x: target.x, y: target.y };
    this.replan(nowMs, true);
  }

  /** 409 보정: 서버가 인정한 위치로 즉시 되돌리고, 경로가 있었으면 다시 계산 */
  snapTo(position: Position, nowMs: number): void {
    this.moving = null;
    this.tile = { x: position.x, y: position.y };
    this.dir = position.dir;
    if (this.routeTarget !== null) {
      this.replan(nowMs, true);
    }
  }

  /** 렌더용 월드 px (발 타일의 왼쪽 위). 루프 안에서 객체를 만들지 않는다 */
  renderPixel(nowMs: number): PixelPoint {
    const moving = this.moving;
    if (moving === null) {
      this.renderBuffer.x = this.tile.x * TILE_SIZE;
      this.renderBuffer.y = this.tile.y * TILE_SIZE;
      return this.renderBuffer;
    }
    const t = Math.min(1, (nowMs - moving.startedAt) / this.moveDurationMs);
    this.renderBuffer.x = (moving.from.x + (moving.to.x - moving.from.x) * t) * TILE_SIZE;
    this.renderBuffer.y = (moving.from.y + (moving.to.y - moving.from.y) * t) * TILE_SIZE;
    return this.renderBuffer;
  }

  update(nowMs: number): void {
    if (!this.spawned) {
      return;
    }
    const moving = this.moving;
    if (moving !== null) {
      if (nowMs - moving.startedAt < this.moveDurationMs) {
        return;
      }
      this.tile = moving.to;
      this.moving = null;
      this.options.onArrive(this.position);
    }
    if (this.heldDir !== null) {
      this.tryStep(this.heldDir, nowMs);
      return;
    }
    if (this.routeTarget !== null) {
      this.followRoute(nowMs);
    }
  }

  private isBlocked(tile: TilePoint): boolean {
    return (
      isWall(this.options.map, tile.x, tile.y) ||
      isOccupied(tile, this.options.positions(), this.options.myUserId() ?? undefined)
    );
  }

  private tryStep(direction: Direction, nowMs: number): void {
    const next = stepTile(this.tile, direction);
    if (this.isBlocked(next)) {
      if (this.dir !== direction) {
        this.dir = direction; // 벽에 부딪힌 것과 동일: 방향만 바꾸고 서버에 알린다
        this.options.onArrive(this.position);
      }
      return;
    }
    this.startMove(next, direction, nowMs);
  }

  private startMove(next: TilePoint, direction: Direction, nowMs: number): void {
    this.dir = direction;
    this.moving = { from: this.tile, to: next, startedAt: nowMs };
  }

  private followRoute(nowMs: number): void {
    const next = this.route[0];
    if (next === undefined) {
      this.finishRoute();
      return;
    }
    if (this.isBlocked(next)) {
      // 이동 중 경로가 막힘: 멈추지 않고 현재 타일에서 재계산 (스로틀). 새 경로가 나오면 바로 첫 칸을 밟는다
      if (!this.replan(nowMs, false)) {
        return;
      }
      const replanned = this.route[0];
      if (replanned === undefined || this.isBlocked(replanned)) {
        return;
      }
      this.stepAlong(replanned, nowMs);
      return;
    }
    this.stepAlong(next, nowMs);
  }

  private stepAlong(next: TilePoint, nowMs: number): void {
    this.route.shift();
    const direction = directionTo(this.tile, next) ?? this.dir;
    this.startMove(next, direction, nowMs);
  }

  /** 경로 재계산. 스로틀에 걸려 건너뛰면 false */
  private replan(nowMs: number, force: boolean): boolean {
    if (this.routeTarget === null) {
      return false;
    }
    if (!force && nowMs - this.lastReplanAt < this.replanThrottleMs) {
      return false;
    }
    this.lastReplanAt = nowMs;
    const grid = createPathGrid(
      this.options.map,
      this.options.positions(),
      this.options.myUserId(),
    );
    const plan = planRoute(grid, this.tile, this.routeTarget);
    this.route = plan.path;
    this.faceGoalAtEnd = plan.stoppedBeforeOccupied ? plan.goal : null;
    if (plan.path.length === 0) {
      this.finishRoute();
    }
    return true;
  }

  private finishRoute(): void {
    const face = this.faceGoalAtEnd;
    this.clearRoute();
    if (face !== null && !isSameTile(face, this.tile)) {
      const direction = directionTo(this.tile, face);
      if (direction !== null && direction !== this.dir) {
        this.dir = direction; // 목적지 점유: 직전 타일에서 목적지 방향을 본다
        this.options.onArrive(this.position);
      }
    }
  }

  private clearRoute(): void {
    this.route = [];
    this.routeTarget = null;
    this.faceGoalAtEnd = null;
  }
}
