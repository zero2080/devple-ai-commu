// .pix 원본 → 96×160 레이어 시트 (ROADMAP 12b-1). 렌더는 순수 함수, 파일 입출력은 CLI(build-avatars.ts)·check-assets가 한다
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parsePix, type PixDoc, type SheetSide } from './pix.ts';
import { DIRECTIONS, FRAMES, rgba, Sheet } from './sheet.ts';
import { deriveWalkFrame } from './walk.ts';

export const ART_DIR = join(import.meta.dirname, '../../art');
export const AVATAR_SOURCE_DIR = join(ART_DIR, 'avatar');

/** 카탈로그 시트 경로('hair/hair_long.back.png') → 원본 상대 경로('hair/hair_long.pix'). front·back은 같은 원본 */
export function sourceOf(sheetPath: string): string {
  return sheetPath.replace(/(\.back)?\.png$/, '.pix');
}

export function hasSide(doc: PixDoc, side: SheetSide): boolean {
  return doc.frames.some((frame) => frame.sheet === side);
}

/** 한 시트를 그린다. 방향마다 서기(0)에서 걷기 1–3을 파생하고, 명시적 프레임 블록이 있으면 그것을 쓴다 */
export function renderSheet(
  doc: PixDoc,
  side: SheetSide,
  colors: ReadonlyMap<string, string>,
): Sheet {
  const sheet = new Sheet();
  for (const dir of DIRECTIONS) {
    const blocks = doc.frames.filter((frame) => frame.sheet === side && frame.dir === dir);
    const idle = blocks.find((block) => block.frame === 0)?.rows;
    for (const frame of FRAMES) {
      const rows =
        blocks.find((block) => block.frame === frame)?.rows ??
        (idle === undefined ? undefined : deriveWalkFrame(idle, frame));
      if (rows === undefined) {
        continue;
      }
      const pen = sheet.frame(dir, frame);
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x += 1) {
          const hex = colors.get(row.charAt(x));
          if (hex !== undefined) {
            pen.px(rgba(hex), x, y);
          }
        }
      });
    }
  }
  return sheet;
}

export function loadPix(path: string, label: string, colors: ReadonlyMap<string, string>): PixDoc {
  return parsePix(readFileSync(path, 'utf8'), label, new Set(colors.keys()));
}

/** 두 시트의 픽셀이 같은가 (원본 ↔ 커밋된 PNG 동기화 검사) */
export function samePixels(a: Sheet, b: Sheet): boolean {
  return (
    a.width === b.width &&
    a.height === b.height &&
    a.data.length === b.data.length &&
    a.data.every((value, i) => value === b.data[i])
  );
}
