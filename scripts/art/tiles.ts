// 타일셋 텍스트 원본 (ROADMAP 12b-4, GRAPHICS 3장): art/source/tiles/<tilesetId>.tiles → 256×256 PNG + tileset JSON.
// 형식: `@tile <번호> <이름>` 뒤에 16줄 × 16글자. 글자는 팔레트 코드·외곽선 o·투명 . (키 색 금지 — 3.2). 순수 모듈
import { PixError, TRANSPARENT } from './pix.ts';
import { rgba, Sheet } from './sheet.ts';

export const TILE = 16;
export const TILESET_COLUMNS = 16;
export const TILESET_SIZE = TILE * TILESET_COLUMNS; // 256

export interface TileSource {
  index: number;
  name: string;
  rows: string[];
}

export interface TilesDoc {
  header: string[];
  tiles: TileSource[];
}

export function parseTiles(text: string, file: string, glyphs: ReadonlySet<string>): TilesDoc {
  const header: string[] = [];
  const tiles: TileSource[] = [];
  let current: TileSource | null = null;
  const close = (lineNo: number): void => {
    if (current !== null && current.rows.length !== TILE) {
      throw new PixError(
        file,
        lineNo,
        `타일 ${String(current.index)} ${current.name}: ${String(current.rows.length)}줄 (16줄이어야 함)`,
      );
    }
  };
  text.split(/\r?\n/).forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.trim();
    if (line === '') return;
    if (line.startsWith('#')) {
      if (tiles.length === 0) header.push(line);
      return;
    }
    const tile = /^@tile\s+(\d+)\s+([a-z0-9_]+)$/.exec(line);
    if (tile !== null) {
      close(lineNo);
      const index = Number(tile[1]);
      const name = tile[2] ?? '';
      if (index >= TILESET_COLUMNS * TILESET_COLUMNS) {
        throw new PixError(file, lineNo, `타일 번호는 0–255 (받은 값: ${String(index)})`);
      }
      if (tiles.some((t) => t.index === index || t.name === name)) {
        throw new PixError(file, lineNo, `타일 번호·이름 중복: ${String(index)} ${name}`);
      }
      current = { index, name, rows: [] };
      tiles.push(current);
      return;
    }
    if (line.startsWith('@')) {
      throw new PixError(file, lineNo, '지시어는 "@tile <번호> <소문자_이름>"');
    }
    if (current === null) {
      throw new PixError(file, lineNo, '행보다 @tile이 먼저 와야 함');
    }
    if (current.rows.length >= TILE) {
      throw new PixError(file, lineNo, `타일 ${String(current.index)}: 16줄을 넘음`);
    }
    if (!/^[\x21-\x7e]*$/.test(line) || line.length !== TILE) {
      throw new PixError(file, lineNo, `행은 ASCII 16글자 (받은 길이 ${String(line.length)})`);
    }
    for (const glyph of line) {
      if (glyph !== TRANSPARENT && !glyphs.has(glyph)) {
        throw new PixError(file, lineNo, `타일에 쓸 수 없는 글자 '${glyph}' (팔레트 코드·o·.만)`);
      }
    }
    current.rows.push(line);
  });
  close(text.split(/\r?\n/).length);
  return { header, tiles: [...tiles].sort((a, b) => a.index - b.index) };
}

/** 시트 위치: index = row × 16 + col (GRAPHICS 3.1) */
export function tileOrigin(index: number): { x: number; y: number } {
  return { x: (index % TILESET_COLUMNS) * TILE, y: Math.floor(index / TILESET_COLUMNS) * TILE };
}

export function renderTileset(doc: TilesDoc, colors: ReadonlyMap<string, string>): Sheet {
  const sheet = new Sheet(TILESET_SIZE, TILESET_SIZE);
  for (const tile of doc.tiles) {
    const origin = tileOrigin(tile.index);
    tile.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        const hex = colors.get(row.charAt(x));
        if (hex !== undefined) sheet.set(origin.x + x, origin.y + y, rgba(hex));
      }
    });
  }
  return sheet;
}

