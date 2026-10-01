// 캐릭터 레이어 검수 규칙 (GRAPHICS 8장). 순수 함수 — scripts/check-assets.ts가 파일을 읽어 부른다
import { FRAME_H, FRAME_W, FRAMES, SHEET_H, SHEET_W, type Sheet } from './sheet.ts';
import {
  KEY_CHANNELS,
  KEY_COLORS,
  OUTLINE_COLOR,
  rgbOf,
  SHADES,
  type KeyChannel,
} from '../../src/game/assets/keyColors.ts';

export type LayerKind = 'body' | 'hair' | 'hat' | 'face' | 'top' | 'bottom' | 'shoes' | 'hand';

/** 레이어가 쓸 수 있는 키 채널 (GRAPHICS 2.7 표) */
export const ALLOWED_KEYS: Readonly<Record<LayerKind, readonly KeyChannel[]>> = {
  body: ['skin'],
  hair: ['hair', 'secondary'],
  hat: ['primary', 'secondary'],
  face: ['primary', 'secondary'],
  top: ['primary', 'secondary'],
  bottom: ['primary', 'secondary'],
  shoes: ['primary', 'secondary'],
  hand: ['primary', 'secondary'],
};

const MAX_FIXED_COLORS = 4;
export const MAX_FILE_BYTES = 256 * 1024;
const KEY_RGB = new Map<number, KeyChannel>(
  KEY_CHANNELS.flatMap((channel) =>
    SHADES.map((shade) => [rgbOf(KEY_COLORS[channel][shade]), channel] as const),
  ),
);
const OUTLINE_RGB = rgbOf(OUTLINE_COLOR);

export interface LayerReport {
  problems: string[];
  /** 실제로 쓴 키 채널 (카탈로그 channels와 대조) */
  usedKeys: Set<KeyChannel>;
}

const rowOf = (dir: number) => dir * FRAME_H;

/** 한 시트 검수: 크기·알파·색·고정색 수·여백·(body) 발바닥 */
export function checkLayer(kind: LayerKind, sheet: Sheet, palette: readonly string[]): LayerReport {
  const problems: string[] = [];
  const usedKeys = new Set<KeyChannel>();
  if (sheet.width !== SHEET_W || sheet.height !== SHEET_H) {
    problems.push(`크기 ${String(sheet.width)}×${String(sheet.height)} (96×160이어야 함)`);
    return { problems, usedKeys };
  }
  const paletteRgb = new Set(palette.map(rgbOf));
  const fixed = new Set<number>();
  const strayColors = new Set<string>();
  let halfAlpha = 0;
  let hatMargin = 0;
  let sideMargin = 0;
  for (let y = 0; y < SHEET_H; y += 1) {
    for (let x = 0; x < SHEET_W; x += 1) {
      const [r, g, b, a] = sheet.get(x, y);
      if (a === 0) continue;
      if (a !== 255) {
        halfAlpha += 1;
        continue;
      }
      const rgb = (r << 16) | (g << 8) | b;
      const key = KEY_RGB.get(rgb);
      if (key !== undefined) {
        usedKeys.add(key);
      } else if (paletteRgb.has(rgb)) {
        if (rgb !== OUTLINE_RGB) fixed.add(rgb);
      } else {
        strayColors.add(`#${rgb.toString(16).padStart(6, '0')}`);
      }
      const fx = x % FRAME_W;
      const fy = y % FRAME_H;
      if (fy <= 7) hatMargin += 1;
      if (fx <= 3 || fx >= 20) sideMargin += 1;
    }
  }
  if (halfAlpha > 0) problems.push(`반투명 픽셀 ${String(halfAlpha)}개 (알파는 0 또는 255)`);
  if (strayColors.size > 0) {
    problems.push(`키 색·팔레트 밖 색: ${[...strayColors].slice(0, 5).join(', ')}`);
  }
  const notAllowed = [...usedKeys].filter((key) => !ALLOWED_KEYS[kind].includes(key));
  if (notAllowed.length > 0)
    problems.push(`이 레이어에 쓸 수 없는 키 채널: ${notAllowed.join(', ')}`);
  if (fixed.size > MAX_FIXED_COLORS) {
    problems.push(`고정색 ${String(fixed.size)}개 (외곽선 제외 4색 이하)`);
  }
  if (hatMargin > 0 && kind !== 'hat')
    problems.push(`모자 여백(y 0–7)에 픽셀 ${String(hatMargin)}개 (모자만)`);
  if (sideMargin > 0 && kind !== 'hand' && kind !== 'hair' && kind !== 'hat') {
    problems.push(`좌우 여백(x 0–3, 20–23)에 픽셀 ${String(sideMargin)}개 (손 소품·머리·모자만)`);
  }
  if (kind === 'body') {
    for (let dir = 0; dir < 4; dir += 1) {
      for (const frame of FRAMES) {
        let feet = false;
        for (let fx = 0; fx < FRAME_W; fx += 1) {
          if (sheet.get(frame * FRAME_W + fx, rowOf(dir) + 39)[3] !== 0) feet = true;
        }
        if (!feet)
          problems.push(`발바닥이 y39에 없음 (행 ${String(dir)}, 프레임 ${String(frame)})`);
      }
    }
  }
  return { problems, usedKeys };
}

