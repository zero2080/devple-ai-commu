import { describe, expect, it } from 'vitest';

import type { Appearance } from '@/domain';
import { slotOfItemId } from '@/domain';
import { TEST_APPEARANCE } from '@/test/fixtures';

import { AVATAR_CATALOG, AVATAR_PALETTE, itemRamp, rampOf } from './avatarAssets';
import { placeholderColors } from '../render/avatarPlaceholder';

/** GRAPHICS 2.7 키 색 — 마스터 팔레트에 있으면 안 된다 */
const KEY_COLORS = [
  '#ffff80',
  '#ffff00',
  '#808000',
  '#8080ff',
  '#0000ff',
  '#000080',
  '#ff8080',
  '#ff0000',
  '#800000',
  '#80ff80',
  '#00ff00',
  '#008000',
];

describe('palette.json (GRAPHICS 1.1·2.7)', () => {
  it('32색 이내·중복 없음, 키 색과 겹치지 않는다', () => {
    const colors = AVATAR_PALETTE.colors;
    expect(colors.length).toBeLessThanOrEqual(32);
    expect(new Set(colors).size).toBe(colors.length);
    expect(colors.filter((c) => KEY_COLORS.includes(c))).toEqual([]);
  });

  it('모든 램프 색은 마스터 팔레트 안에 있고, 그룹은 램프를 빠짐없이 가리킨다', () => {
    for (const [id, ramp] of Object.entries(AVATAR_PALETTE.ramps)) {
      for (const color of [ramp.hi, ramp.base, ramp.shadow]) {
        expect(AVATAR_PALETTE.colors, `${id} ${color}`).toContain(color);
      }
    }
    const grouped = Object.values(AVATAR_PALETTE.rampGroups).flat();
    expect(new Set(grouped)).toEqual(new Set(Object.keys(AVATAR_PALETTE.ramps)));
    expect(AVATAR_PALETTE.rampGroups.skin).toHaveLength(5);
    expect(AVATAR_PALETTE.rampGroups.hair).toHaveLength(10);
    expect(AVATAR_PALETTE.rampGroups.item).toHaveLength(16);
  });
});

describe('catalog.json (GRAPHICS 2.8·2.10)', () => {
  it('아이템 ID 접두사 = 슬롯, ID 중복 없음, 슬롯별 초기 수량', () => {
    const items = AVATAR_CATALOG.items;
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    for (const item of items) {
      expect(slotOfItemId(item.id), item.id).toBe(item.slot);
      expect(item.sheets.front).toBe(`${item.slot}/${item.id}.png`);
    }
    const count = (slot: string) => items.filter((i) => i.slot === slot).length;
    expect([count('hair'), count('hat'), count('face'), count('top')]).toEqual([8, 6, 4, 8]);
    expect([count('bottom'), count('shoes'), count('hand')]).toEqual([6, 4, 6]);
  });

  it('기본색은 item 램프이고, 쓴다고 적은 채널에만 있다. coversBottom은 상의만', () => {
    for (const item of AVATAR_CATALOG.items) {
      for (const [channel, rampId] of Object.entries(item.defaultColors)) {
        expect(AVATAR_PALETTE.rampGroups.item, item.id).toContain(rampId);
        expect(item.channels, item.id).toContain(channel);
      }
      if (item.coversBottom === true) {
        expect(item.slot).toBe('top');
      }
    }
  });
});

describe('색 결정 (GRAPHICS 2.9: 고른 램프 → 아이템 기본색 → 그룹 첫 램프)', () => {
  it('rampOf는 없는 id면 그룹 첫 램프', () => {
    expect(rampOf('skin_3', 'skin')).toEqual(AVATAR_PALETTE.ramps.skin_3);
    expect(rampOf('nope', 'hair')).toEqual(AVATAR_PALETTE.ramps.hair_black);
    expect(rampOf(undefined, 'item')).toEqual(AVATAR_PALETTE.ramps.item_red);
  });

  it('itemRamp: 사용자 램프 > defaultColors > item 첫 램프', () => {
    expect(itemRamp({ itemId: 'hat_beanie', primary: 'item_green' }, 'primary').base).toBe(
      '#3e8948',
    );
    expect(itemRamp({ itemId: 'hat_beanie' }, 'primary')).toEqual(AVATAR_PALETTE.ramps.item_navy);
    expect(itemRamp({ itemId: 'hat_unknown' }, 'secondary')).toEqual(AVATAR_PALETTE.ramps.item_red);
  });

  it('placeholderColors: 민머리·모자 없음, 원피스는 하의를 덮는다', () => {
    const look: Appearance = {
      ...TEST_APPEARANCE,
      skin: 'skin_4',
      hair: null,
      hat: { itemId: 'hat_wizard' },
      top: { itemId: 'top_dress', primary: 'item_cyan' },
      hand: { itemId: 'hand_book', primary: 'item_orange' },
    };
    expect(placeholderColors(look)).toEqual({
      skin: '#b86f50',
      hair: null,
      hat: '#68386c', // hat_wizard 기본색 item_purple
      top: '#0099db',
      bottom: null,
      shoes: '#c0cbdc', // shoes_sneakers 기본색 item_white의 base
      hand: '#f77622',
    });
    expect(placeholderColors(TEST_APPEARANCE)).toMatchObject({
      hair: '#3a4466',
      bottom: '#124e89',
    });
  });
});
