// AI 생성 지시문 생성 (ROADMAP 12b-2): art/ai/briefs/<id>.md (몸 + 카탈로그 전부) + art/ai/glyphs.md. 사용: pnpm art:brief
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { briefContext, briefFor, briefItems } from './brief.ts';
import { ART_DIR } from './build.ts';
import { readCatalog, readPalette } from './catalog.ts';

const OUT = join(ART_DIR, 'ai/briefs');
const context = briefContext(readPalette().colors);
const items = briefItems(readCatalog());

mkdirSync(OUT, { recursive: true });
const wanted = new Set(items.map((item) => `${item.id}.md`));
for (const file of readdirSync(OUT)) {
  if (file.endsWith('.md') && !wanted.has(file)) rmSync(join(OUT, file)); // 카탈로그에서 빠진 아이템
}
for (const item of items) {
  writeFileSync(join(OUT, `${item.id}.md`), briefFor(item, context));
}
writeFileSync(
  join(ART_DIR, 'ai/glyphs.md'),
  `# 팔레트 고정색 코드\n\n> 자동 생성 (\`pnpm art:brief\`) — \`palette.json\` 순서대로 매긴 \`.pix\` 글자 (외곽선 \`#181425\` = \`o\`). 형식은 \`art/README.md\`.\n\n${context.paletteTable}\n`,
);
console.log(`art:brief: 지시문 ${String(items.length)}개 → ${OUT}`);
