import { describe, expect, it } from 'vitest';

import {
  channelMismatch,
  checkLayer,
  isMirrorOfRight,
  namingProblems,
  pngMetadataChunks,
} from './checks.ts';
import { bodySheet, itemSheets, type CatalogItemLike } from './placeholders.ts';
import { DIRECTIONS, FRAMES, rgba, Sheet } from './sheet.ts';
import { KEY_COLORS, OUTLINE_COLOR } from '../../src/game/assets/keyColors.ts';

const PALETTE = [OUTLINE_COLOR, '#262b44', '#3a4466', '#5a6988', '#8b9bb4', '#c0cbdc'];
const primary = rgba(KEY_COLORS.primary.base);

/** 모든 프레임에 같은 도형 + right 행에만 표식 1px (미러 판정에 걸리지 않게) */
function sheetWith(paint: (sheet: Sheet, ox: number, oy: number) => void): Sheet {
  const sheet = new Sheet();
  DIRECTIONS.forEach((_, row) => {
    for (const frame of FRAMES) paint(sheet, frame * 24, row * 40);
  });
  return sheet;
}

const shirt = () =>
  sheetWith((sheet, ox, oy) => {
    for (let y = 24; y <= 31; y += 1)
      for (let x = 5; x <= 18; x += 1) sheet.set(ox + x, oy + y, primary);
  });

describe('checkLayer (GRAPHICS 8장)', () => {
  it('규격에 맞는 레이어는 문제없이 쓴 키 채널을 돌려준다', () => {
    const report = checkLayer('top', shirt(), PALETTE);
    expect(report.problems).toEqual([]);
    expect([...report.usedKeys]).toEqual(['primary']);
  });

  it('크기가 96×160이 아니면 다른 검사 없이 실패', () => {
    const report = checkLayer('top', new Sheet(48, 80), PALETTE);
    expect(report.problems).toEqual(['크기 48×80 (96×160이어야 함)']);
  });

  it('반투명 픽셀·키도 팔레트도 아닌 색을 잡는다', () => {
    const sheet = shirt();
    sheet.set(6, 26, rgba(KEY_COLORS.primary.base, 128));
    sheet.set(7, 26, rgba('#123456'));
    const { problems } = checkLayer('top', sheet, PALETTE);
    expect(problems).toContain('반투명 픽셀 1개 (알파는 0 또는 255)');
    expect(problems).toContain('키 색·팔레트 밖 색: #123456');
  });

  it('레이어에 허용되지 않은 키 채널 (body는 skin만, hair는 hair·secondary만)', () => {
    expect(checkLayer('body', shirt(), PALETTE).problems).toContain(
      '이 레이어에 쓸 수 없는 키 채널: primary',
    );
    expect(checkLayer('hair', shirt(), PALETTE).problems).toContain(
      '이 레이어에 쓸 수 없는 키 채널: primary',
    );
  });

  it('고정색은 외곽선을 빼고 4색까지', () => {
    const sheet = shirt();
    PALETTE.forEach((hex, i) => {
      sheet.set(5 + i, 30, rgba(hex));
    });
    const { problems } = checkLayer('top', sheet, PALETTE);
    expect(problems).toContain('고정색 5개 (외곽선 제외 4색 이하)');
    const four = shirt();
    PALETTE.slice(0, 5).forEach((hex, i) => {
      four.set(5 + i, 30, rgba(hex));
    });
    expect(checkLayer('top', four, PALETTE).problems).toEqual([]);
  });

  it('모자 여백은 hat만, 좌우 여백은 hand·hair·hat만', () => {
    const sheet = shirt();
    sheet.set(10, 3, primary);
    sheet.set(1, 26, primary);
    expect(checkLayer('top', sheet, PALETTE).problems).toEqual([
      '모자 여백(y 0–7)에 픽셀 1개 (모자만)',
      '좌우 여백(x 0–3, 20–23)에 픽셀 1개 (손 소품·머리·모자만)',
    ]);
    expect(checkLayer('hat', sheet, PALETTE).problems).toEqual([]);
    expect(checkLayer('hand', sheet, PALETTE).problems).toEqual([
      '모자 여백(y 0–7)에 픽셀 1개 (모자만)',
    ]);
  });

  it('body 발바닥이 y39에 닿지 않는 프레임을 하나하나 짚는다', () => {
    const sheet = bodySheet();
    for (let x = 0; x < 24; x += 1) sheet.set(24 * 2 + x, 40 * 3 + 39, [0, 0, 0, 0]);
    expect(checkLayer('body', sheet, PALETTE).problems).toEqual([
      '발바닥이 y39에 없음 (행 3, 프레임 2)',
    ]);
  });
});

