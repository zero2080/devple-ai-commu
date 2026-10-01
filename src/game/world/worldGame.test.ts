import { describe, expect, it, vi } from 'vitest';

import type { MapData, Presence } from '@/domain';
import { TEST_APPEARANCE } from '@/test/fixtures';

import { BUBBLE_NICKNAME_CLEARANCE_PX, NICKNAME_GAP_PX } from '../constants';
import { WorldGame, type WorldFrame, type WorldSource } from './worldGame';
import { AvatarCompositor } from '../render/avatarCompositor';
import type { TilemapCache } from '../render/tilemap';

const map: MapData = {
  id: 'main',
  width: 40,
  height: 30,
  tileSize: 16,
  tileset: 'main',
  spawn: { x: 20, y: 15 },
  layers: [],
  collision: new Array<number>(40 * 30).fill(0),
};

function presence(userId: string, x: number, y: number): Presence {
  return {
    userId,
    nickname: userId,
    appearance: TEST_APPEARANCE,
    position: { mapId: 'main', x, y, dir: 'down' },
    state: 'online',
    updatedAt: 1,
  };
}

/** 합성이 끝나지 않는 합성기 (플레이스홀더로 그린다) */
const idleCompositor = () =>
  new AvatarCompositor({
    loadSheet: () => new Promise<CanvasImageSource>(() => undefined),
    readPixels: () => new Uint8ClampedArray(),
    toImage: () => ({}) as CanvasImageSource,
  });

/** 바로 합성되는 합성기. 합성 시트는 표식 객체 */
const SHEET = { composed: true } as unknown as CanvasImageSource;
const readyCompositor = () =>
  new AvatarCompositor({
    loadSheet: () => Promise.resolve({} as CanvasImageSource),
    readPixels: () => new Uint8ClampedArray(96 * 160 * 4),
    toImage: () => SHEET,
  });

/** jsdom에는 2d 컨텍스트가 없으므로 기록만 하는 가짜 컨텍스트 */
function fakeCanvas(drawImage: (...args: unknown[]) => void = () => undefined): HTMLCanvasElement {
  const ctx = new Proxy(
    { imageSmoothingEnabled: false, drawImage },
    {
      get: (target, prop) =>
        prop in target ? target[prop as keyof typeof target] : () => undefined,
      set: () => true,
    },
  );
  const canvas = document.createElement('canvas');
  canvas.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext'];
  return canvas;
}

const fakeTilemap = (): TilemapCache => ({
  canvas: document.createElement('canvas'),
  widthPx: 640,
  heightPx: 480,
});

describe('WorldGame 프레임 콜백과 말풍선 앵커', () => {
  it('렌더 직후 onRendered를 부르고 anchorOf가 닉네임 블록 위 정수 CSS px를 준다', () => {
    const presences = new Map([
      ['me', presence('me', 20, 15)],
      ['a', presence('a', 22, 15)],
    ]);
    const positions = new Map([...presences].map(([id, p]) => [id, p.position]));
    const frames: {
      camera: WorldFrame['camera'];
      anchor: { x: number; y: number } | null;
      missing: boolean;
    }[] = [];
    const game = new WorldGame({
      canvas: fakeCanvas(),
      map,
      createTilemap: fakeTilemap,
      compositor: idleCompositor(),
      source: {
        presences: () => presences,
        positions: () => positions,
        myUserId: () => 'me',
        revision: () => 1,
        snapshotRevision: () => 1,
        zoom: () => 2,
      },
      onRendered: (frame) => {
        const out = { x: 0, y: 0 };
        const ok = frame.anchorOf('a', out);
        frames.push({
          camera: { ...frame.camera },
          anchor: ok ? { ...out } : null,
          missing: !frame.anchorOf('ghost', out),
        });
      },
      now: () => 0,
    });
    game.resize(400, 300, 1);
    game.step(0);

    expect(frames).toHaveLength(1);
    const { camera, anchor, missing } = frames[0] ?? { camera: null, anchor: null, missing: false };
    expect(missing).toBe(true);
    expect(camera).not.toBeNull();
    // a는 타일 (22,15): 월드 x = 22*16 + 8, 프레임(24×40) 상단 = 15*16 + 16 - 40, 꼬리 끝 = 그 위 15px
    const worldX = 22 * 16 + 8;
    const worldY = 15 * 16 + 16 - 40 - BUBBLE_NICKNAME_CLEARANCE_PX;
    expect(anchor).toEqual({
      x: (worldX - (camera?.originX ?? 0)) * 2,
      y: (worldY - (camera?.originY ?? 0)) * 2,
    });
    expect(Number.isInteger(anchor?.x) && Number.isInteger(anchor?.y)).toBe(true);
  });

  it('onRendered 없이도 렌더 한 프레임을 처리한다', () => {
    const game = new WorldGame({
      canvas: fakeCanvas(),
      map,
      createTilemap: fakeTilemap,
      compositor: idleCompositor(),
      source: {
        presences: () => new Map(),
        positions: () => new Map(),
        myUserId: () => null,
        revision: () => 0,
        snapshotRevision: () => 0,
        zoom: () => 2,
      },
    });
    expect(() => {
      game.step(0);
    }).not.toThrow();
  });
});

