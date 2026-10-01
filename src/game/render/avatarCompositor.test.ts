import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Appearance } from '@/domain';
import { TEST_APPEARANCE } from '@/test/fixtures';

import { AVATAR_SHEET_HEIGHT, AVATAR_SHEET_WIDTH } from './avatarCompose';
import { AvatarCompositor, type CompositorBackend } from './avatarCompositor';
import { AVATAR_PALETTE } from '../assets/avatarAssets';
import { KEY_COLORS, rgbOf } from '../assets/keyColors';

const LENGTH = AVATAR_SHEET_WIDTH * AVATAR_SHEET_HEIGHT * 4;

/** 시트마다 첫 픽셀만 칠한 가짜 이미지: body는 skin 키, 나머지는 primary 키 */
function fakeBackend(fail: ReadonlySet<string> = new Set()) {
  const outputs: Uint8ClampedArray[] = [];
  const backend: CompositorBackend = {
    loadSheet: vi.fn((path: string) =>
      fail.has(path)
        ? Promise.reject(new Error(`404 ${path}`))
        : Promise.resolve({ path } as unknown as CanvasImageSource),
    ),
    readPixels: vi.fn((image: CanvasImageSource) => {
      const { path } = image as unknown as { path: string };
      const pixels = new Uint8ClampedArray(LENGTH);
      const key = rgbOf(path.startsWith('body/') ? KEY_COLORS.skin.base : KEY_COLORS.primary.base);
      const offset = path.startsWith('body/') ? 0 : 4;
      pixels.set([(key >> 16) & 0xff, (key >> 8) & 0xff, key & 0xff, 255], offset);
      return pixels;
    }),
    toImage: vi.fn((pixels: Uint8ClampedArray) => {
      outputs.push(pixels);
      return { composed: outputs.length } as unknown as CanvasImageSource;
    }),
  };
  return { backend, outputs };
}

const hex = (pixels: Uint8ClampedArray, index: number) =>
  `#${[0, 1, 2].map((c) => (pixels[index * 4 + c] ?? 0).toString(16).padStart(2, '0')).join('')}`;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AvatarCompositor (GRAPHICS 2.9 — 외형당 1회 합성, 사용자 간 공유)', () => {
  it('같은 외형(정규화 기준)은 같은 핸들을 받고 합성은 한 번뿐이다', async () => {
    const { backend } = fakeBackend();
    const compositor = new AvatarCompositor(backend);
    const a = compositor.request(TEST_APPEARANCE);
    const b = compositor.request({
      ...TEST_APPEARANCE,
      hair: { itemId: 'hair_bob', primary: 'item_cyan' }, // hair.primary는 정규화에서 빠진다
    });
    expect(b).toBe(a);
    expect(a.image).toBeNull(); // 준비 전 → 플레이스홀더
    await a.ready;
    expect(a.image).not.toBeNull();
    expect(compositor.request({ ...TEST_APPEARANCE })).toBe(a);
    expect(compositor.composed).toBe(1);
    expect(backend.toImage).toHaveBeenCalledOnce();
  });

  it('다른 외형은 따로 합성하지만 레이어 시트(body 등)는 한 번만 읽는다', async () => {
    const { backend } = fakeBackend();
    const compositor = new AvatarCompositor(backend);
    const a = compositor.request(TEST_APPEARANCE);
    const b = compositor.request({ ...TEST_APPEARANCE, skin: 'skin_4' });
    await Promise.all([a.ready, b.ready]);
    expect(compositor.size).toBe(2);
    expect(compositor.composed).toBe(2);
    const bodyLoads = vi
      .mocked(backend.loadSheet)
      .mock.calls.filter(([path]) => path === 'body/body_base.png');
    expect(bodyLoads).toHaveLength(1);
  });

  it('합성 결과는 키 색을 고른 램프로 바꾼 픽셀이다', async () => {
    const { backend, outputs } = fakeBackend();
    const compositor = new AvatarCompositor(backend);
    const look: Appearance = { ...TEST_APPEARANCE, skin: 'skin_5', hair: null };
    await compositor.request(look).ready;
    const pixels = outputs[0] ?? new Uint8ClampedArray();
    expect(hex(pixels, 0)).toBe(AVATAR_PALETTE.ramps.skin_5?.base);
    // 픽셀 1: primary 키를 칠한 bottom → shoes → top 순으로 덮여 마지막 top(item_red 고름)의 색
    expect(hex(pixels, 1)).toBe(AVATAR_PALETTE.ramps.item_red?.base);
  });

  it('시트를 못 읽으면 image는 null로 남고(플레이스홀더) ready는 풀리며, 다음 요청은 다시 읽는다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { backend } = fakeBackend(new Set(['top/top_tshirt.png']));
    const compositor = new AvatarCompositor(backend);
    const sheet = compositor.request(TEST_APPEARANCE);
    await sheet.ready;
    expect(sheet.image).toBeNull();
    expect(warn).toHaveBeenCalled();
    await compositor.request({ ...TEST_APPEARANCE, skin: 'skin_2' }).ready;
    const topLoads = vi
      .mocked(backend.loadSheet)
      .mock.calls.filter(([path]) => path === 'top/top_tshirt.png');
    expect(topLoads).toHaveLength(2);
  });

  it('카탈로그에 없는 아이템은 경고를 남기고 계속 합성한다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { backend } = fakeBackend();
    const compositor = new AvatarCompositor(backend);
    const sheet = compositor.request({ ...TEST_APPEARANCE, hat: { itemId: 'hat_crown' } });
    await sheet.ready;
    expect(sheet.image).not.toBeNull();
    expect(warn).toHaveBeenCalledWith('[avatar]', expect.stringContaining('hat_crown'));
  });
});
