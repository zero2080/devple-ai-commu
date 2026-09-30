import { describe, expect, it } from 'vitest';

import type { MapData, Presence } from '@/domain';

import { BUBBLE_NICKNAME_CLEARANCE_PX } from '../constants';
import { WorldGame, type WorldFrame } from './worldGame';
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
    avatarId: 'char_01',
    position: { mapId: 'main', x, y, dir: 'down' },
    state: 'online',
    updatedAt: 1,
  };
}

/** jsdom에는 2d 컨텍스트가 없으므로 기록만 하는 가짜 컨텍스트 */
function fakeCanvas(): HTMLCanvasElement {
  const ctx = new Proxy(
    { imageSmoothingEnabled: false },
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
    // a는 타일 (22,15): 월드 x = 22*16 + 8, 프레임 상단 = 15*16 + 16 - 32, 꼬리 끝 = 그 위 12px
    const worldX = 22 * 16 + 8;
    const worldY = 15 * 16 + 16 - 32 - BUBBLE_NICKNAME_CLEARANCE_PX;
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
  it('플레이스홀더 닉네임(8px)에서 꼬리 끝은 프레임 상단 − 11이다', () => {
    expect(BUBBLE_NICKNAME_CLEARANCE_PX).toBe(11);
  });
});

describe('characterAt (ARCHITECTURE 3.1)', () => {
  function gameWith(presences: Map<string, Presence>): WorldGame {
    const positions = new Map([...presences].map(([id, p]) => [id, p.position]));
    const game = new WorldGame({
      canvas: fakeCanvas(),
      map,
      createTilemap: fakeTilemap,
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
