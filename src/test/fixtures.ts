// 테스트 공용 데이터 (DOMAIN 3.7). 유효한 외형·선택지 — palette.json·catalog.json에 있는 ID만 쓴다
import type { Appearance, AvatarOptions } from '@/domain';

export const TEST_APPEARANCE: Appearance = {
  skin: 'skin_1',
  hairColor: 'hair_black',
  hair: { itemId: 'hair_bob' },
  hat: null,
  face: null,
  top: { itemId: 'top_tshirt', primary: 'item_red' },
  bottom: { itemId: 'bottom_jeans' },
  shoes: { itemId: 'shoes_sneakers' },
  hand: null,
};

export const TEST_AVATAR_OPTIONS: AvatarOptions = {
  itemIds: ['hair_bob', 'top_tshirt', 'bottom_jeans', 'shoes_sneakers'],
  skinRampIds: ['skin_1'],
  hairRampIds: ['hair_black'],
  itemRampIds: ['item_red'],
};
