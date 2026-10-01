// 아바타 합성 계획 (GRAPHICS 2.6·2.7·2.9, ARCHITECTURE 2.1). 순수 — 이미지·캔버스를 다루지 않는다.
// 계획 = 그리기 순서의 레이어 목록(시트 경로 + 채널별 램프). 실행·캐시는 avatarCompositor.ts
import { normalizeAppearance, type Appearance, type EquippedItem, type SlotId } from '@/domain';

import {
  AVATAR_CATALOG,
  AVATAR_PALETTE,
  catalogItem,
  firstCatalogItem,
  rampOf,
  type CatalogItem,
  type ColorChannel,
  type ColorRamp,
} from '../assets/avatarAssets';
import { KEY_COLORS, rgbOf, SHADES, type KeyChannel } from '../assets/keyColors';
import { AVATAR_FRAME_HEIGHT, AVATAR_FRAME_WIDTH } from '../constants';

/** 합성 시트 크기 = 레이어 시트 크기 (4프레임 × 4방향) */
export const AVATAR_SHEET_WIDTH = AVATAR_FRAME_WIDTH * 4;
export const AVATAR_SHEET_HEIGHT = AVATAR_FRAME_HEIGHT * 4;

export interface AvatarLayer {
  /** catalog.json 기준 상대 경로 ('hair/hair_long.back.png') */
  sheet: string;
  /** 이 레이어에서 치환할 키 채널 → 램프 */
  ramps: Partial<Record<KeyChannel, ColorRamp>>;
}

export interface AvatarPlan {
  layers: AvatarLayer[];
  /** 카탈로그에 없는 아이템 등 (합성은 계속한다) */
  warnings: string[];
}

/** 캐시 키 (GRAPHICS 2.9): 정규화한 외형. 키 순서가 고정이라 문자열 비교로 같은 외형을 찾는다 */
export function avatarKey(appearance: Appearance): string {
  return JSON.stringify(normalizeAppearance(appearance));
}

interface Equipped {
  item: CatalogItem;
  equipped: EquippedItem;
}

const REQUIRED: ReadonlySet<SlotId> = new Set(['top', 'bottom', 'shoes']);

/** 카탈로그에 없는 아이템(또는 다른 슬롯의 아이템): 선택 슬롯은 비우고, 필수 슬롯은 그 슬롯의 첫 아이템 (GRAPHICS 2.8) */
function resolve(slot: SlotId, equipped: EquippedItem | null, warnings: string[]): Equipped | null {
  if (equipped === null) {
    return null;
  }
  const item = catalogItem(equipped.itemId);
  if (item?.slot === slot) {
    return { item, equipped };
  }
  if (!REQUIRED.has(slot)) {
    warnings.push(`${slot}: "${equipped.itemId}" not in catalog — slot left empty`);
    return null;
  }
  const fallback = firstCatalogItem(slot);
  warnings.push(
    `${slot}: "${equipped.itemId}" not in catalog — using "${fallback?.id ?? 'nothing'}"`,
  );
  return fallback === undefined ? null : { item: fallback, equipped };
}

/** 채널 램프 (GRAPHICS 2.9): 고른 램프 → 아이템 defaultColors → item 그룹 첫 램프. palette.json에 없는 id는 건너뛴다 */
function channelRamp({ item, equipped }: Equipped, channel: ColorChannel): ColorRamp {
  const chosen = [equipped[channel], item.defaultColors[channel]].find(
    (id) => id !== undefined && id in AVATAR_PALETTE.ramps,
  );
  return rampOf(chosen, 'item');
}

function itemRamps(entry: Equipped, slot: SlotId, hairColor: string): AvatarLayer['ramps'] {
  const secondary = channelRamp(entry, 'secondary');
  return slot === 'hair'
    ? { hair: rampOf(hairColor, 'hair'), secondary } // hair.primary는 쓰지 않는다 (DOMAIN 3.7)
    : { primary: channelRamp(entry, 'primary'), secondary };
}

/** 그리기 순서 (GRAPHICS 2.6). 방향과 무관하게 고정 */
const ORDER: readonly (readonly [SlotId | 'body', 'front' | 'back'])[] = [
  ['hair', 'back'],
  ['hat', 'back'],
  ['hand', 'back'],
  ['body', 'front'],
  ['bottom', 'front'],
  ['shoes', 'front'],
  ['top', 'front'],
  ['hair', 'front'],
  ['face', 'front'],
  ['hat', 'front'],
  ['hand', 'front'],
];

export function planAvatar(appearance: Appearance): AvatarPlan {
  const warnings: string[] = [];
  const slots = new Map<SlotId, Equipped | null>(
    (['hair', 'hat', 'face', 'top', 'bottom', 'shoes', 'hand'] as const).map((slot) => [
      slot,
      resolve(slot, appearance[slot], warnings),
    ]),
  );
  if (slots.get('top')?.item.coversBottom === true) {
    slots.set('bottom', null); // 원피스·로브: 하의 생략
  }
  const layers: AvatarLayer[] = [];
  for (const [slot, side] of ORDER) {
    if (slot === 'body') {
      layers.push({
        sheet: AVATAR_CATALOG.body.front,
        ramps: { skin: rampOf(appearance.skin, 'skin') },
      });
      continue;
    }
    const entry = slots.get(slot);
    const sheet = entry?.item.sheets[side];
    if (entry === undefined || entry === null || sheet === undefined) {
      continue;
    }
    layers.push({ sheet, ramps: itemRamps(entry, slot, appearance.hairColor) });
  }
  return { layers, warnings };
}

/** 키 색(0xRRGGBB) → 램프 색(0xRRGGBB). 레이어마다 합성할 때 한 번 만든다 */
export function swapTable(ramps: AvatarLayer['ramps']): Map<number, number> {
  const table = new Map<number, number>();
  for (const [channel, ramp] of Object.entries(ramps) as [KeyChannel, ColorRamp][]) {
    for (const shade of SHADES) {
      table.set(rgbOf(KEY_COLORS[channel][shade]), rgbOf(ramp[shade]));
    }
  }
  return table;
}

/** 키 색 치환 (GRAPHICS 2.7): RGB 완전 일치·알파 255인 픽셀만 바꾼다. RGBA 배열을 그대로 고친다 */
export function applySwap(pixels: Uint8ClampedArray, table: ReadonlyMap<number, number>): void {
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] !== 255) {
      continue;
    }
    const rgb = ((pixels[i] ?? 0) << 16) | ((pixels[i + 1] ?? 0) << 8) | (pixels[i + 2] ?? 0);
    const to = table.get(rgb);
    if (to !== undefined) {
      pixels[i] = (to >> 16) & 0xff;
      pixels[i + 1] = (to >> 8) & 0xff;
      pixels[i + 2] = to & 0xff;
    }
  }
}

/** 레이어를 순서대로 겹친다. 알파는 0/255뿐이라(검수 8장) 불투명 픽셀을 덮어쓰면 된다 */
export function composePixels(
  layers: readonly { pixels: Uint8ClampedArray; table: ReadonlyMap<number, number> }[],
  length: number = AVATAR_SHEET_WIDTH * AVATAR_SHEET_HEIGHT * 4,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(length);
  for (const layer of layers) {
    const pixels = layer.pixels.slice(0, length);
    applySwap(pixels, layer.table);
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] !== 0) {
        out.set(pixels.subarray(i, i + 4), i);
      }
    }
  }
  return out;
}
