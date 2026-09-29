import { describe, expect, it } from 'vitest';

import { computeCamera, screenToWorld, worldToScreen } from './camera';

const MAP_W = 640;
const MAP_H = 480;

describe('computeCamera', () => {
  it('내 캐릭터를 화면 중앙에 둔다', () => {
    const cam = computeCamera(
      { x: 320, y: 240 },
      { widthPx: 400, heightPx: 300, zoom: 2 },
      MAP_W,
      MAP_H,
    );
    expect(cam).toEqual({ originX: 220, originY: 165, zoom: 2 });
  });

  it('맵 경계에서 클램프한다 (왼쪽 위·오른쪽 아래)', () => {
    expect(
      computeCamera({ x: 0, y: 0 }, { widthPx: 400, heightPx: 300, zoom: 2 }, MAP_W, MAP_H),
    ).toMatchObject({ originX: 0, originY: 0 });
    expect(
      computeCamera({ x: 640, y: 480 }, { widthPx: 400, heightPx: 300, zoom: 2 }, MAP_W, MAP_H),
    ).toMatchObject({ originX: 440, originY: 330 });
  });

  it('맵이 뷰포트보다 작으면 가운데 정렬한다', () => {
    const cam = computeCamera(
      { x: 10, y: 10 },
      { widthPx: 2000, heightPx: 1200, zoom: 2 },
      MAP_W,
      MAP_H,
    );
    expect(cam).toMatchObject({ originX: -180, originY: -60 });
  });

  it('원점은 정수다 (픽셀 떨림 방지)', () => {
    const cam = computeCamera(
      { x: 100.7, y: 55.3 },
      { widthPx: 401, heightPx: 301, zoom: 3 },
      MAP_W,
      MAP_H,
    );
    expect(Number.isInteger(cam.originX) && Number.isInteger(cam.originY)).toBe(true);
  });
});

describe('worldToScreen / screenToWorld', () => {
  it('서로 역변환이다', () => {
    const cam = { originX: 100, originY: 50, zoom: 2 };
    const screen = worldToScreen(cam, { x: 116, y: 66 });
    expect(screen).toEqual({ x: 32, y: 32 });
    expect(screenToWorld(cam, screen)).toEqual({ x: 116, y: 66 });
  });
});
