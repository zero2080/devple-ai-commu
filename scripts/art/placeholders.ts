// 자리표시 레이어 생성기 (ROADMAP 12a): 키 색(GRAPHICS 2.7)으로 칠한 단순 도형으로 실제 그림과 같은 규격의 시트를 만든다.
// 체형 2.2, 걷기 흔들림 2.3(1·3 프레임 머리·몸통 1px 아래, 다리 번갈아 듦), front/back 2.6, 손 소품 방향 2.6.
// 왼쪽·오른쪽은 단순 반전이 되지 않게 일부러 다르게 그린다 (GRAPHICS 2.1 미러 금지, 검수 8장)
import { DIRECTIONS, FRAMES, rgba, Sheet, type Dir, type FramePen } from './sheet.ts';
import { KEY_COLORS, OUTLINE_COLOR, type KeyChannel } from '../../src/game/assets/keyColors.ts';

export type SlotId = 'hair' | 'hat' | 'face' | 'top' | 'bottom' | 'shoes' | 'hand';

export interface CatalogItemLike {
  id: string;
  slot: SlotId;
  sheets: { front: string; back?: string };
  channels: ('primary' | 'secondary')[];
  coversBottom?: true;
}

const OUTLINE = rgba(OUTLINE_COLOR);
const shade = (channel: KeyChannel, which: 'hi' | 'base' | 'shadow') =>
  rgba(KEY_COLORS[channel][which]);

/** 윗줄 hi, 가운데 base, 아랫줄 shadow (높이 3 미만이면 base만) */
function block(
  pen: FramePen,
  channel: KeyChannel,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  pen.rect(shade(channel, 'base'), x0, y0, x1, y1);
  if (y1 - y0 >= 2) {
    pen.rect(shade(channel, 'hi'), x0, y0, x1, y0);
    pen.rect(shade(channel, 'shadow'), x0, y1, x1, y1);
  }
}

/** 1·3 프레임은 머리·몸통 1px 아래 */
const bobOf = (frame: number): number => (frame === 1 || frame === 3 ? 1 : 0);
/** 1 = 왼발, 3 = 오른발 (드는 다리는 1px 짧게) */
const leftRaised = (frame: number): boolean => frame === 1;
const rightRaised = (frame: number): boolean => frame === 3;

type Painter = (pen: FramePen, dir: Dir, frame: number) => void;

function paint(painter: Painter): Sheet {
  const sheet = new Sheet();
  for (const dir of DIRECTIONS) {
    for (const frame of FRAMES) {
      painter(sheet.frame(dir, frame), dir, frame);
    }
  }
  return sheet;
}

/** body_base: 피부만(skin 키) + 눈(외곽선 고정색). 발바닥은 모든 프레임에서 y39에 닿는다 */
export function bodySheet(): Sheet {
  return paint((pen, dir, frame) => {
    const b = bobOf(frame);
    block(pen, 'skin', 5, 8 + b, 18, 23 + b);
    if (dir === 'down') {
      pen.rect(OUTLINE, 8, 16 + b, 9, 17 + b);
      pen.rect(OUTLINE, 14, 16 + b, 15, 17 + b);
    } else if (dir === 'left') {
      pen.rect(OUTLINE, 7, 16 + b, 8, 17 + b);
    } else if (dir === 'right') {
      pen.rect(OUTLINE, 14, 16 + b, 15, 17 + b);
    }
    block(pen, 'skin', 6, 24 + b, 17, 31);
    block(pen, 'skin', 7, 32, 11, leftRaised(frame) ? 38 : 39);
    block(pen, 'skin', 12, 32, 16, rightRaised(frame) ? 38 : 39);
  });
}

