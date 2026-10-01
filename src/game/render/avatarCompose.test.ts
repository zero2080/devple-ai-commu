import { describe, expect, it } from 'vitest';

import type { Appearance } from '@/domain';
import { TEST_APPEARANCE } from '@/test/fixtures';

import { applySwap, avatarKey, composePixels, planAvatar, swapTable } from './avatarCompose';
import { AVATAR_PALETTE } from '../assets/avatarAssets';
import { KEY_COLORS, rgbOf } from '../assets/keyColors';

const ramp = (id: string) => {
  const found = AVATAR_PALETTE.ramps[id];
  if (found === undefined) throw new Error(id);
  return found;
};

const FULL: Appearance = {
  skin: 'skin_3',
  hairColor: 'hair_blonde',
  hair: { itemId: 'hair_ponytail', secondary: 'item_cyan' },
  hat: { itemId: 'hat_straw' },
  face: { itemId: 'face_round_glasses' },
  top: { itemId: 'top_hoodie', primary: 'item_green' },
  bottom: { itemId: 'bottom_jeans' },
  shoes: { itemId: 'shoes_sneakers' },
  hand: { itemId: 'hand_book', primary: 'item_red', secondary: 'item_red' },
};

describe('planAvatar — 그리기 순서 (GRAPHICS 2.6)', () => {
  it('back 시트 → body → bottom → shoes → top → hair → face → hat → hand 고정 순서', () => {
    expect(planAvatar(FULL).layers.map((layer) => layer.sheet)).toEqual([
      'hair/hair_ponytail.back.png',
      'hat/hat_straw.back.png',
      'hand/hand_book.back.png',
      'body/body_base.png',
      'bottom/bottom_jeans.png',
      'shoes/shoes_sneakers.png',
      'top/top_hoodie.png',
      'hair/hair_ponytail.png',
      'face/face_round_glasses.png',
      'hat/hat_straw.png',
      'hand/hand_book.png',
    ]);
    expect(planAvatar(FULL).warnings).toEqual([]);
  });

  it('back 시트가 없는 아이템·빈 선택 슬롯은 건너뛴다', () => {
    expect(planAvatar(TEST_APPEARANCE).layers.map((layer) => layer.sheet)).toEqual([
      'body/body_base.png',
      'bottom/bottom_jeans.png',
      'shoes/shoes_sneakers.png',
      'top/top_tshirt.png',
      'hair/hair_bob.png',
    ]);
  });

  it('상의가 coversBottom이면 하의를 그리지 않는다', () => {
    const sheets = planAvatar({ ...TEST_APPEARANCE, top: { itemId: 'top_robe' } }).layers.map(
      (layer) => layer.sheet,
    );
    expect(sheets).toContain('top/top_robe.png');
    expect(sheets.some((sheet) => sheet.startsWith('bottom/'))).toBe(false);
  });

  it('카탈로그에 없는 아이템: 선택 슬롯은 비우고 필수 슬롯은 그 슬롯 첫 아이템, 둘 다 경고', () => {
    const plan = planAvatar({
      ...TEST_APPEARANCE,
      hat: { itemId: 'hat_crown' },
      face: { itemId: 'hat_cap' }, // 다른 슬롯의 아이템도 없는 것으로 본다
      top: { itemId: 'top_armor', primary: 'item_black' },
    });
    const sheets = plan.layers.map((layer) => layer.sheet);
    expect(sheets.some((sheet) => sheet.startsWith('hat/') || sheet.startsWith('face/'))).toBe(
      false,
    );
    expect(sheets).toContain('top/top_tshirt.png');
    expect(plan.warnings).toEqual([
      'hat: "hat_crown" not in catalog — slot left empty',
      'face: "hat_cap" not in catalog — slot left empty',
      'top: "top_armor" not in catalog — using "top_tshirt"',
    ]);
    // 대체 아이템에도 사용자가 고른 색은 그대로
    const top = plan.layers.find((layer) => layer.sheet === 'top/top_tshirt.png');
    expect(top?.ramps.primary).toEqual(ramp('item_black'));
  });
});

