// 월드 화면 오케스트레이터 (ROADMAP 5·6단계): 루프·카메라·보간·내 캐릭터 예측 이동·렌더를 묶는다. React 무관.
// 스토어는 직접 import하지 않고 WorldSource로 읽는다 (테스트 용이, 60Hz 읽기는 getState() 경로).
import type { Direction, MapData, Position, Presence } from '@/domain';

import { BUBBLE_NICKNAME_CLEARANCE_PX, CHARACTER_HEIGHT_TILES, TILE_SIZE } from '../constants';
import { LocalPlayer } from './localPlayer';
import { computeCamera, screenToWorld, type Camera } from '../engine/camera';
import { GameLoop, type LoopOptions } from '../engine/loop';
import { backingStoreSize } from '../render/backingStore';
import { renderCharacters, type DrawableCharacter } from '../render/characters';
import { createTilemapCache, renderTilemap, type TilemapCache } from '../render/tilemap';
import { RemoteInterpolator, tileToPixel } from '../sync/interpolation';

export interface WorldSource {
  presences: () => ReadonlyMap<string, Presence>;
  positions: () => ReadonlyMap<string, Position>;
  myUserId: () => string | null;
  revision: () => number;
  snapshotRevision: () => number;
  zoom: () => number;
}

/** 렌더 직후 DOM 오버레이(말풍선)가 읽는 프레임 정보. 매 프레임 같은 객체를 재사용한다 */
export interface WorldFrame {
  readonly camera: Camera;
  /** 캔버스 CSS 크기 */
  readonly viewportWidthPx: number;
  readonly viewportHeightPx: number;
  readonly nowMs: number;
  /**
   * 말풍선 꼬리 끝(캐릭터 머리 위 닉네임 블록 위)의 캔버스 기준 CSS px를 out에 쓴다.
   * 그 캐릭터가 없으면 false. 좌표는 정수 (월드 px 정수 × 정수 줌)
   */
  anchorOf(userId: string, out: { x: number; y: number }): boolean;
}

export interface WorldGameOptions {
  canvas: HTMLCanvasElement;
  map: MapData;
  source: WorldSource;
  /** 내 캐릭터가 타일에 도착하거나 방향을 바꿀 때 (배처 push·스토어 갱신) */
  onMyMove?: (position: Position) => void;
  /** 매 프레임 렌더 직후 (말풍선 위치 갱신) */
  onRendered?: (frame: WorldFrame) => void;
  now?: () => number;
  loop?: LoopOptions;
  createTilemap?: (map: MapData) => TilemapCache;
}

export class WorldGame {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly map: MapData;
  private readonly source: WorldSource;
  private readonly now: () => number;
  private readonly loop: GameLoop;
  private readonly tilemap: TilemapCache;
  private readonly interpolator = new RemoteInterpolator();
  private readonly player: LocalPlayer;
  private readonly drawables = new Map<string, DrawableCharacter>();
  private lastRevision = -1;
  private lastSnapshotRevision = -1;
  private camera: Camera = { originX: 0, originY: 0, zoom: 2 };
  private widthPx = 0;
  private heightPx = 0;
  private dpr = 1;
  private lastNow = 0;
  private readonly onRendered: ((frame: WorldFrame) => void) | undefined;
  private readonly frame: WorldFrame & {
    nowMs: number;
    viewportWidthPx: number;
    viewportHeightPx: number;
    camera: Camera;
  };

  constructor(options: WorldGameOptions) {
    this.canvas = options.canvas;
    const ctx = this.canvas.getContext('2d');
    if (ctx === null) {
      throw new Error('2d context unavailable');
    }
    this.ctx = ctx;
    this.map = options.map;
    this.source = options.source;
    this.now = options.now ?? (() => performance.now());
    this.tilemap = (options.createTilemap ?? createTilemapCache)(options.map);
    this.onRendered = options.onRendered;
    const anchorOf = (userId: string, out: { x: number; y: number }): boolean =>
      this.anchorOf(userId, out);
    this.frame = {
      camera: this.camera,
      viewportWidthPx: 0,
      viewportHeightPx: 0,
      nowMs: 0,
      anchorOf,
    };
    this.player = new LocalPlayer({
      map: options.map,
      mapId: options.map.id,
      positions: () => this.source.positions(),
      myUserId: () => this.source.myUserId(),
      onArrive: (position) => options.onMyMove?.(position),
    });
    this.loop = new GameLoop(
      {
        update: (_dt, nowMs) => {
          this.update(nowMs);
        },
        render: (_alpha, nowMs) => {
          this.render(nowMs);
        },
      },
      options.loop,
    );
    this.resize(this.canvas.width, this.canvas.height);
  }

  get currentCamera(): Camera {
    return this.camera;
  }

  get isRunning(): boolean {
    return this.loop.isRunning;
  }