function hairFront(item: CatalogItemLike): Sheet {
  const thin = item.id === 'hair_buzz';
  const long = item.sheets.back !== undefined;
  const ribbon = item.channels.includes('secondary');
  return paint((pen, dir, frame) => {
    const b = bobOf(frame);
    if (dir === 'up') {
      block(pen, 'hair', 5, 8 + b, 18, (long ? 28 : 23) + b);
    } else {
      block(pen, 'hair', 5, 8 + b, 18, (thin ? 9 : 12) + b);
      if (thin) {
        // 짧은 머리도 옆모습은 뒤통수 쪽이 남는다 (left = 오른쪽, right = 왼쪽)
        if (dir === 'left') pen.rect(shade('hair', 'shadow'), 15, 10 + b, 18, 12 + b);
        if (dir === 'right') pen.rect(shade('hair', 'shadow'), 5, 10 + b, 7, 13 + b);
      } else {
        if (dir === 'down') {
          pen.rect(shade('hair', 'base'), 5, 13 + b, 6, 17 + b);
          pen.rect(shade('hair', 'base'), 17, 13 + b, 18, 17 + b);
        } else if (dir === 'left') {
          pen.rect(shade('hair', 'shadow'), 13, 13 + b, 18, 19 + b);
        } else {
          pen.rect(shade('hair', 'shadow'), 5, 13 + b, 9, 19 + b);
        }
      }
    }
    if (ribbon) {
      const x = dir === 'left' ? 17 : dir === 'right' ? 5 : 16;
      pen.rect(shade('secondary', 'base'), x, 8 + b, x + 1, 9 + b);
    }
  });
}

function hairBack(): Sheet {
  return paint((pen, dir, frame) => {
    if (dir !== 'up') {
      const b = bobOf(frame);
      // 옆모습에서 긴 머리는 뒤통수 쪽으로 몰린다 (left = 오른쪽, right = 왼쪽, 길이도 다르게)
      if (dir === 'down') block(pen, 'hair', 5, 13 + b, 18, 28);
      else if (dir === 'left') block(pen, 'hair', 10, 13 + b, 18, 29);
      else block(pen, 'hair', 5, 13 + b, 12, 28);
    }
  });
}

function hatFront(item: CatalogItemLike): Sheet {
  const stripe = item.channels.includes('secondary');
  return paint((pen, dir, frame) => {
    const b = bobOf(frame);
    block(pen, 'primary', 4, 4 + b, 19, 9 + b);
    if (stripe) {
      pen.rect(shade('secondary', 'base'), 4, 7 + b, 19, 7 + b);
    }
    const brim = shade('primary', 'shadow');
    if (dir === 'down') pen.rect(brim, 2, 9 + b, 21, 9 + b);
    if (dir === 'left') pen.rect(brim, 1, 9 + b, 12, 9 + b);
    if (dir === 'right') pen.rect(brim, 12, 9 + b, 21, 9 + b);
  });
}

function hatBack(): Sheet {
  return paint((pen, dir, frame) => {
    const b = bobOf(frame);
    const brim = shade('primary', 'shadow');
    if (dir === 'left') pen.rect(brim, 13, 10 + b, 22, 10 + b);
    else if (dir === 'right') pen.rect(brim, 1, 10 + b, 9, 10 + b);
    else pen.rect(brim, 1, 10 + b, 22, 10 + b);
  });
}

function faceFront(item: CatalogItemLike): Sheet {
  const lens = item.channels.includes('secondary');
  return paint((pen, dir, frame) => {
    if (dir === 'up') {
      return; // 뒤돌면 보이지 않는다
    }
    const b = bobOf(frame);
    const p = shade('primary', 'base');
    if (item.id === 'face_mask') {
      if (dir === 'down') block(pen, 'primary', 7, 18 + b, 16, 21 + b);
      if (dir === 'left') block(pen, 'primary', 5, 18 + b, 11, 21 + b);
      if (dir === 'right') block(pen, 'primary', 12, 18 + b, 17, 21 + b);
      return;
    }
    if (item.id === 'face_beard') {
      if (dir === 'down') block(pen, 'primary', 7, 20 + b, 16, 23 + b);
      if (dir === 'left') block(pen, 'primary', 5, 20 + b, 10, 23 + b);
      if (dir === 'right') block(pen, 'primary', 13, 20 + b, 17, 23 + b);
      return;
    }
    if (dir === 'down') {
      pen.rect(p, 7, 15 + b, 10, 17 + b);
      pen.rect(p, 13, 15 + b, 16, 17 + b);
      pen.rect(p, 11, 16 + b, 12, 16 + b);
      if (lens) {
        pen.rect(shade('secondary', 'base'), 8, 16 + b, 9, 16 + b);
        pen.rect(shade('secondary', 'base'), 14, 16 + b, 15, 16 + b);
      }
    } else if (dir === 'left') {
      pen.rect(p, 5, 15 + b, 9, 17 + b);
      if (lens) pen.rect(shade('secondary', 'base'), 6, 16 + b, 7, 16 + b);
    } else {
      pen.rect(p, 13, 15 + b, 18, 17 + b);
      if (lens) pen.rect(shade('secondary', 'base'), 15, 16 + b, 16, 16 + b);
    }
  });
}