describe('planAvatar — 채널 램프 (GRAPHICS 2.7·2.9)', () => {
  const layerOf = (appearance: Appearance, sheet: string) =>
    planAvatar(appearance).layers.find((layer) => layer.sheet === sheet)?.ramps;

  it('body는 skin, hair는 hairColor + secondary, 나머지는 primary·secondary', () => {
    expect(layerOf(FULL, 'body/body_base.png')).toEqual({ skin: ramp('skin_3') });
    expect(layerOf(FULL, 'hair/hair_ponytail.png')).toEqual({
      hair: ramp('hair_blonde'),
      secondary: ramp('item_cyan'),
    });
    expect(layerOf(FULL, 'hand/hand_book.back.png')).toEqual({
      primary: ramp('item_red'),
      secondary: ramp('item_red'), // 두 채널에 같은 램프 허용
    });
  });

  it('고른 램프 → 아이템 defaultColors → item 그룹 첫 램프, palette에 없는 id는 건너뛴다', () => {
    // hoodie: primary는 고름(item_green), secondary는 defaultColors(item_charcoal)
    expect(layerOf(FULL, 'top/top_hoodie.png')).toEqual({
      primary: ramp('item_green'),
      secondary: ramp('item_charcoal'),
    });
    // jeans: secondary 기본색 없음 → item 그룹 첫 램프(item_red). primary는 없는 id → defaultColors(item_navy)
    expect(
      layerOf(
        { ...FULL, bottom: { itemId: 'bottom_jeans', primary: 'item_gold' } },
        'bottom/bottom_jeans.png',
      ),
    ).toEqual({ primary: ramp('item_navy'), secondary: ramp('item_red') });
    // 피부·머리색이 palette에 없으면 그룹 첫 램프
    expect(layerOf({ ...FULL, skin: 'skin_9' }, 'body/body_base.png')).toEqual({
      skin: ramp('skin_1'),
    });
  });
});

describe('키 색 치환', () => {
  const px = (hex: string, alpha = 255) => {
    const rgb = rgbOf(hex);
    return [(rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff, alpha];
  };

  it('swapTable은 채널마다 hi·base·shadow 3색을 램프의 같은 단계로 잇는다', () => {
    const table = swapTable({ primary: ramp('item_navy') });
    expect(table.size).toBe(3);
    expect(table.get(rgbOf(KEY_COLORS.primary.hi))).toBe(rgbOf(ramp('item_navy').hi));
    expect(table.get(rgbOf(KEY_COLORS.primary.shadow))).toBe(rgbOf(ramp('item_navy').shadow));
  });

  it('applySwap: RGB 완전 일치·알파 255만 바꾸고 나머지(외곽선·반투명·다른 채널 키)는 그대로', () => {
    const pixels = new Uint8ClampedArray([
      ...px(KEY_COLORS.primary.base),
      ...px(KEY_COLORS.primary.base, 128),
      ...px('#181425'),
      ...px(KEY_COLORS.secondary.base),
      ...px('#fe0000'), // 키 색과 1 차이
    ]);
    applySwap(pixels, swapTable({ primary: ramp('item_green') }));
    expect([...pixels]).toEqual([
      ...px(ramp('item_green').base),
      ...px(KEY_COLORS.primary.base, 128),
      ...px('#181425'),
      ...px(KEY_COLORS.secondary.base),
      ...px('#fe0000'),
    ]);
  });

  it('composePixels: 뒤 레이어의 불투명 픽셀이 덮고 투명 픽셀은 아래를 남긴다. 원본 레이어는 바꾸지 않는다', () => {
    const under = new Uint8ClampedArray([...px(KEY_COLORS.skin.base), ...px('#181425')]);
    const over = new Uint8ClampedArray([...px(KEY_COLORS.primary.base), 0, 0, 0, 0]);
    const out = composePixels(
      [
        { pixels: under, table: swapTable({ skin: ramp('skin_2') }) },
        { pixels: over, table: swapTable({ primary: ramp('item_red') }) },
      ],
      8,
    );
    expect([...out]).toEqual([...px(ramp('item_red').base), ...px('#181425')]);
    expect([...under.subarray(0, 4)]).toEqual(px(KEY_COLORS.skin.base));
  });
});

describe('avatarKey (캐시 키, GRAPHICS 2.9)', () => {
  it('정규화가 같은 외형은 같은 키 (키 순서·hair.primary·빈 색 키 무시)', () => {
    const reordered = {
      hand: null,
      shoes: { itemId: 'shoes_sneakers' },
      bottom: { itemId: 'bottom_jeans' },
      top: { primary: 'item_red', itemId: 'top_tshirt' },
      face: null,
      hat: null,
      hair: { itemId: 'hair_bob', primary: 'item_cyan' },
      hairColor: 'hair_black',
      skin: 'skin_1',
    } as Appearance;
    expect(avatarKey(reordered)).toBe(avatarKey(TEST_APPEARANCE));
    expect(avatarKey({ ...TEST_APPEARANCE, skin: 'skin_2' })).not.toBe(avatarKey(TEST_APPEARANCE));
  });
});
