// .pix 텍스트 원본 (ROADMAP 12b-1, art/README.md): 방향별 서기 프레임(24×40)을 글자 격자로 적는다.
// 글자는 전역 표 하나 — 키 색 12(GRAPHICS 2.7) + 외곽선 + 팔레트 고정색 코드(palette.json 순서) + '.' 투명.
// 순수 모듈: 파일 읽기는 build.ts·ingest.ts가 한다
import { DIRECTIONS, FRAME_H, FRAME_W, type Dir } from './sheet.ts';
import {
  KEY_COLORS,
  OUTLINE_COLOR,
  type KeyChannel,
  type Shade,
} from '../../src/game/assets/keyColors.ts';

export const TRANSPARENT = '.';
export const OUTLINE_GLYPH = 'o';

/** 키 색 글자: 피부 H S D · 머리 a b c · 주색 P Q R · 보조색 x y z (각각 hi · base · shadow) */
export const KEY_GLYPHS: Readonly<Record<string, readonly [KeyChannel, Shade]>> = {
  H: ['skin', 'hi'],
  S: ['skin', 'base'],
  D: ['skin', 'shadow'],
  a: ['hair', 'hi'],
  b: ['hair', 'base'],
  c: ['hair', 'shadow'],
  P: ['primary', 'hi'],
  Q: ['primary', 'base'],
  R: ['primary', 'shadow'],
  x: ['secondary', 'hi'],
  y: ['secondary', 'base'],
  z: ['secondary', 'shadow'],
};

/** 팔레트 고정색 코드. palette.json colors[i] → PALETTE_CODES[i] (외곽선 색은 'o'). 헷갈리는 O·I·0과 키 글자는 뺐다 */
const PALETTE_CODES = '123456789ABCEFGJKLMNTUVWXYZdefghijk';

/** 글자 → '#rrggbb'. 외곽선 색이 팔레트에 있으면 그 칸은 'o' */
export function glyphColors(palette: readonly string[]): Map<string, string> {
  const table = new Map<string, string>();
  for (const [glyph, [channel, shade]] of Object.entries(KEY_GLYPHS)) {
    table.set(glyph, KEY_COLORS[channel][shade]);
  }
  table.set(OUTLINE_GLYPH, OUTLINE_COLOR);
  let next = 0;
  for (const hex of palette) {
    if (hex === OUTLINE_COLOR) {
      continue;
    }
    const code = PALETTE_CODES[next];
    if (code === undefined) {
      throw new Error(`palette has more colors than codes (${String(PALETTE_CODES.length)})`);
    }
    table.set(code, hex);
    next += 1;
  }
  return table;
}

export type SheetSide = 'front' | 'back';

/** 한 방향·한 프레임의 격자. rows는 40줄 × 24글자 */
export interface PixFrame {
  sheet: SheetSide;
  dir: Dir;
  /** 0 = 서기(원본). 1–3은 명시적으로 그린 걷기 프레임 (없으면 walk.ts가 파생) */
  frame: number;
  rows: string[];
}

export interface PixDoc {
  /** 파일 맨 위 '#' 주석 (직렬화 때 보존) */
  header: string[];
  frames: PixFrame[];
}

export class PixError extends Error {
  constructor(file: string, line: number, message: string) {
    super(`${file}:${String(line)}: ${message}`);
    this.name = 'PixError';
  }
}

const EMPTY_ROW = TRANSPARENT.repeat(FRAME_W);
const isDir = (value: string): value is Dir => (DIRECTIONS as readonly string[]).includes(value);

