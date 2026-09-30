import { describe, expect, it } from 'vitest';

import { placeBubble, shouldRemoveBubble } from './bubbleLayout';

describe('placeBubble', () => {
  it('꼬리 끝이 anchor에 오도록 몸통을 꼬리 높이(3px × 줌)만큼 위에 둔다', () => {
    const p = placeBubble({ x: 400, y: 300 }, 101, 40, 2, 800, 600);
    // half = floor(101 / 2 / 2) * 2 = 50
    expect(p).toEqual({ x: 350, y: 300 - 40 - 6, tailLeft: 50, visible: true });
  });

  it('좌표는 정수이고 꼬리 위치는 줌의 배수다', () => {
    const p = placeBubble({ x: 123, y: 77 }, 55, 31, 3, 800, 600);
    expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
    expect(p.tailLeft % 3).toBe(0);
  });

  it('좌우 가장자리에서는 몸통을 캔버스 안으로 밀고 꼬리가 발화자를 따라간다', () => {
    const left = placeBubble({ x: 10, y: 300 }, 100, 40, 2, 800, 600);
    expect(left).toMatchObject({ x: 0, tailLeft: 10, visible: true });
    const right = placeBubble({ x: 796, y: 300 }, 101, 40, 2, 800, 600);
    // maxX = floor((800 - 101) / 2) * 2 = 698, 꼬리 = 796 - 698 = 98 → 폭 - 3칸(95) 안쪽으로 → 94
    expect(right).toMatchObject({ x: 698, tailLeft: 94, visible: true });
    expect(right.x + 101).toBeLessThanOrEqual(800);
  });

  it('말풍선이 캔버스보다 넓으면 왼쪽에 붙인다', () => {
    expect(placeBubble({ x: 150, y: 300 }, 400, 40, 2, 300, 600)).toMatchObject({
      x: 0,
      tailLeft: 150,
    });
  });

  it('발화자가 화면 밖이거나 말풍선이 위아래로 벗어나면 숨긴다', () => {
    expect(placeBubble({ x: -200, y: 300 }, 100, 40, 2, 800, 600).visible).toBe(false);
    expect(placeBubble({ x: 400, y: -5 }, 100, 40, 2, 800, 600).visible).toBe(false);
    expect(placeBubble({ x: 1000, y: 300 }, 100, 40, 2, 800, 600).visible).toBe(false);
    expect(placeBubble({ x: 400, y: 700 }, 100, 40, 2, 800, 600).visible).toBe(false);
  });
});

describe('shouldRemoveBubble', () => {
  it('만료가 지나야 지우고, 호버 중이면 지우지 않는다', () => {
    expect(shouldRemoveBubble(1000, 999, false)).toBe(false);
    expect(shouldRemoveBubble(1000, 1000, false)).toBe(true);
    expect(shouldRemoveBubble(1000, 5000, true)).toBe(false);
  });
});