describe('isMirrorOfRight (미러 금지)', () => {
  it('left 행이 right 행의 좌우 반전이면 true, 한 픽셀이라도 다르면 false, 둘 다 비면 false', () => {
    const sheet = new Sheet();
    for (const frame of FRAMES) {
      sheet.set(frame * 24 + 3, 40 + 10, primary); // left
      sheet.set(frame * 24 + 20, 80 + 10, primary); // right (24 - 1 - 3)
    }
    expect(isMirrorOfRight(sheet)).toBe(true);
    sheet.set(3 * 24 + 5, 80 + 12, primary);
    expect(isMirrorOfRight(sheet)).toBe(false);
    expect(isMirrorOfRight(new Sheet())).toBe(false);
  });
});

describe('channelMismatch', () => {
  it('primary·secondary만 비교하고 순서는 무시, hair 채널은 암묵', () => {
    expect(channelMismatch('hair', new Set(['hair', 'secondary']), ['secondary'])).toBeNull();
    expect(
      channelMismatch('top', new Set(['secondary', 'primary']), ['primary', 'secondary']),
    ).toBeNull();
    expect(channelMismatch('top', new Set(['primary']), ['primary', 'secondary'])).toBe(
      'catalog channels [primary, secondary] ≠ 시트 [primary]',
    );
    expect(channelMismatch('body', new Set(['skin']), [])).toBeNull();
  });
});

describe('namingProblems', () => {
  it('<slot>/<id>.png · <slot>/<id>.back.png · <slot>_ 접두사', () => {
    expect(
      namingProblems({
        id: 'hair_long',
        slot: 'hair',
        sheets: { front: 'hair/hair_long.png', back: 'hair/hair_long.back.png' },
      }),
    ).toEqual([]);
    expect(
      namingProblems({
        id: 'cap',
        slot: 'hat',
        sheets: { front: 'hat/cap.png', back: 'hat/cap_back.png' },
      }),
    ).toEqual(['ID 접두사 ≠ 슬롯 hat', 'back 경로 hat/cap_back.png (hat/cap.back.png 이어야 함)']);
  });
});

describe('pngMetadataChunks', () => {
  it('pngjs 출력에는 메타데이터 청크가 없고, tEXt를 끼우면 찾는다', () => {
    const png = new Sheet(2, 2).toPng();
    expect(pngMetadataChunks(png)).toEqual([]);
    const text = Buffer.from([0, 0, 0, 1, ...Buffer.from('tEXt'), 0x41, 0, 0, 0, 0]);
    const withText = Buffer.concat([png.subarray(0, 33), text, png.subarray(33)]);
    expect(pngMetadataChunks(withText)).toEqual(['tEXt']);
  });
});

describe('자리표시 생성기는 자기 검수를 통과한다', () => {
  const items: CatalogItemLike[] = [
    { id: 'hair_buzz', slot: 'hair', sheets: { front: 'hair/hair_buzz.png' }, channels: [] },
    {
      id: 'hair_long',
      slot: 'hair',
      sheets: { front: 'hair/hair_long.png', back: 'hair/hair_long.back.png' },
      channels: ['secondary'],
    },
    {
      id: 'hat_cap',
      slot: 'hat',
      sheets: { front: 'hat/hat_cap.png', back: 'hat/hat_cap.back.png' },
      channels: ['primary', 'secondary'],
    },
    {
      id: 'face_mask',
      slot: 'face',
      sheets: { front: 'face/face_mask.png' },
      channels: ['primary'],
    },
    {
      id: 'top_robe',
      slot: 'top',
      sheets: { front: 'top/top_robe.png' },
      channels: ['primary'],
      coversBottom: true,
    },
    {
      id: 'bottom_jeans',
      slot: 'bottom',
      sheets: { front: 'bottom/bottom_jeans.png' },
      channels: ['primary', 'secondary'],
    },
    {
      id: 'shoes_boots',
      slot: 'shoes',
      sheets: { front: 'shoes/shoes_boots.png' },
      channels: ['primary'],
    },
    {
      id: 'hand_sword',
      slot: 'hand',
      sheets: { front: 'hand/hand_sword.png', back: 'hand/hand_sword.back.png' },
      channels: ['primary', 'secondary'],
    },
  ];

  it('body', () => {
    const sheet = bodySheet();
    expect(checkLayer('body', sheet, PALETTE).problems).toEqual([]);
    expect(isMirrorOfRight(sheet)).toBe(false);
  });

  it.each(items)('$id', (item) => {
    const { front, back } = itemSheets(item);
    const used = new Set<'skin' | 'hair' | 'primary' | 'secondary'>();
    for (const sheet of back === undefined ? [front] : [front, back]) {
      const report = checkLayer(item.slot, sheet, PALETTE);
      expect(report.problems).toEqual([]);
      expect(isMirrorOfRight(sheet)).toBe(false);
      report.usedKeys.forEach((key) => used.add(key));
    }
    expect(channelMismatch(item.slot, used, item.channels)).toBeNull();
  });
});
