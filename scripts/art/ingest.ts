// AI가 만든 래스터 → .pix 블록 (ROADMAP 12b-2). 순수 함수 — 파일 입출력은 ingest-cli.ts
// 1) 배경 제거(투명 또는 모서리와 같은 단색) 2) 정수 배율 축소(블록 최빈색) 3) 허용 색(키 + 팔레트)으로 가장 가까운 색 양자화
// 격자에 정확히 맞춰 그린 그림을 전제한다. 어긋난 그림은 편집기에서 맞춘 뒤 넣는다
import { TRANSPARENT, type PixFrame, type SheetSide } from './pix.ts';
import { DIRECTIONS, FRAME_H, FRAME_W, type Dir } from './sheet.ts';

export interface Raster {
  width: number;
  height: number;
  /** RGBA */
  data: Uint8Array;
}

export type Layout = 'strip' | 'sheet' | 'frame';

export interface Geometry {
  layout: Layout;
  scale: number;
}

/** 크기로 배치와 배율을 찾는다: 4방향 띠(96×40)·전체 시트(96×160)·한 프레임(24×40)의 정수배 */
export function detectGeometry(width: number, height: number, scale?: number): Geometry {
  const candidates: [Layout, number, number][] = [
    ['strip', FRAME_W * 4, FRAME_H],
    ['sheet', FRAME_W * 4, FRAME_H * 4],
    ['frame', FRAME_W, FRAME_H],
  ];
  for (const [layout, w, h] of candidates) {
    const s = scale ?? width / w;
    if (Number.isInteger(s) && s >= 1 && width === w * s && height === h * s) {
      return { layout, scale: s };
    }
  }
  throw new Error(
    `이미지 ${String(width)}×${String(height)}는 96×40(4방향 띠)·96×160(시트)·24×40(한 프레임)의 정수배가 아님${scale === undefined ? '' : ` (배율 ${String(scale)})`}`,
  );
}

const rgbKey = (r: number, g: number, b: number): number => (r << 16) | (g << 8) | b;

/** 배경색: 네 모서리가 모두 불투명하고 같은 색이면 그 색, 아니면 null (투명 배경) */
export function detectBackground(img: Raster): number | null {
  const at = (x: number, y: number): [number, number] => {
    const i = (y * img.width + x) * 4;
    return [
      rgbKey(img.data[i] ?? 0, img.data[i + 1] ?? 0, img.data[i + 2] ?? 0),
      img.data[i + 3] ?? 0,
    ];
  };
  const corners = [
    at(0, 0),
    at(img.width - 1, 0),
    at(0, img.height - 1),
    at(img.width - 1, img.height - 1),
  ];
  const [first] = corners;
  if (first === undefined || corners.some(([rgb, a]) => a < 128 || rgb !== first[0])) {
    return null;
  }
  return first[0];
}

/** s×s 블록마다 한 픽셀: 불투명(알파 ≥128, 배경색 아님) 픽셀이 절반 이상이면 그중 최빈색, 아니면 투명(-1) */
export function downscale(img: Raster, scale: number, background: number | null): Int32Array {
  const w = img.width / scale;
  const h = img.height / scale;
  const out = new Int32Array(w * h).fill(-1);
  for (let by = 0; by < h; by += 1) {
    for (let bx = 0; bx < w; bx += 1) {
      const counts = new Map<number, number>();
      let opaque = 0;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const i = ((by * scale + dy) * img.width + bx * scale + dx) * 4;
          if ((img.data[i + 3] ?? 0) < 128) continue;
          const rgb = rgbKey(img.data[i] ?? 0, img.data[i + 1] ?? 0, img.data[i + 2] ?? 0);
          if (rgb === background) continue;
          opaque += 1;
          counts.set(rgb, (counts.get(rgb) ?? 0) + 1);
        }
      }
      if (opaque * 2 < scale * scale) continue;
      let best = -1;
      let bestCount = 0;
      for (const [rgb, count] of counts) {
        if (count > bestCount) {
          best = rgb;
          bestCount = count;
        }
      }
      out[by * w + bx] = best;
    }
  }
  return out;
}

/** 가장 가까운 허용 색의 글자 (RGB 제곱 거리, 사람 눈 가중치 2·4·3) */
export function nearestGlyph(rgb: number, allowed: ReadonlyMap<string, string>): string {
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = rgb & 0xff;
  let best = TRANSPARENT;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [glyph, hex] of allowed) {
    const value = Number.parseInt(hex.slice(1), 16);
    const d =
      2 * (r - ((value >> 16) & 0xff)) ** 2 +
      4 * (g - ((value >> 8) & 0xff)) ** 2 +
      3 * (b - (value & 0xff)) ** 2;
    if (d < bestDistance) {
      best = glyph;
      bestDistance = d;
    }
  }
  return best;
}

export interface IngestOptions {
  sheet: SheetSide;
  /** 레이아웃이 'frame'일 때 어느 방향인지 */
  dir?: Dir;
  /** 'sheet' 레이아웃에서 걷기 프레임 1–3도 명시 블록으로 가져올지 (기본: 서기만 가져오고 파생) */
  keepFrames?: boolean;
  scale?: number;
}

/** 래스터 → .pix 블록들. allowed = 이 레이어가 쓸 수 있는 글자 → 색 (키 일부 + 외곽선 + 팔레트) */
export function ingestRaster(
  img: Raster,
  allowed: ReadonlyMap<string, string>,
  options: IngestOptions,
): PixFrame[] {
  const { layout, scale } = detectGeometry(img.width, img.height, options.scale);
  const pixels = downscale(img, scale, detectBackground(img));
  const width = img.width / scale;
  const cache = new Map<number, string>();
  const glyphAt = (x: number, y: number): string => {
    const rgb = pixels[y * width + x] ?? -1;
    if (rgb < 0) return TRANSPARENT;
    let glyph = cache.get(rgb);
    if (glyph === undefined) {
      glyph = nearestGlyph(rgb, allowed);
      cache.set(rgb, glyph);
    }
    return glyph;
  };
  const cut = (ox: number, oy: number): string[] =>
    Array.from({ length: FRAME_H }, (_, y) =>
      Array.from({ length: FRAME_W }, (_, x) => glyphAt(ox + x, oy + y)).join(''),
    );
  const frames: PixFrame[] = [];
  if (layout === 'frame') {
    if (options.dir === undefined) {
      throw new Error('한 프레임(24×40) 이미지는 --dir로 방향을 정해야 함');
    }
    frames.push({ sheet: options.sheet, dir: options.dir, frame: 0, rows: cut(0, 0) });
    return frames;
  }
  DIRECTIONS.forEach((dir, row) => {
    const oy = layout === 'sheet' ? row * FRAME_H : 0;
    const columns = layout === 'sheet' && options.keepFrames === true ? [0, 1, 2, 3] : [0];
    for (const frame of columns) {
      const ox = layout === 'strip' ? row * FRAME_W : frame * FRAME_W;
      frames.push({ sheet: options.sheet, dir, frame, rows: cut(ox, oy) });
    }
  });
  return frames;
}

/** 기존 문서의 같은 시트(front/back) 블록을 새 블록으로 바꾼다. 'frame' 레이아웃은 그 방향만 */
export function mergeFrames(
  existing: readonly PixFrame[],
  incoming: readonly PixFrame[],
): PixFrame[] {
  const replaced = (f: PixFrame): boolean =>
    incoming.some((n) => n.sheet === f.sheet && (incoming.length > 1 || n.dir === f.dir));
  return [...existing.filter((f) => !replaced(f)), ...incoming];
}