/** GRAPHICS 3.3 TilesetData */
export interface TilesetJson {
  id: string;
  image: string;
  tileSize: 16;
  columns: 16;
  count: number;
  names: Record<string, string>;
}

/** count = 가장 큰 번호 + 1 (3.3 "실제 사용 타일 수", 비어 있는 칸 포함). names는 번호 → 이름 */
export function tilesetJson(doc: TilesDoc, id: string): TilesetJson {
  const count = doc.tiles.reduce((max, tile) => Math.max(max, tile.index + 1), 0);
  return {
    id,
    image: `${id}.png`,
    tileSize: 16,
    columns: 16,
    count,
    names: Object.fromEntries(doc.tiles.map((tile) => [String(tile.index), tile.name])),
  };
}

export interface MapLike {
  id: string;
  width: number;
  height: number;
  tileset: string;
  layers: { name: string; order: 'below' | 'above'; tiles: number[] }[];
}

/**
 * 타일셋·맵 검수 (GRAPHICS 3장·4장·8장 타일셋): 256×256, 알파 0/255, 팔레트 색만(키 색 금지),
 * 맵 레이어 길이 = 폭×높이, 인덱스는 -1 또는 names에 있는 타일, floor는 -1 없음, 바닥 타일은 완전히 불투명
 */
export function tilesetProblems(
  sheet: Sheet,
  json: TilesetJson,
  palette: readonly string[],
  maps: readonly MapLike[],
): string[] {
  const problems: string[] = [];
  if (sheet.width !== TILESET_SIZE || sheet.height !== TILESET_SIZE) {
    problems.push(`타일셋 크기 ${String(sheet.width)}×${String(sheet.height)} (256×256이어야 함)`);
    return problems;
  }
  const allowed = new Set(palette.map((hex) => Number.parseInt(hex.slice(1), 16)));
  const stray = new Set<string>();
  let halfAlpha = 0;
  for (let y = 0; y < sheet.height; y += 1) {
    for (let x = 0; x < sheet.width; x += 1) {
      const [r, g, b, a] = sheet.get(x, y);
      if (a === 0) continue;
      if (a !== 255) {
        halfAlpha += 1;
        continue;
      }
      const rgb = (r << 16) | (g << 8) | b;
      if (!allowed.has(rgb)) stray.add(`#${rgb.toString(16).padStart(6, '0')}`);
    }
  }
  if (halfAlpha > 0) problems.push(`반투명 픽셀 ${String(halfAlpha)}개 (알파는 0 또는 255)`);
  if (stray.size > 0)
    problems.push(`팔레트 밖 색(키 색 포함): ${[...stray].slice(0, 5).join(', ')}`);
  const named = new Set(Object.keys(json.names).map(Number));
  for (const map of maps.filter((m) => m.tileset === json.id)) {
    for (const layer of map.layers) {
      if (layer.tiles.length !== map.width * map.height) {
        problems.push(
          `${map.id}.${layer.name}: 타일 ${String(layer.tiles.length)}개 (${String(map.width * map.height)}이어야 함)`,
        );
        continue;
      }
      const unknown = new Set(layer.tiles.filter((t) => t !== -1 && !named.has(t)));
      if (unknown.size > 0)
        problems.push(
          `${map.id}.${layer.name}: 타일셋에 없는 번호 ${[...unknown].slice(0, 5).join(', ')}`,
        );
      if (layer.name === 'floor') {
        if (layer.tiles.includes(-1))
          problems.push(`${map.id}.floor: 빈칸(-1)이 있음 (바닥은 모두 채운다)`);
        for (const index of new Set(layer.tiles)) {
          if (index < 0) continue;
          const o = { x: (index % 16) * TILE, y: Math.floor(index / 16) * TILE };
          let transparent = false;
          for (let y = 0; y < TILE && !transparent; y += 1) {
            for (let x = 0; x < TILE; x += 1) {
              if (sheet.get(o.x + x, o.y + y)[3] === 0) {
                transparent = true;
                break;
              }
            }
          }
          if (transparent)
            problems.push(
              `${map.id}.floor: 바닥 타일 ${String(index)} ${json.names[String(index)] ?? ''}에 투명 픽셀`,
            );
        }
      }
    }
  }
  return problems;
}
