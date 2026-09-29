import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InputController } from './input';

function setup(isTextEntryActive?: () => boolean) {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  const onDirectionChange = vi.fn();
  const onPointer = vi.fn();
  const input = new InputController({
    keyTarget: window,
    pointerTarget: canvas,
    onDirectionChange,
    onPointer,
    ...(isTextEntryActive === undefined ? {} : { isTextEntryActive }),
  });
  input.attach();
  return { input, canvas, onDirectionChange, onPointer };
}

function key(type: 'keydown' | 'keyup', code: string, repeat = false) {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: code, repeat, cancelable: true }));
}

let cleanup: (() => void) | null = null;

beforeEach(() => {
  cleanup = null;
});

afterEach(() => {
  cleanup?.();
  document.body.innerHTML = '';
});

describe('InputController', () => {
  it('방향키·WASD를 누르는 동안 방향을 알리고, 마지막에 누른 키가 우선한다', () => {
    const { input, onDirectionChange } = setup();
    cleanup = () => {
      input.detach();
    };
    key('keydown', 'ArrowRight');
    expect(onDirectionChange).toHaveBeenLastCalledWith('right');
    key('keydown', 'KeyW');
    expect(onDirectionChange).toHaveBeenLastCalledWith('up');
    key('keydown', 'KeyW', true); // 자동 반복은 무시
    expect(onDirectionChange).toHaveBeenCalledTimes(2);
    key('keyup', 'KeyW');
    expect(onDirectionChange).toHaveBeenLastCalledWith('right');
    key('keyup', 'ArrowRight');
    expect(onDirectionChange).toHaveBeenLastCalledWith(null);
  });

  it('텍스트 입력 중에는 키 이동을 받지 않는다 (PRD 5.3)', () => {
    const { input, onDirectionChange } = setup(() => true);
    cleanup = () => {
      input.detach();
    };
    key('keydown', 'ArrowLeft');
    expect(onDirectionChange).not.toHaveBeenCalled();
  });

  it('기본 판정은 activeElement가 input이면 텍스트 입력 중이다', () => {
    const { input, onDirectionChange } = setup();
    cleanup = () => {
      input.detach();
    };
    const field = document.createElement('input');
    document.body.append(field);
    field.focus();
    key('keydown', 'ArrowLeft');
    expect(onDirectionChange).not.toHaveBeenCalled();
    field.blur();
    key('keydown', 'ArrowLeft');
    expect(onDirectionChange).toHaveBeenLastCalledWith('left');
  });

  it('창이 포커스를 잃으면 누른 키를 전부 놓는다', () => {
    const { input, onDirectionChange } = setup();
    cleanup = () => {
      input.detach();
    };
    key('keydown', 'KeyD');
    window.dispatchEvent(new Event('blur'));
    expect(onDirectionChange).toHaveBeenLastCalledWith(null);
    expect(input.heldDirection).toBeNull();
  });

  it('클릭은 캔버스 기준 좌표로 알린다', () => {
    const { input, canvas, onPointer } = setup();
    cleanup = () => {
      input.detach();
    };
    canvas.getBoundingClientRect = () => ({ left: 10, top: 20 }) as DOMRect;
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 110, clientY: 70, bubbles: true }));
    expect(onPointer).toHaveBeenCalledWith(100, 50);
  });

  it('detach 후에는 아무것도 알리지 않는다', () => {
    const { input, onDirectionChange } = setup();
    input.detach();
    key('keydown', 'ArrowUp');
    expect(onDirectionChange).not.toHaveBeenCalled();
  });
});
