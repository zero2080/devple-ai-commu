// 레이어 시트 픽셀 버퍼 (GRAPHICS 2.1·2.4): 96×160 = 24×40 프레임 4열(프레임) × 4행(방향). PNG 입출력은 pngjs
import { readFileSync, writeFileSync } from 'node:fs';

import { PNG } from 'pngjs';

export const FRAME_W = 24;
export const FRAME_H = 40;
export const SHEET_W = FRAME_W * 4;
export const SHEET_H = FRAME_H * 4;
export const DIRECTIONS = ['down', 'left', 'right', 'up'] as const;
export type Dir = (typeof DIRECTIONS)[number];
export const FRAMES = [0, 1, 2, 3] as const;

export type Rgba = readonly [number, number, number, number];

export function rgba(hex: string, alpha = 255): Rgba {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff, alpha];
}

export class Sheet {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;

  constructor(width = SHEET_W, height = SHEET_H, data?: Uint8Array) {
    this.width = width;
    this.height = height;
    this.data = data ?? new Uint8Array(width * height * 4);
  }

  get(x: number, y: number): Rgba {
    const i = (y * this.width + x) * 4;
    return [this.data[i] ?? 0, this.data[i + 1] ?? 0, this.data[i + 2] ?? 0, this.data[i + 3] ?? 0];
  }

  set(x: number, y: number, color: Rgba): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return;
    }
    const i = (y * this.width + x) * 4;
    this.data.set(color, i);
  }

  /** (dir, frame) 프레임 안에 그리는 붓. 좌표는 프레임 기준이고 프레임 밖은 잘린다 */
  frame(dir: Dir, frame: number): FramePen {
    return new FramePen(this, frame * FRAME_W, DIRECTIONS.indexOf(dir) * FRAME_H);
  }

  toPng(): Buffer {
    const png = new PNG({ width: this.width, height: this.height });
    png.data = Buffer.from(this.data);
    return PNG.sync.write(png, { colorType: 6 });
  }

  save(path: string): void {
    writeFileSync(path, this.toPng());
  }

  static fromPng(buffer: Buffer): Sheet {
    const png = PNG.sync.read(buffer);
    return new Sheet(png.width, png.height, new Uint8Array(png.data));
  }

  static load(path: string): Sheet {
    return Sheet.fromPng(readFileSync(path));
  }
}

export class FramePen {
  private readonly sheet: Sheet;
  private readonly ox: number;
  private readonly oy: number;

  constructor(sheet: Sheet, ox: number, oy: number) {
    this.sheet = sheet;
    this.ox = ox;
    this.oy = oy;
  }

  px(color: Rgba, x: number, y: number): void {
    if (x < 0 || y < 0 || x >= FRAME_W || y >= FRAME_H) {
      return;
    }
    this.sheet.set(this.ox + x, this.oy + y, color);
  }

  /** x0..x1, y0..y1 포함 범위를 칠한다 */
  rect(color: Rgba, x0: number, y0: number, x1: number, y1: number): void {
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        this.px(color, x, y);
      }
    }
  }
}
