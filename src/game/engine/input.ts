// 입력 (ARCHITECTURE 3.1): 방향키/WASD 누르는 동안 연속 이동, 클릭/탭 → 목적지.
// 채팅 입력창 등 텍스트 입력 중에는 키 이동을 받지 않는다 (PRD 5.3). React 무관.
import type { Direction } from '@/domain';

export interface ListenerTarget {
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
}

export interface InputControllerOptions {
  /** 키보드 이벤트 대상 (보통 window) */
  keyTarget: ListenerTarget;
  /** 포인터 이벤트 대상 (캔버스). getBoundingClientRect로 캔버스 기준 좌표를 만든다 */
  pointerTarget: ListenerTarget & { getBoundingClientRect(): { left: number; top: number } };
  /** 누르고 있는 방향이 바뀔 때. 없으면 null */
  onDirectionChange: (direction: Direction | null) => void;
  /** 캔버스 기준 CSS px */
  onPointer: (screenX: number, screenY: number) => void;
  /** 텍스트 입력 중이면 true. 기본: document.activeElement가 input/textarea/contentEditable */
  isTextEntryActive?: () => boolean;
}

const KEY_TO_DIRECTION: Readonly<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

function defaultIsTextEntryActive(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  const el = document.activeElement;
  if (el === null) {
    return false;
  }
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (el as HTMLElement).isContentEditable
  );
}

function directionOf(event: KeyboardEvent): Direction | null {
  return KEY_TO_DIRECTION[event.code] ?? KEY_TO_DIRECTION[event.key] ?? null;
}

export class InputController {
  /** false면 키 이동을 받지 않는다 (모달 등). 포인터는 별도 */
  enabled = true;
  private readonly options: InputControllerOptions;
  private readonly held: Direction[] = []; // 누른 순서. 마지막이 현재 방향
  private attached = false;
  private readonly isTextEntryActive: () => boolean;

  private readonly handleKeyDown = (event: Event): void => {
    const keyboardEvent = event as KeyboardEvent;
    const direction = directionOf(keyboardEvent);
    if (direction === null) {
      return;
    }
    if (!this.enabled || this.isTextEntryActive()) {
      return;
    }
    keyboardEvent.preventDefault();
    if (keyboardEvent.repeat) {
      return;
    }
    this.removeHeld(direction);
    this.held.push(direction);
    this.emit();
  };

  private readonly handleKeyUp = (event: Event): void => {
    const direction = directionOf(event as KeyboardEvent);
    if (direction === null) {
      return;
    }
    if (this.removeHeld(direction)) {
      this.emit();
    }
  };

  private readonly handleBlur = (): void => {
    if (this.held.length > 0) {
      this.held.length = 0;
      this.emit();
    }
  };

  private readonly handleClick = (event: Event): void => {
    const mouse = event as MouseEvent;
    const rect = this.options.pointerTarget.getBoundingClientRect();
    this.options.onPointer(mouse.clientX - rect.left, mouse.clientY - rect.top);
  };

  constructor(options: InputControllerOptions) {
    this.options = options;
    this.isTextEntryActive = options.isTextEntryActive ?? defaultIsTextEntryActive;
  }

  get heldDirection(): Direction | null {
    return this.held.at(-1) ?? null;
  }

  attach(): void {
    if (this.attached) {
      return;
    }
    this.attached = true;
    this.options.keyTarget.addEventListener('keydown', this.handleKeyDown);
    this.options.keyTarget.addEventListener('keyup', this.handleKeyUp);
    this.options.keyTarget.addEventListener('blur', this.handleBlur);
    this.options.pointerTarget.addEventListener('click', this.handleClick);
  }

  detach(): void {
    if (!this.attached) {
      return;
    }
    this.attached = false;
    this.options.keyTarget.removeEventListener('keydown', this.handleKeyDown);
    this.options.keyTarget.removeEventListener('keyup', this.handleKeyUp);
    this.options.keyTarget.removeEventListener('blur', this.handleBlur);
    this.options.pointerTarget.removeEventListener('click', this.handleClick);
    this.handleBlur();
  }

  private removeHeld(direction: Direction): boolean {
    const index = this.held.indexOf(direction);
    if (index === -1) {
      return false;
    }
    this.held.splice(index, 1);
    return true;
  }

  private emit(): void {
    this.options.onDirectionChange(this.heldDirection);
  }
}