  /** 클라이언트 예측 위치 (스폰 전이면 null) */
  get myPosition(): Position | null {
    return this.player.isSpawned ? this.player.position : null;
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  /** CSS px 기준. 백킹 스토어 = CSS px × DPR (반올림), 줌 배율은 정수 유지 (ARCHITECTURE 2.1) */
  resize(widthPx: number, heightPx: number, dpr = 1): void {
    this.widthPx = Math.max(1, Math.floor(widthPx));
    this.heightPx = Math.max(1, Math.floor(heightPx));
    const backing = backingStoreSize(this.widthPx, this.heightPx, dpr);
    this.dpr = backing.dpr;
    this.canvas.width = backing.width;
    this.canvas.height = backing.height;
    this.canvas.style.width = `${String(this.widthPx)}px`;
    this.canvas.style.height = `${String(this.heightPx)}px`;
    this.ctx.imageSmoothingEnabled = false;
  }

  /** 키 입력 (InputController → 여기) */
  setHeldDirection(direction: Direction | null): void {
    this.player.setHeldDirection(direction);
  }

  /** 캔버스 클릭/탭 (CSS px) → 타일 → 경로 탐색 */
  moveToScreen(screenX: number, screenY: number): void {
    const world = screenToWorld(this.camera, { x: screenX, y: screenY });
    this.player.moveTo(
      { x: Math.floor(world.x / TILE_SIZE), y: Math.floor(world.y / TILE_SIZE) },
      this.lastNow,
    );
  }

  /** 409 보정: 서버가 인정한 위치로 즉시 스냅 + 경로 재계산 */
  snapTo(position: Position): void {
    this.player.snapTo(position, this.lastNow);
  }

  /** 테스트·디버그용: 한 프레임을 즉시 처리 */
  step(nowMs: number = this.now()): void {
    this.update(nowMs);
    this.render(nowMs);
  }

  private update(nowMs: number): void {
    this.lastNow = nowMs;
    const snapshotRevision = this.source.snapshotRevision();
    if (snapshotRevision !== this.lastSnapshotRevision) {
      this.lastSnapshotRevision = snapshotRevision;
      const myUserId = this.source.myUserId();
      const mine = myUserId === null ? undefined : this.source.presences().get(myUserId);
      if (mine !== undefined) {
        // 초기 위치는 스냅샷의 본인 Presence에서. 재연결 스냅샷은 서버 기준으로 보정 (한 칸 튕김 허용)
        if (this.player.isSpawned) {
          this.player.snapTo(mine.position, nowMs);
        } else {
          this.player.spawn(mine.position);
        }
      }
    }
    const revision = this.source.revision();
    if (revision !== this.lastRevision) {
      this.lastRevision = revision;
      this.interpolator.sync(this.source.presences(), nowMs, this.source.myUserId());
    }
    this.interpolator.update(nowMs);
    this.player.update(nowMs);
  }

  private render(nowMs: number): void {
    const zoom = this.source.zoom();
    const mine = this.player.isSpawned ? this.player.renderPixel(nowMs) : null;
    const center =
      mine === null
        ? { x: (this.map.width * TILE_SIZE) / 2, y: (this.map.height * TILE_SIZE) / 2 }
        : { x: mine.x + TILE_SIZE / 2, y: mine.y + TILE_SIZE / 2 };
    this.camera = computeCamera(
      center,
      { widthPx: this.widthPx, heightPx: this.heightPx, zoom },
      this.tilemap.widthPx,
      this.tilemap.heightPx,
    );

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#101014';
    ctx.fillRect(0, 0, this.widthPx, this.heightPx);
    ctx.setTransform(zoom * this.dpr, 0, 0, zoom * this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    renderTilemap(ctx, this.tilemap, this.camera);
    this.collectDrawables(nowMs);
    renderCharacters(ctx, this.drawables.values(), this.camera);
    if (this.onRendered !== undefined) {
      this.frame.camera = this.camera;
      this.frame.viewportWidthPx = this.widthPx;
      this.frame.viewportHeightPx = this.heightPx;
      this.frame.nowMs = nowMs;
      this.onRendered(this.frame);
    }
  }

  /** 말풍선 꼬리 끝 (ARCHITECTURE 2.3): 캐릭터 프레임 상단에서 닉네임 블록만큼 위, 가로 중앙. 캔버스 기준 CSS px */
  private anchorOf(userId: string, out: { x: number; y: number }): boolean {
    const drawable = this.drawables.get(userId);
    if (drawable === undefined) {
      return false;
    }
    const worldX = Math.round(drawable.pixelX) + TILE_SIZE / 2;
    const frameTop = Math.round(drawable.pixelY) + TILE_SIZE - TILE_SIZE * CHARACTER_HEIGHT_TILES;
    const worldY = frameTop - BUBBLE_NICKNAME_CLEARANCE_PX;
    out.x = (worldX - this.camera.originX) * this.camera.zoom;
    out.y = (worldY - this.camera.originY) * this.camera.zoom;
    return true;
  }

  private collectDrawables(nowMs: number): void {
    const presences = this.source.presences();
    const myUserId = this.source.myUserId();
    for (const userId of this.drawables.keys()) {
      if (!presences.has(userId)) {
        this.drawables.delete(userId);
      }
    }
    for (const [userId, presence] of presences) {
      const isMe = userId === myUserId;
      const pixel = isMe
        ? this.player.isSpawned
          ? this.player.renderPixel(nowMs)
          : tileToPixel(presence.position.x, presence.position.y)
        : (this.interpolator.get(userId)?.renderPixel ??
          tileToPixel(presence.position.x, presence.position.y));
      const existing = this.drawables.get(userId);
      if (existing === undefined) {
        this.drawables.set(userId, {
          userId,
          nickname: presence.nickname,
          avatarId: presence.avatarId,
          state: presence.state,
          pixelX: pixel.x,
          pixelY: pixel.y,
          isMe,
        });
      } else {
        existing.nickname = presence.nickname;
        existing.avatarId = presence.avatarId;
        existing.state = presence.state;
        existing.pixelX = pixel.x;
        existing.pixelY = pixel.y;
        existing.isMe = isMe;
      }
    }
  }
}
