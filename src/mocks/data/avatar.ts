// 외형 선택지와 시드 외형 (DOMAIN 3.6·3.7, GRAPHICS 2.7·2.10). 서버가 정하는 목록을 흉내 낸다.
// 아이템 ID는 catalog.json, 램프 ID는 palette.json과 같아야 한다 (avatar.test.ts가 검사)
import type { Appearance, AvatarOptions, EquippedItem } from '../../domain/types.ts';

const HAIR = ['bob', 'long', 'ponytail', 'curly', 'short', 'pigtails', 'bun', 'buzz'];
const HAT = ['beanie', 'cap', 'straw', 'wizard', 'headband', 'helmet'];
const FACE = ['round_glasses', 'sunglasses', 'mask', 'beard'];
const TOP = ['tshirt', 'hoodie', 'shirt', 'knit', 'jacket', 'suspenders', 'dress', 'robe'];
const BOTTOM = ['jeans', 'shorts', 'skirt', 'slacks', 'track', 'overalls'];
const SHOES = ['sneakers', 'boots', 'loafers', 'sandals'];
const HAND = ['flower', 'balloon', 'book', 'cup', 'umbrella', 'mic'];

const ids = (slot: string, names: readonly string[]): string[] => names.map((n) => `${slot}_${n}`);

const SKIN_RAMPS = ['skin_1', 'skin_2', 'skin_3', 'skin_4', 'skin_5'];
const HAIR_RAMPS = [
  'hair_black',
  'hair_brown',
  'hair_blonde',
  'hair_ginger',
  'hair_red',
  'hair_pink',
  'hair_blue',
  'hair_green',
  'hair_gray',
  'hair_white',
];
const ITEM_RAMPS = [
  'item_red',
  'item_orange',
  'item_yellow',
  'item_green',
  'item_forest',
  'item_cyan',
  'item_navy',
  'item_purple',
  'item_pink',
  'item_brown',
  'item_tan',
  'item_beige',
  'item_white',
  'item_gray',
  'item_charcoal',
  'item_black',
];

export const AVATAR_OPTIONS: AvatarOptions = {
  itemIds: [
    ...ids('hair', HAIR),
    ...ids('hat', HAT),
    ...ids('face', FACE),
    ...ids('top', TOP),
    ...ids('bottom', BOTTOM),
    ...ids('shoes', SHOES),
    ...ids('hand', HAND),
  ],
  skinRampIds: SKIN_RAMPS,
  hairRampIds: HAIR_RAMPS,
  itemRampIds: ITEM_RAMPS,
};

const pick = <T>(list: readonly T[], i: number): T => {
  const value = list[((i % list.length) + list.length) % list.length];
  if (value === undefined) {
    throw new Error('empty avatar option list');
  }
  return value;
};

const item = (slot: string, names: readonly string[], i: number, ramp?: number): EquippedItem => ({
  itemId: `${slot}_${pick(names, i)}`,
  ...(ramp === undefined ? {} : { primary: pick(ITEM_RAMPS, ramp) }),
});

/** i번째 시드 사용자 외형: 목록을 서로 다른 보폭으로 돌아 겹치지 않게, 항상 유효 */
export function seedAppearance(i: number): Appearance {
  return {
    skin: pick(SKIN_RAMPS, i),
    hairColor: pick(HAIR_RAMPS, i * 3),
    hair: i % 7 === 6 ? null : item('hair', HAIR, i),
    hat: i % 3 === 0 ? item('hat', HAT, i, i * 5) : null,
    face: i % 4 === 1 ? item('face', FACE, i) : null,
    top: item('top', TOP, i, i * 7 + 1),
    bottom: item('bottom', BOTTOM, i, i * 3 + 4),
    shoes: item('shoes', SHOES, i),
    hand: i % 5 === 2 ? item('hand', HAND, i, i * 11) : null,
  };
}

export const ME_APPEARANCE: Appearance = {
  skin: 'skin_2',
  hairColor: 'hair_brown',
  hair: { itemId: 'hair_short' },
  hat: { itemId: 'hat_cap', primary: 'item_red', secondary: 'item_white' },
  face: null,
  top: { itemId: 'top_hoodie', primary: 'item_green' },
  bottom: { itemId: 'bottom_jeans' },
  shoes: { itemId: 'shoes_sneakers' },
  hand: null,
};

/** 가입 승인 시 배정하는 기본 외형 (DOMAIN 3.7 "유효한 기본 외형", 방식은 백엔드 재량) */
export function defaultAppearance(): Appearance {
  return {
    skin: pick(SKIN_RAMPS, 0),
    hairColor: pick(HAIR_RAMPS, 0),
    hair: { itemId: 'hair_short' },
    hat: null,
    face: null,
    top: { itemId: 'top_tshirt' },
    bottom: { itemId: 'bottom_jeans' },
    shoes: { itemId: 'shoes_sneakers' },
    hand: null,
  };
}
