// AI 생성 래스터 → .pix (ROADMAP 12b-2). 사용:
//   pnpm art:ingest <image.png> --id <itemId|body> [--sheet front|back] [--scale N] [--dir down|left|right|up] [--keep-frames]
// 기존 원본이 있으면 같은 시트(front/back)의 블록만 바꾼다. 끝나면 pnpm art:build로 PNG를 만들고 검수한다
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parseArgs } from 'node:util';

import { PNG } from 'pngjs';

import { allowedKeys, type BriefSlot } from './brief.ts';
import { AVATAR_SOURCE_DIR, loadPix, sourceOf } from './build.ts';
import { readCatalog, readPalette } from './catalog.ts';
import { ingestRaster, mergeFrames } from './ingest.ts';
import { glyphColors, KEY_GLYPHS, serializePix, type PixDoc } from './pix.ts';
import { DIRECTIONS, type Dir } from './sheet.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    id: { type: 'string' },
    sheet: { type: 'string', default: 'front' },
    scale: { type: 'string' },
    dir: { type: 'string' },
    'keep-frames': { type: 'boolean', default: false },
  },
});
const [image] = positionals;
if (image === undefined || values.id === undefined) {
  console.error(
    '사용: pnpm art:ingest <image.png> --id <itemId|body> [--sheet front|back] [--scale N] [--dir 방향] [--keep-frames]',
  );
  process.exit(1);
}
if (values.sheet !== 'front' && values.sheet !== 'back') {
  console.error('--sheet는 front 또는 back');
  process.exit(1);
}
if (values.dir !== undefined && !(DIRECTIONS as readonly string[]).includes(values.dir)) {
  console.error('--dir는 down·left·right·up');
  process.exit(1);
}

const catalog = readCatalog();
const item = values.id === 'body' ? undefined : catalog.items.find((i) => i.id === values.id);
if (values.id !== 'body' && item === undefined) {
  console.error(`카탈로그에 없는 아이템: ${values.id}`);
  process.exit(1);
}
const slot: BriefSlot = item?.slot ?? 'body';
const keys = new Set(allowedKeys(slot));
const glyphs = glyphColors(readPalette().colors);
const allowed = new Map(
  [...glyphs].filter(([glyph]) => {
    const key = KEY_GLYPHS[glyph];
    return key === undefined || keys.has(key[0]);
  }),
);

const png = PNG.sync.read(readFileSync(image));
const frames = ingestRaster(
  { width: png.width, height: png.height, data: new Uint8Array(png.data) },
  allowed,
  {
    sheet: values.sheet,
    ...(values.dir === undefined ? {} : { dir: values.dir as Dir }),
    ...(values.scale === undefined ? {} : { scale: Number(values.scale) }),
    keepFrames: values['keep-frames'],
  },
);

const target = join(AVATAR_SOURCE_DIR, sourceOf(item?.sheets.front ?? catalog.body.front));
const label = relative(process.cwd(), target);
const existing: PixDoc = existsSync(target)
  ? loadPix(target, label, glyphs)
  : { header: [`# ${values.id} — ${item?.name ?? '기준 몸'}`], frames: [] };
const doc: PixDoc = {
  header: existing.header,
  frames: mergeFrames(existing.frames, frames),
};
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, serializePix(doc));
console.log(
  `art:ingest: ${relative(process.cwd(), image)} → ${label} (${values.sheet}, 블록 ${String(frames.length)}개). 다음: pnpm art:build`,
);