describe('말풍선 수직 배치 공식 (GRAPHICS 5.2)', () => {
  it('PixelKo 닉네임(12px, DOM)에서 꼬리 끝은 프레임 상단 − 15이다', () => {
    expect(BUBBLE_NICKNAME_CLEARANCE_PX).toBe(15);
  });
});

describe('characterAt (ARCHITECTURE 3.1)', () => {
  function gameWith(presences: Map<string, Presence>): WorldGame {
    const positions = new Map([...presences].map(([id, p]) => [id, p.position]));
    const game = new WorldGame({
      canvas: fakeCanvas(),
      map,
      createTilemap: fakeTilemap,
      compositor: idleCompositor(),
      source: {
        presences: () => presences,
        positions: () => positions,
        myUserId: () => 'me',
        revision: () => 1,
        snapshotRevision: () => 1,
        zoom: () => 2,
      },
    });
    game.resize(640, 480, 1);
    game.step(0);
    return game;
  }
  const screenOf = (game: WorldGame, worldX: number, worldY: number) => ({
    x: (worldX - game.currentCamera.originX) * game.currentCamera.zoom,
    y: (worldY - game.currentCamera.originY) * game.currentCamera.zoom,
  });

  it('발 타일과 그 위 한 타일(머리)을 누르면 그 캐릭터다', () => {
    const game = gameWith(
      new Map([
        ['me', presence('me', 20, 15)],
        ['a', presence('a', 22, 15)],
      ]),
    );
    const feet = screenOf(game, 22 * 16 + 8, 15 * 16 + 8);
    const head = screenOf(game, 22 * 16 + 8, 14 * 16 + 2);
    expect(game.characterAt(feet.x, feet.y)).toBe('a');
    expect(game.characterAt(head.x, head.y)).toBe('a');
    const empty = screenOf(game, 24 * 16 + 8, 15 * 16 + 8);
    expect(game.characterAt(empty.x, empty.y)).toBeNull();
  });

  it('겹치면 아래쪽(앞에 그려진) 캐릭터를 고른다', () => {
    // b(22,16)의 머리 타일 = a(22,15)의 발 타일
    const game = gameWith(
      new Map([
        ['me', presence('me', 20, 15)],
        ['a', presence('a', 22, 15)],
        ['b', presence('b', 22, 16)],
      ]),
    );
    const overlap = screenOf(game, 22 * 16 + 8, 15 * 16 + 8);
    expect(game.characterAt(overlap.x, overlap.y)).toBe('b');
  });
});

