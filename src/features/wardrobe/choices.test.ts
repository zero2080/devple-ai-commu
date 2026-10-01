import { describe, expect, it } from 'vitest';

import type { Appearance } from '@/domain';
import { TEST_APPEARANCE } from '@/test/fixtures';

import {
  editableChannels,
  rampLabel,
  shownColor,
  wardrobeChoices,
  withColor,
  withItem,
} from './choices';

describe('wardrobeChoices (선택지 = 서버 avatarOptions ∩ catalog·palette)', () => {
  it('서버 순서를 지키고, 카탈로그·팔레트에 없거나 다른 그룹·슬롯의 id는 뺀다', () => {
    const choices = wardrobeChoices({
      itemIds: ['top_hoodie', 'top_armor', 'hat_cap', 'top_tshirt', 'face_hat_cap', 'hand_mic'],
      skinRampIds: ['skin_3', 'skin_9', 'item_red', 'skin_1'],
      hairRampIds: ['hair_pink', 'hair_black'],
      itemRampIds: ['item_green', 'item_gold', 'hair_black', 'item_red'],
    });
    expect(choices.items.top.map((item) => item.id)).toEqual(['top_hoodie', 'top_tshirt']);
    expect(choices.items.hat.map((item) => item.id)).toEqual(['hat_cap']);
    expect(choices.items.face).toEqual([]);
    expect(choices.items.hand.map((item) => item.name)).toEqual(['마이크']);
    expect(choices.skins.map((choice) => choice.id)).toEqual(['skin_3', 'skin_1']);
    expect(choices.hairColors.map((choice) => choice.label)).toEqual(['분홍', '검정']);
    expect(choices.itemColors.map((choice) => choice.id)).toEqual(['item_green', 'item_red']);
    expect(choices.itemColors[0]?.ramp.base).toBe('#3e8948');
  });

  it('램프 이름은 화면 문구, 모르는 id는 id 그대로', () => {
    expect(rampLabel('item_navy')).toBe('남색');
    expect(rampLabel('item_gold')).toBe('item_gold');
  });
});

describe('편집', () => {
  it('editableChannels: 카탈로그 channels, hair는 secondary만 (primary = 머리색)', () => {
    expect(editableChannels('top', 'top_hoodie')).toEqual(['primary', 'secondary']);
    expect(editableChannels('top', 'top_knit')).toEqual(['primary']);
    expect(editableChannels('hair', 'hair_ponytail')).toEqual(['secondary']);
    expect(editableChannels('hair', 'hair_bob')).toEqual([]);
  });

  it('withItem: 새 아이템에도 있는 채널의 고른 색만 이어 쓰고, 필수 슬롯은 뺄 수 없다', () => {
    const draft: Appearance = {
      ...TEST_APPEARANCE,
      top: { itemId: 'top_hoodie', primary: 'item_green', secondary: 'item_black' },
    };
    expect(withItem(draft, 'top', 'top_knit').top).toEqual({
      itemId: 'top_knit',
      primary: 'item_green',
    });
    expect(withItem(draft, 'top', null)).toBe(draft);
    expect(withItem(draft, 'hair', null).hair).toBeNull();
    expect(withItem(draft, 'hat', 'hat_cap').hat).toEqual({ itemId: 'hat_cap' });
  });

  it('withColor: 그 슬롯 아이템의 채널만 바꾸고, 빈 슬롯이면 그대로', () => {
    expect(withColor(TEST_APPEARANCE, 'shoes', 'secondary', 'item_navy').shoes).toEqual({
      itemId: 'shoes_sneakers',
      secondary: 'item_navy',
    });
    expect(withColor(TEST_APPEARANCE, 'hat', 'primary', 'item_navy')).toBe(TEST_APPEARANCE);
  });

  it('shownColor: 고른 램프 → defaultColors → item 그룹 첫 램프 (합성과 같은 순서)', () => {
    expect(shownColor({ itemId: 'top_tshirt', primary: 'item_red' }, 'primary')).toBe('item_red');
    expect(shownColor({ itemId: 'top_hoodie' }, 'secondary')).toBe('item_charcoal');
    expect(shownColor({ itemId: 'top_tshirt' }, 'secondary')).toBe('item_red');
  });
});
