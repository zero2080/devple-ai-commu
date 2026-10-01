// 월드 화면 오케스트레이터 (ROADMAP 5·6단계): 루프·카메라·보간·내 캐릭터 예측 이동·렌더를 묶는다. React 무관.
// 스토어는 직접 import하지 않고 WorldSource로 읽는다 (테스트 용이, 60Hz 읽기는 getState() 경로).
import type { Direction, MapData, Position, Presence } from '@/domain';

import type { LoadedTileset } from '../assets/loader';
import {
  AVATAR_BODY_BOX,
  AVATAR_FRAME_WIDTH,
  BUBBLE_NICKNAME_CLEARANCE_PX,
  NICKNAME_GAP_PX,
  TILE_SIZE,
} from '../constants';
import { LocalPlayer } from './localPlayer';
import { computeCamera, screenToWorld, type Camera } from '../engine/camera';
import { GameLoop, type LoopOptions } from '../engine/loop';
import { sharedAvatarCompositor, type AvatarCompositor } from '../render/avatarCompositor';
import { placeholderColors } from '../render/avatarPlaceholder';
import { backingStoreSize } from '../render/backingStore';
import {
  frameOrigin,
  renderCharacters,
  type DrawableCharacter,
  type WorldViewport,
} from '../render/characters';
import { createWalkState } from '../render/sprite';
import {
  createTilemapCache,
  renderOverhead,
  renderTilemap,
  type TilemapCache,
} from '../render/tilemap';
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
  /**
   * 이번 프레임에 화면에 걸친 캐릭터마다 그리기 순서(y 오름차순)로 visit을 부른다 (닉네임 DOM 레이어, GRAPHICS 5.3).
   * (x, y) = 닉네임 블록 하단 중앙의 캔버스 기준 CSS px — 프레임 상단 − NICKNAME_GAP_PX (5.2). 정수
   */
  forEachVisible(visit: (userId: string, nickname: string, x: number, y: number) => void): void;
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
  /** 타일셋 (없으면 대체 그림, GRAPHICS 3장). createTilemap을 주면 쓰지 않는다 */
  tileset?: LoadedTileset | null;
  createTilemap?: (map: MapData) => TilemapCache;
  /** 아바타 합성기. 기본은 앱 공유 합성기 (테스트는 가짜를 넣는다) */
  compositor?: AvatarCompositor;
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
  private readonly visible: DrawableCharacter[] = [];
  private readonly viewport: WorldViewport = { width: 0, height: 0 };
  private readonly compositor: AvatarCompositor;
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
    this.tilemap = (
      options.createTilemap ?? ((map) => createTilemapCache(map, options.tileset ?? null))
    )(options.map);
    this.onRendered = options.onRendered;
    this.compositor = options.compositor ?? sharedAvatarCompositor();
    const anchorOf = (userId: string, out: { x: number; y: number }): boolean =>
      this.anchorOf(userId, out);
    const forEachVisible: WorldFrame['forEachVisible'] = (visit) => {
      this.forEachVisible(visit);
    };
    this.frame = {
      camera: this.camera,
      viewportWidthPx: 0,
      viewportHeightPx: 0,
      nowMs: 0,
      anchorOf,
      forEachVisible,
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

  /**
   * 화면 좌표(캔버스 CSS px) 아래 캐릭터 (ARCHITECTURE 3.1). 스프라이트 16×32(발 타일 위로 2타일) 사각형으로 판정하고,
   * 겹치면 y가 큰(앞에 그려진) 캐릭터를 고른다. 없으면 null
   */
  characterAt(screenX: number, screenY: number): string | null {
    const world = screenToWorld(this.camera, { x: screenX, y: screenY });
    let hit: string | null = null;
    let hitY = Number.NEGATIVE_INFINITY;
    for (const drawable of this.drawables.values()) {
      // 몸 박스로 판정 (GRAPHICS 2.1 — 옆 사람 소품·모자를 눌러 엉뚱한 프로필이 열리지 않도록)
      const frame = frameOrigin(Math.round(drawable.pixelX), Math.round(drawable.pixelY));
      const left = frame.x + AVATAR_BODY_BOX.x;
      const top = frame.y + AVATAR_BODY_BOX.y;
      if (
        world.x >= left &&
        world.x < left + AVATAR_BODY_BOX.width &&
        world.y >= top &&
        world.y < top + AVATAR_BODY_BOX.height &&
        drawable.pixelY > hitY
      ) {
        hit = drawable.userId;
        hitY = drawable.pixelY;
      }
    }
    return hit;
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
    this.viewport.width = this.widthPx / zoom;
    this.viewport.height = this.heightPx / zoom;
    renderCharacters(ctx, this.drawables.values(), this.camera, this.viewport, nowMs, this.visible);
    renderOverhead(ctx, this.tilemap, this.camera); // 나무 꼭대기·지붕은 캐릭터 위 (ARCHITECTURE 2.2)
    if (this.onRendered !== undefined) {
      this.frame.camera = this.camera;
      this.frame.viewportWidthPx = this.widthPx;
      this.frame.viewportHeightPx = this.heightPx;
      this.frame.nowMs = nowMs;
      this.onRendered(this.frame);
    }
  }

  /** 말풍선 꼬리 끝 (ARCHITECTURE 2.3): 캐릭터 프레임(24×40) 상단에서 닉네임 블록만큼 위, 가로 중앙. 캔버스 기준 CSS px */
  private anchorOf(userId: string, out: { x: number; y: number }): boolean {
    const drawable = this.drawables.get(userId);
    if (drawable === undefined) {
      return false;
    }
    const frame = frameOrigin(Math.round(drawable.pixelX), Math.round(drawable.pixelY));
    const worldX = frame.x + AVATAR_FRAME_WIDTH / 2;
    const worldY = frame.y - BUBBLE_NICKNAME_CLEARANCE_PX; // 프레임 상단 = 앵커 − 40 (GRAPHICS 5.2)
    out.x = (worldX - this.camera.originX) * this.camera.zoom;
    out.y = (worldY - this.camera.originY) * this.camera.zoom;
    return true;
  }

  private forEachVisible(
    visit: (userId: string, nickname: string, x: number, y: number) => void,
  ): void {
    const { originX, originY, zoom } = this.camera;
    for (const drawable of this.visible) {
      const frame = frameOrigin(Math.round(drawable.pixelX), Math.round(drawable.pixelY));
      visit(
        drawable.userId,
        drawable.nickname,
        (frame.x + AVATAR_FRAME_WIDTH / 2 - originX) * zoom,
        (frame.y - NICKNAME_GAP_PX - originY) * zoom,
      );
    }
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
      const local = isMe && this.player.isSpawned;
      const remote = isMe ? undefined : this.interpolator.get(userId);
      const pixel = local
        ? this.player.renderPixel(nowMs)
        : (remote?.renderPixel ?? tileToPixel(presence.position.x, presence.position.y));
      // 걷기 (ARCHITECTURE 2.1): 내 캐릭터는 예측 이동·방향, 원격은 보간 중이면 이동 중이고 방향은 Presence
      const dir = local ? this.player.direction : presence.position.dir;
      const moving = local
        ? this.player.isMoving
        : remote !== undefined &&
          (remote.renderPixel.x !== remote.targetPixel.x ||
            remote.renderPixel.y !== remote.targetPixel.y);
      const existing = this.drawables.get(userId);
      if (existing === undefined) {
        this.drawables.set(userId, {
          userId,
          nickname: presence.nickname,
          appearance: presence.appearance,
          colors: placeholderColors(presence.appearance),
          sheet: this.compositor.request(presence.appearance),
          state: presence.state,
          dir,
          moving,
          walk: createWalkState(),
          pixelX: pixel.x,
          pixelY: pixel.y,
          isMe,
        });
      } else {
        existing.nickname = presence.nickname;
        if (existing.appearance !== presence.appearance) {
          // 외형이 바뀔 때만 색·합성 시트를 다시 구한다 (매 프레임 합성 금지, GRAPHICS 2.9)
          existing.appearance = presence.appearance;
          existing.colors = placeholderColors(presence.appearance);
          existing.sheet = this.compositor.request(presence.appearance);
        }
        existing.state = presence.state;
        existing.dir = dir;
        existing.moving = moving;
        existing.pixelX = pixel.x;
        existing.pixelY = pixel.y;
        existing.isMe = isMe;
      }
    }
  }
}