function topFront(item: CatalogItemLike): Sheet {
  const collar = item.channels.includes('secondary');
  const bottom = item.coversBottom === true ? 36 : 31;
  return paint((pen, dir, frame) => {
    const b = bobOf(frame);
    block(pen, 'primary', 5, 24 + b, 18, bottom);
    const dark = shade('primary', 'shadow');
    if (dir === 'left') pen.rect(dark, 17, 25 + b, 18, bottom - 1);
    if (dir === 'right') pen.rect(dark, 5, 25 + b, 5, bottom - 1);
    if (collar && dir !== 'up') {
      const [x0, x1] = dir === 'down' ? [10, 13] : dir === 'left' ? [5, 8] : [14, 18];
      pen.rect(shade('secondary', 'base'), x0, 24 + b, x1, 25 + b);
    }
  });
}

function bottomFront(item: CatalogItemLike): Sheet {
  const belt = item.channels.includes('secondary');
  return paint((pen, dir, frame) => {
    block(pen, 'primary', 7, 32, 11, leftRaised(frame) ? 35 : 36);
    block(pen, 'primary', 12, 32, 16, rightRaised(frame) ? 35 : 36);
    const dark = shade('primary', 'shadow');
    if (dir === 'left') pen.rect(dark, 16, 33, 16, 35);
    if (dir === 'right') pen.rect(dark, 7, 33, 8, 35);
    if (belt) {
      pen.rect(shade('secondary', 'base'), 7, 32, 16, 32);
    }
  });
}

function shoesFront(item: CatalogItemLike): Sheet {
  const sole = item.channels.includes('secondary');
  return paint((pen, dir, frame) => {
    const left = leftRaised(frame) ? 1 : 0;
    const right = rightRaised(frame) ? 1 : 0;
    block(pen, 'primary', 6, 37 - left, 11, 39 - left);
    block(pen, 'primary', 12, 37 - right, 17, 39 - right);
    const p = shade('primary', 'base');
    if (dir === 'left') pen.rect(p, 5, 38, 5, 39);
    if (dir === 'right') pen.rect(p, 18, 38, 19, 39);
    if (sole) {
      pen.rect(shade('secondary', 'base'), 6, 39 - left, 11, 39 - left);
      pen.rect(shade('secondary', 'base'), 12, 39 - right, 17, 39 - right);
    }
  });
}

/** 오른손 소품 (GRAPHICS 2.6 표): down·right는 front, left·up은 back */
function handSheet(item: CatalogItemLike, sheet: 'front' | 'back'): Sheet {
  const accent = item.channels.includes('secondary');
  return paint((pen, dir, frame) => {
    const b = bobOf(frame);
    const placement: Partial<Record<Dir, [number, number, number, number]>> =
      sheet === 'front'
        ? { down: [0, 25, 3, 31], right: [20, 25, 23, 31] }
        : { left: [18, 24, 21, 29], up: [17, 24, 20, 30] };
    const at = placement[dir];
    if (at === undefined) {
      return;
    }
    const [x0, y0, x1, y1] = at;
    block(pen, 'primary', x0, y0 + b, x1, y1 + b);
    if (accent) {
      pen.rect(shade('secondary', 'base'), x0 + 1, y0 + b + 1, x0 + 2, y0 + b + 1);
    }
  });
}

/** 아이템의 front(필수)·back(카탈로그에 있을 때) 시트 */
export function itemSheets(item: CatalogItemLike): { front: Sheet; back?: Sheet } {
  const hasBack = item.sheets.back !== undefined;
  switch (item.slot) {
    case 'hair':
      return hasBack ? { front: hairFront(item), back: hairBack() } : { front: hairFront(item) };
    case 'hat':
      return hasBack ? { front: hatFront(item), back: hatBack() } : { front: hatFront(item) };
    case 'face':
      return { front: faceFront(item) };
    case 'top':
      return { front: topFront(item) };
    case 'bottom':
      return { front: bottomFront(item) };
    case 'shoes':
      return { front: shoesFront(item) };
    case 'hand':
      return { front: handSheet(item, 'front'), back: handSheet(item, 'back') };
  }
}
