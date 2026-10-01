// 제작 템플릿 (GRAPHICS 7.2): art/templates/avatar-guide.png · key-colors.png · body_base.png
// 사용: pnpm art:templates
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { bodySheet } from './placeholders.ts';
import { DIRECTIONS, FRAME_H, FRAME_W, FRAMES, rgba, Sheet } from './sheet.ts';
import { KEY_CHANNELS, KEY_COLORS, SHADES } from '../../src/game/assets/keyColors.ts';

const OUT = join(import.meta.dirname, '../../art/templates');
mkdirSync(OUT, { recursive: true });

/** 96×160 가이드: 프레임 격자, 모자 여백(y0–7)·좌우 여백(x0–3, x20–23), 몸 박스, 머리·몸통·다리 경계, 앵커 */
function guide(): Sheet {
  const sheet = new Sheet();
  const margin = rgba('#262b44');
  const grid = rgba('#5a6988');
  const box = rgba('#8b9bb4');
  const line = rgba('#3a4466');
  const anchor = rgba('#e43b44');
  for (const dir of DIRECTIONS) {
    for (const frame of FRAMES) {
      const pen = sheet.frame(dir, frame);
      pen.rect(margin, 0, 0, FRAME_W - 1, 7);
      pen.rect(margin, 0, 0, 3, FRAME_H - 1);
      pen.rect(margin, 20, 0, FRAME_W - 1, FRAME_H - 1);
      for (const y of [23, 31]) pen.rect(line, 4, y, 19, y);
      pen.rect(box, 4, 8, 19, 8);
      pen.rect(box, 4, 39, 19, 39);
      pen.rect(box, 4, 8, 4, 39);
      pen.rect(box, 19, 8, 19, 39);
      pen.rect(grid, 0, 0, FRAME_W - 1, 0);
      pen.rect(grid, 0, 0, 0, FRAME_H - 1);
      pen.rect(anchor, 11, 39, 12, 39);
    }
  }
  return sheet;
}

/** 키 색 12칸 견본: 행 = 채널(skin·hair·primary·secondary), 열 = hi·base·shadow, 칸 16×16 */
function keySwatches(): Sheet {
  const size = 16;
  const sheet = new Sheet(size * SHADES.length, size * KEY_CHANNELS.length);
  KEY_CHANNELS.forEach((channel, row) => {
    SHADES.forEach((shade, col) => {
      const color = rgba(KEY_COLORS[channel][shade]);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          sheet.set(col * size + x, row * size + y, color);
        }
      }
    });
  });
  return sheet;
}

guide().save(join(OUT, 'avatar-guide.png'));
keySwatches().save(join(OUT, 'key-colors.png'));
bodySheet().save(join(OUT, 'body_base.png'));
console.log(`templates → ${OUT}`);