/** left(행 1)가 right(행 2)의 단순 좌우 반전이면 실패 (GRAPHICS 2.1 미러 금지). 둘 다 비면 통과 */
export function isMirrorOfRight(sheet: Sheet): boolean {
  let anyPixel = false;
  for (const frame of FRAMES) {
    for (let fy = 0; fy < FRAME_H; fy += 1) {
      for (let fx = 0; fx < FRAME_W; fx += 1) {
        const left = sheet.get(frame * FRAME_W + fx, rowOf(1) + fy);
        const right = sheet.get(frame * FRAME_W + (FRAME_W - 1 - fx), rowOf(2) + fy);
        if (left.join() !== right.join()) return false;
        if (left[3] !== 0) anyPixel = true;
      }
    }
  }
  return anyPixel;
}

/** 아이템(front+back 합산)이 실제로 쓴 키 채널이 카탈로그 channels와 같은지 (hair의 'hair' 채널은 암묵) */
export function channelMismatch(
  kind: LayerKind,
  used: ReadonlySet<KeyChannel>,
  declared: readonly ('primary' | 'secondary')[],
): string | null {
  if (kind === 'body') return null;
  const actual = [...used].filter((k) => k === 'primary' || k === 'secondary').sort();
  const expected = [...declared].sort();
  return actual.join() === expected.join()
    ? null
    : `catalog channels [${expected.join(', ')}] ≠ 시트 [${actual.join(', ')}]`;
}

/** 파일명 규칙 (GRAPHICS 6장·8장): `<slot>/<id>.png`, back은 `<slot>/<id>.back.png`, ID는 `<slot>_` 접두사 */
export function namingProblems(item: {
  id: string;
  slot: string;
  sheets: { front: string; back?: string };
}): string[] {
  const problems: string[] = [];
  if (!item.id.startsWith(`${item.slot}_`)) problems.push(`ID 접두사 ≠ 슬롯 ${item.slot}`);
  if (item.sheets.front !== `${item.slot}/${item.id}.png`) {
    problems.push(`front 경로 ${item.sheets.front} (${item.slot}/${item.id}.png 이어야 함)`);
  }
  if (item.sheets.back !== undefined && item.sheets.back !== `${item.slot}/${item.id}.back.png`) {
    problems.push(`back 경로 ${item.sheets.back} (${item.slot}/${item.id}.back.png 이어야 함)`);
  }
  return problems;
}

const METADATA_CHUNKS = new Set(['tEXt', 'iTXt', 'zTXt', 'tIME', 'eXIf']);

/** PNG 메타데이터 청크 이름 (GRAPHICS 8장 "메타데이터 없음") */
export function pngMetadataChunks(png: Uint8Array): string[] {
  const found: string[] = [];
  let offset = 8; // 시그니처
  while (offset + 8 <= png.length) {
    const length =
      ((png[offset] ?? 0) << 24) |
      ((png[offset + 1] ?? 0) << 16) |
      ((png[offset + 2] ?? 0) << 8) |
      (png[offset + 3] ?? 0);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    if (METADATA_CHUNKS.has(type)) found.push(type);
    if (type === 'IEND') break;
    offset += 12 + length;
  }
  return found;
}