/** .pix 텍스트 → 문서. 알 수 없는 글자·길이·행 범위·중복은 파일:줄과 함께 PixError */
export function parsePix(text: string, file: string, glyphs: ReadonlySet<string>): PixDoc {
  const header: string[] = [];
  const frames: PixFrame[] = [];
  let sheet: SheetSide = 'front';
  let current: (PixFrame & { seen: Set<number> }) | null = null;
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, index) => {
    const lineNo = index + 1;
    const line = raw.trimEnd();
    if (line.trim() === '') {
      return;
    }
    if (line.startsWith('#')) {
      if (frames.length === 0 && current === null) {
        header.push(line);
      }
      return;
    }
    const directive = /^@(\w+)(?:\s+(\S+))?(?:\s+(\S+))?$/.exec(line);
    if (directive !== null) {
      const [, name, arg1, arg2] = directive;
      if (name === 'sheet') {
        if (arg1 !== 'front' && arg1 !== 'back') {
          throw new PixError(file, lineNo, `@sheet는 front 또는 back (받은 값: ${arg1 ?? '없음'})`);
        }
        sheet = arg1;
        current = null;
        return;
      }
      if (name === 'dir') {
        if (arg1 === undefined || !isDir(arg1)) {
          throw new PixError(
            file,
            lineNo,
            `@dir는 down·left·right·up (받은 값: ${arg1 ?? '없음'})`,
          );
        }
        const frame = arg2 === undefined ? 0 : Number(arg2);
        if (!Number.isInteger(frame) || frame < 0 || frame > 3) {
          throw new PixError(file, lineNo, `프레임은 0–3 (받은 값: ${arg2 ?? ''})`);
        }
        if (frames.some((f) => f.sheet === sheet && f.dir === arg1 && f.frame === frame)) {
          throw new PixError(file, lineNo, `${sheet} ${arg1} ${String(frame)} 블록이 두 번 있음`);
        }
        current = {
          sheet,
          dir: arg1,
          frame,
          rows: Array<string>(FRAME_H).fill(EMPTY_ROW),
          seen: new Set(),
        };
        frames.push(current);
        return;
      }
      throw new PixError(file, lineNo, `알 수 없는 지시어 @${name ?? ''}`);
    }
    const row = /^\s*(\d+)\s+(\S+)$/.exec(line);
    if (row === null) {
      throw new PixError(file, lineNo, '행은 "<y> <24글자>" 형식');
    }
    if (current === null) {
      throw new PixError(file, lineNo, '행보다 @dir가 먼저 와야 함');
    }
    const y = Number(row[1]);
    const pixels = row[2] ?? '';
    if (y >= FRAME_H) {
      throw new PixError(file, lineNo, `y는 0–${String(FRAME_H - 1)} (받은 값: ${String(y)})`);
    }
    // 전역 글자표는 ASCII뿐이라 길이·순회를 UTF-16 단위로 해도 된다
    if (!/^[\x21-\x7e]*$/.test(pixels)) {
      throw new PixError(file, lineNo, '행에는 전역 글자표의 ASCII 글자만 (art/README.md)');
    }
    if (pixels.length !== FRAME_W) {
      throw new PixError(
        file,
        lineNo,
        `행 길이 ${String(pixels.length)} (${String(FRAME_W)}이어야 함)`,
      );
    }
    for (const glyph of pixels) {
      if (glyph !== TRANSPARENT && !glyphs.has(glyph)) {
        throw new PixError(file, lineNo, `알 수 없는 글자 '${glyph}'`);
      }
    }
    if (current.seen.has(y)) {
      throw new PixError(file, lineNo, `y ${String(y)} 행이 두 번 있음`);
    }
    current.seen.add(y);
    current.rows[y] = pixels;
  });
  return {
    header,
    frames: frames.map(({ sheet: s, dir, frame, rows }) => ({ sheet: s, dir, frame, rows })),
  };
}

/** 문서 → .pix 텍스트. 빈 행은 적지 않는다. 블록 순서 = front → back, down → left → right → up, 프레임 오름차순 */
export function serializePix(doc: PixDoc): string {
  const out: string[] = [...doc.header];
  const sides: SheetSide[] = ['front', 'back'];
  for (const side of sides) {
    const blocks = doc.frames
      .filter((f) => f.sheet === side)
      .sort((a, b) => DIRECTIONS.indexOf(a.dir) - DIRECTIONS.indexOf(b.dir) || a.frame - b.frame);
    if (blocks.length === 0) {
      continue;
    }
    if (out.length > 0) {
      out.push('');
    }
    out.push(`@sheet ${side}`);
    for (const block of blocks) {
      out.push(
        block.frame === 0 ? `@dir ${block.dir}` : `@dir ${block.dir} ${String(block.frame)}`,
      );
      block.rows.forEach((pixels, y) => {
        if (pixels !== EMPTY_ROW) {
          out.push(`${String(y).padStart(2, ' ')} ${pixels}`);
        }
      });
    }
  }
  return `${out.join('\n')}\n`;
}