describe('걷기 애니메이션과 닉네임 앵커 (GRAPHICS 2.3·5.3, ARCHITECTURE 2.1)', () => {
  function setup(initial: Presence[]) {
    const presences = new Map(initial.map((p) => [p.userId, p]));
    let revision = 1;
    const source: WorldSource = {
      presences: () => presences,
      positions: () => new Map([...presences].map(([id, p]) => [id, p.position])),
      myUserId: () => 'me',
      revision: () => revision,
      snapshotRevision: () => 1,
      zoom: () => 2,
    };
    const drawImage = vi.fn();
    /** 캐릭터 그리기만 (타일맵 drawImage 제외): 원본 잘라내기 (sx, sy) */
    const spriteCalls = () =>
      drawImage.mock.calls
        .filter((call) => call[0] === SHEET)
        .map((call) => ({ sx: call[1] as number, sy: call[2] as number }));
    const visible: { userId: string; nickname: string; x: number; y: number }[] = [];
    const game = new WorldGame({
      canvas: fakeCanvas(drawImage),
      map,
      createTilemap: fakeTilemap,
      compositor: readyCompositor(),
      source,
      onRendered: (frame) => {
        visible.length = 0;
        frame.forEachVisible((userId, nickname, x, y) => {
          visible.push({ userId, nickname, x, y });
        });
      },
    });
    game.resize(400, 300, 1);
    const update = (next: Presence) => {
      presences.set(next.userId, next);
      revision += 1;
    };
    return { game, spriteCalls, visible, update };
  }

  it('합성 시트가 준비되면 (방향 행, 프레임 열)을 잘라 그린다. 서 있으면 프레임 0', async () => {
    const { game, spriteCalls } = setup([presence('me', 20, 15)]);
    game.step(0); // 합성 요청 (아직 플레이스홀더)
    expect(spriteCalls()).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    game.step(16);
    expect(spriteCalls()).toEqual([{ sx: 0, sy: 0 }]); // down/0
  });

  it('내 캐릭터: 키를 누르면 예측 방향 행에서 1→2… 프레임으로 걷는다', async () => {
    const { game, spriteCalls } = setup([presence('me', 20, 15)]);
    game.step(0);
    await new Promise((resolve) => setTimeout(resolve, 0));
    game.setHeldDirection('left');
    game.step(100);
    game.step(180);
    expect(spriteCalls().slice(-2)).toEqual([
      { sx: 24, sy: 40 }, // left/1
      { sx: 48, sy: 40 }, // left/2 (80ms 뒤)
    ]);
  });

  it('원격 캐릭터: 보간 중이면 걷고, 끝나고 75ms가 지나면 0. 방향은 Presence', async () => {
    const other = presence('a', 22, 15);
    const { game, spriteCalls, update } = setup([presence('me', 20, 15), other]);
    game.step(0);
    await new Promise((resolve) => setTimeout(resolve, 0));
    update({ ...other, position: { ...other.position, x: 23, dir: 'right' } });
    // 같은 y라 그리기 순서는 삽입 순서(me, a) — 프레임마다 마지막 호출이 a
    game.step(10);
    expect(spriteCalls().at(-1)).toEqual({ sx: 24, sy: 80 }); // right/1
    game.step(400); // 보간(200ms) 끝, 멈춘 직후 → 주기를 잠깐 이어간다
    expect(spriteCalls().at(-1)).toEqual({ sx: 48, sy: 80 });
    game.step(500);
    expect(spriteCalls().at(-1)).toEqual({ sx: 0, sy: 80 }); // right/0
  });

  it('자리비움은 이동 중이어도 프레임 0', async () => {
    const other = { ...presence('a', 22, 15), state: 'away' as const };
    const { game, spriteCalls, update } = setup([presence('me', 20, 15), other]);
    game.step(0);
    await new Promise((resolve) => setTimeout(resolve, 0));
    update({ ...other, position: { ...other.position, x: 23, dir: 'up' } });
    game.step(10);
    expect(spriteCalls().at(-1)).toEqual({ sx: 0, sy: 120 }); // up/0
  });

  it('forEachVisible: 화면에 걸친 캐릭터만 y 순서로, 닉네임 블록 하단 중앙(프레임 상단 − 2) × 줌', () => {
    const { game, visible } = setup([
      presence('me', 20, 15),
      { ...presence('b', 21, 14), nickname: '비' },
      presence('far', 0, 0), // 화면(200×150 월드 px) 밖
    ]);
    game.step(0);
    const camera = game.currentCamera;
    const anchor = (tx: number, ty: number) => ({
      x: (tx * 16 + 8 - camera.originX) * 2,
      y: (ty * 16 + 16 - 40 - NICKNAME_GAP_PX - camera.originY) * 2,
    });
    expect(visible).toEqual([
      { userId: 'b', nickname: '비', ...anchor(21, 14) },
      { userId: 'me', nickname: 'me', ...anchor(20, 15) },
    ]);
    expect(visible.every((v) => Number.isInteger(v.x) && Number.isInteger(v.y))).toBe(true);
  });
});
