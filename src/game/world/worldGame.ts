// 월드 화면 오케스트레이터 (ROADMAP 5단계): 루프·카메라·보간·렌더를 묶는다. React 무관.
// 스토어는 직접 import하지 않고 WorldSource로 읽는다 (테스트 용이, 60Hz 읽기는 getState() 경로).
import type { MapData, Presence } from '@/domain';

import { TILE_SIZE } from '../constants';
import { computeCamera, type Camera } from '../engine/camera';
import { GameLoop, type LoopOptions } from '../engine/loop';
import { renderCharacters, type DrawableCharacter } from '../render/characters';
import { createTilemapCache, renderTilemap, type TilemapCache } from '../render/tilemap';
import { RemoteInterpolator, tileToPixel } from '../sync/interpolation';

export interface WorldSource {
  presences: () => ReadonlyMap<string, Presence>;
  myUserId: () => string | null;
  revision: () => number;
  zoom: () => number;
}

export interface WorldGameOptions {
  canvas: HTMLCanvasElement;
  map: MapData;
  source: WorldSource;
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
  private readonly drawables = new Map<string, DrawableCharacter>();
  private lastRevision = -1;
  private camera: Camera = { originX: 0, originY: 0, zoom: 2 };
  private widthPx = 0;
  private heightPx = 0;

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
    this.loop = new GameLoop(
      {
        update: (_dt, nowMs) => {
          this.update(nowMs);
        },
        render: () => {
          this.render();
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

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  /** CSS px 기준. 백킹 스토어 = CSS px (DPR 미반영, 정수 줌만 적용) */
  resize(widthPx: number, heightPx: number): void {
    this.widthPx = Math.max(1, Math.floor(widthPx));
    this.heightPx = Math.max(1, Math.floor(heightPx));
    this.canvas.width = this.widthPx;
    this.canvas.height = this.heightPx;
    this.ctx.imageSmoothingEnabled = false;
  }

  /** 테스트·디버그용: 한 프레임을 즉시 처리 */
  step(nowMs: number = this.now()): void {
    this.update(nowMs);
    this.render();
  }

  private update(nowMs: number): void {
    const revision = this.source.revision();
    if (revision !== this.lastRevision) {
      this.lastRevision = revision;
      this.interpolator.sync(this.source.presences(), nowMs, this.source.myUserId());
    }
    this.interpolator.update(nowMs);
  }

  private myPixel(): { x: number; y: number } | null {
    const myUserId = this.source.myUserId();
    if (myUserId === null) {
      return null;
    }
    const me = this.source.presences().get(myUserId);
    return me === undefined ? null : tileToPixel(me.position.x, me.position.y);
  }

  private render(): void {
    const zoom = this.source.zoom();
    const mine = this.myPixel();
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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#101014';
    ctx.fillRect(0, 0, this.widthPx, this.heightPx);
    ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
    ctx.imageSmoothingEnabled = false;
    renderTilemap(ctx, this.tilemap, this.camera);
    this.collectDrawables();
    renderCharacters(ctx, this.drawables.values(), this.camera);
  }

  private collectDrawables(): void {
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
        ? tileToPixel(presence.position.x, presence.position.y)
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
