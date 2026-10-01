// 아바타 합성 실행과 캐시 (GRAPHICS 2.9, ARCHITECTURE 2.1): 외형마다 96×160 합성 시트를 한 번 만들고 사용자끼리 공유한다.
// 매 프레임에는 sheet.image에서 프레임만 잘라 그린다 (sprite.ts). 준비 전·실패 시 image = null → 플레이스홀더
import type { Appearance } from '@/domain';

import {
  AVATAR_SHEET_HEIGHT,
  AVATAR_SHEET_WIDTH,
  avatarKey,
  composePixels,
  planAvatar,
  swapTable,
} from './avatarCompose';
import { loadAvatarSheet } from '../assets/loader';

export interface AvatarSheet {
  readonly key: string;
  /** 합성 시트. 준비 전이거나 실패하면 null */
  image: CanvasImageSource | null;
  /** 합성이 끝나면(성공·실패 모두) 풀린다. 거부되지 않는다 */
  readonly ready: Promise<void>;
}

/** 이미지 ↔ 픽셀 변환. 브라우저 구현은 아래 browserBackend, 테스트는 가짜를 넣는다 */
export interface CompositorBackend {
  loadSheet: (path: string) => Promise<CanvasImageSource>;
  /** 96×160 RGBA */
  readPixels: (image: CanvasImageSource) => Uint8ClampedArray;
  toImage: (pixels: Uint8ClampedArray) => CanvasImageSource;
}

export class AvatarCompositor {
  private readonly backend: CompositorBackend;
  private readonly sheets = new Map<string, AvatarSheet>();
  /** 레이어 시트 원본 픽셀 (body처럼 모든 외형이 쓰는 시트를 한 번만 읽는다) */
  private readonly layerPixels = new Map<string, Promise<Uint8ClampedArray>>();
  private composeCount = 0;

  constructor(backend: CompositorBackend) {
    this.backend = backend;
  }

  /** 지금까지 실제로 합성한 횟수 (테스트·디버그용) */
  get composed(): number {
    return this.composeCount;
  }

  get size(): number {
    return this.sheets.size;
  }

  /** 외형의 합성 시트 핸들. 같은 외형이면 같은 객체를 돌려주고, 처음이면 합성을 시작한다 */
  request(appearance: Appearance): AvatarSheet {
    const key = avatarKey(appearance);
    const cached = this.sheets.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const sheet: { key: string; image: CanvasImageSource | null; ready: Promise<void> } = {
      key,
      image: null,
      ready: Promise.resolve(),
    };
    sheet.ready = this.compose(appearance).then(
      (image) => {
        sheet.image = image;
      },
      (error: unknown) => {
        console.warn('[avatar] compose failed, keeping placeholder', key, error);
      },
    );
    this.sheets.set(key, sheet);
    return sheet;
  }

  private async compose(appearance: Appearance): Promise<CanvasImageSource> {
    const plan = planAvatar(appearance);
    if (plan.warnings.length > 0) {
      console.warn('[avatar]', plan.warnings.join('; '));
    }
    const layers = await Promise.all(
      plan.layers.map(async (layer) => ({
        pixels: await this.pixelsOf(layer.sheet),
        table: swapTable(layer.ramps),
      })),
    );
    this.composeCount += 1;
    return this.backend.toImage(composePixels(layers));
  }

  private pixelsOf(path: string): Promise<Uint8ClampedArray> {
    const cached = this.layerPixels.get(path);
    if (cached !== undefined) {
      return cached;
    }
    const promise = this.backend.loadSheet(path).then(
      (image) => this.backend.readPixels(image),
      (error: unknown) => {
        this.layerPixels.delete(path);
        throw error;
      },
    );
    this.layerPixels.set(path, promise);
    return promise;
  }
}

function context2d(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx === null) {
    throw new Error('2d context unavailable');
  }
  return ctx;
}

/** 브라우저 구현: 오프스크린 캔버스에 그려 픽셀을 읽고, 합성 결과를 캔버스에 쓴다 */
export function browserBackend(): CompositorBackend {
  return {
    loadSheet: loadAvatarSheet,
    readPixels: (image) => {
      const ctx = context2d(AVATAR_SHEET_WIDTH, AVATAR_SHEET_HEIGHT);
      ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, AVATAR_SHEET_WIDTH, AVATAR_SHEET_HEIGHT).data;
    },
    toImage: (pixels) => {
      const ctx = context2d(AVATAR_SHEET_WIDTH, AVATAR_SHEET_HEIGHT);
      const data = ctx.createImageData(AVATAR_SHEET_WIDTH, AVATAR_SHEET_HEIGHT);
      data.data.set(pixels);
      ctx.putImageData(data, 0, 0);
      return ctx.canvas;
    },
  };
}

let shared: AvatarCompositor | null = null;

/** 앱 전체가 공유하는 합성기 (월드·프로필 카드·옷장 미리보기). 처음 부를 때 만든다 */
export function sharedAvatarCompositor(): AvatarCompositor {
  shared ??= new AvatarCompositor(browserBackend());
  return shared;
}
