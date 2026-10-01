import { describe, expect, it } from 'vitest';

import { allowedKeys, briefFor, ITEM_PROMPTS, paletteGlyphTable, type BriefItem } from './brief.ts';
import { readCatalog, readPalette } from './catalog.ts';
import { glyphColors } from './pix.ts';

const palette = readPalette().colors;
const ctx = {
  paletteTable: paletteGlyphTable(glyphColors(palette)),
  keyHex: {
    hair: ['#8080ff', '#0000ff', '#000080'],
    primary: ['#ff8080', '#ff0000', '#800000'],
    secondary: ['#80ff80', '#00ff00', '#008000'],
    skin: ['#ffff80', '#ffff00', '#808000'],
  },
  paletteHex: palette,
} as const;

describe('briefFor (AI 생성 지시문)', () => {
  it('카탈로그의 모든 아이템과 몸에 영어 묘사가 있다', () => {
    const ids = ['body', ...readCatalog().items.map((item) => item.id)];
    expect(ids.filter((id) => ITEM_PROMPTS[id] === undefined)).toEqual([]);
  });

  it('back 시트·키 색·원본 경로·팔레트 hex를 담는다', () => {
    const item: BriefItem = {
      id: 'hair_ponytail',
      slot: 'hair',
      name: '포니테일',
      sheets: { front: 'hair/hair_ponytail.png', back: 'hair/hair_ponytail.back.png' },
      channels: ['secondary'],
      defaultColors: { secondary: 'item_red' },
    };
    const text = briefFor(item, ctx);
    expect(text).toContain('# hair_ponytail — 포니테일');
    expect(text).toContain('front + **back**');
    expect(text).toContain('머리 `a b c`');
    expect(text).toContain(
      'hair: #8080ff / #0000ff / #000080; secondary: #80ff80 / #00ff00 / #008000',
    );
    expect(text).toContain('`art/source/avatar/hair/hair_ponytail.pix`');
    expect(text).toContain('pnpm art:ingest <파일> --id hair_ponytail [--sheet back]');
    expect(text).toContain('Also output a second strip');
    expect(text).toContain(palette.join(' '));
    expect(text).not.toContain('주색 `P Q R`'); // 포니테일은 주색 채널을 쓰지 않는다
  });

  it('몸은 피부 키, back 없음, 원본은 body_base.pix', () => {
    const text = briefFor(
      {
        id: 'body',
        slot: 'body',
        name: '기준 몸',
        sheets: { front: 'body/body_base.png' },
        channels: [],
        defaultColors: {},
      },
      ctx,
    );
    expect(text).toContain('피부 `H S D`');
    expect(text).toContain('`art/source/avatar/body/body_base.pix`');
    expect(text).not.toContain('second strip');
  });

  it('묘사가 없는 새 아이템이면 어디를 고칠지 알려 주며 실패', () => {
    expect(() =>
      briefFor(
        {
          id: 'hat_crown',
          slot: 'hat',
          name: '왕관',
          sheets: { front: 'hat/hat_crown.png' },
          channels: ['primary'],
          defaultColors: {},
        },
        ctx,
      ),
    ).toThrow('ITEM_PROMPTS에 "hat_crown" 묘사가 없음');
  });

  it('allowedKeys: GRAPHICS 2.7 표', () => {
    expect(allowedKeys('body')).toEqual(['skin']);
    expect(allowedKeys('hair')).toEqual(['hair', 'secondary']);
    expect(allowedKeys('hand')).toEqual(['primary', 'secondary']);
  });

  it('paletteGlyphTable: 키·외곽선을 뺀 31색', () => {
    const lines = paletteGlyphTable(glyphColors(palette)).split('\n');
    expect(lines).toHaveLength(2 + 31);
    expect(lines[2]).toBe('| `1` | `#be4a2f` | 적갈 |');
  });
});
