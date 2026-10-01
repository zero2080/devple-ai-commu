import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorldFrame } from '@/game/world/worldGame';

import { NicknameLayer } from './NicknameLayer';
import { WorldProvider } from './WorldProvider';
import { useWorldContext } from '../worldContext';

interface Visible {
  userId: string;
  nickname: string;
  x: number;
  y: number;
}

function frameOf(visible: Visible[], zoom = 2): WorldFrame {
  return {
    camera: { originX: 0, originY: 0, zoom },
    viewportWidthPx: 800,
    viewportHeightPx: 600,
    nowMs: 0,
    anchorOf: () => false,
    forEachVisible: (visit) => {
      for (const v of visible) visit(v.userId, v.nickname, v.x, v.y);
    },
  };
}

function setup() {
  let emit: (frame: WorldFrame) => void = () => undefined;
  function Capture() {
    const { emitFrame } = useWorldContext();
    useEffect(() => {
      emit = emitFrame;
    }, [emitFrame]);
    return null;
  }
  render(
    <WorldProvider>
      <Capture />
      <NicknameLayer />
    </WorldProvider>,
  );
  return (visible: Visible[], zoom = 2) => {
    act(() => {
      emit(frameOf(visible, zoom));
    });
  };
}

const spans = () => [...screen.getByTestId('nickname-layer').children] as HTMLElement[];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('NicknameLayer (GRAPHICS 5.3)', () => {
  it('화면 안 캐릭터마다 노드를 만들고, 블록 하단이 앵커에 오게 transform을 쓴다 (줄 높이 12 × 줌)', () => {
    const emit = setup();
    emit([
      { userId: 'b', nickname: '비', x: 100, y: 200 },
      { userId: 'a', nickname: '에이', x: 300, y: 260 },
    ]);
    const [b, a] = spans();
    expect(b).toHaveTextContent('비');
    expect(b?.style.transform).toBe('translate(100px, 176px)'); // jsdom 폭 0, 200 − 12×2
    expect(a?.style.transform).toBe('translate(300px, 236px)');
    // 그리기 순서(y 오름차순) = 겹침 순서
    expect([b?.style.zIndex, a?.style.zIndex]).toEqual(['0', '1']);
  });

  it('가운데 정렬도 줌의 배수로 맞춘다 (서브픽셀 금지)', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(50);
    const emit = setup();
    emit([{ userId: 'a', nickname: 'abcdef', x: 100, y: 200 }], 2);
    // 폭 50 CSS px = 25 월드 px → 반 = 12.5 → 13 월드 px → 26 CSS px
    expect(spans()[0]?.style.transform).toBe('translate(74px, 176px)');
    emit([{ userId: 'a', nickname: 'abcdef', x: 150, y: 300 }], 3);
    // 폭 50/3 → 반 8.33 → 8 월드 px → 24 CSS px, 줄 높이 36
    expect(spans()[0]?.style.transform).toBe('translate(126px, 264px)');
  });

  it('화면에서 사라진 캐릭터의 노드는 지우고, 닉네임이 바뀌면 글자만 바꾼다', () => {
    const emit = setup();
    emit([
      { userId: 'a', nickname: '에이', x: 0, y: 100 },
      { userId: 'b', nickname: '비', x: 50, y: 100 },
    ]);
    const a = spans()[0];
    emit([{ userId: 'a', nickname: '새이름', x: 10, y: 100 }]);
    expect(spans()).toHaveLength(1);
    expect(spans()[0]).toBe(a); // 같은 노드를 재사용
    expect(a).toHaveTextContent('새이름');
  });

  it('닉네임은 plain text (HTML을 해석하지 않는다)', () => {
    const emit = setup();
    emit([{ userId: 'a', nickname: '<b>굵게</b>', x: 0, y: 100 }]);
    expect(spans()[0]?.textContent).toBe('<b>굵게</b>');
    expect(spans()[0]?.querySelector('b')).toBeNull();
  });
});
