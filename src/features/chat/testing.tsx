// 채팅 컴포넌트 테스트 도우미: WorldProvider 안에서 프레임 발행·캔버스 등록을 손으로 한다
import { useEffect, type ReactNode } from 'react';

import type { AuthSession } from '@/domain';
import { useWorldContext, WorldProvider } from '@/features/world';
import type { WorldFrame } from '@/game/world/worldGame';
import { useAuthStore } from '@/store/authStore';
import { TEST_APPEARANCE, TEST_AVATAR_OPTIONS } from '@/test/fixtures';

export interface WorldHarness {
  emit: (frame: WorldFrame) => void;
}

function Capture({ onReady }: { onReady: (emit: (frame: WorldFrame) => void) => void }) {
  const { emitFrame, registerCanvas } = useWorldContext();
  useEffect(() => {
    onReady(emitFrame);
  }, [onReady, emitFrame]);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'test-canvas');
    document.body.append(canvas);
    registerCanvas(canvas);
    return () => {
      registerCanvas(null);
      canvas.remove();
    };
  }, [registerCanvas]);
  return null;
}

export function withWorld(
  children: ReactNode,
  harness: WorldHarness = { emit: () => undefined },
): ReactNode {
  return (
    <WorldProvider>
      <Capture
        onReady={(emit) => {
          harness.emit = emit;
        }}
      />
      {children}
    </WorldProvider>
  );
}

export const TEST_SESSION: AuthSession = {
  accessToken: 'tok',
  expiresIn: 900,
  me: {
    id: 'u_me',
    nickname: '데모',
    appearance: TEST_APPEARANCE,
    role: 'member',
    status: 'active',
    createdAt: 1,
    email: 'a@b.c',
    phone: '010',
  },
  config: {
    proximityRadius: 5,
    positionBatchMs: 200,
    serverTickMs: 200,
    maxMessageLength: 10,
    defaultMapId: 'main',
    maxGroupMembers: 10,
    avatarOptions: TEST_AVATAR_OPTIONS,
  },
};

export function signIn(): void {
  useAuthStore.getState().setSession(TEST_SESSION);
}

/** anchorOf가 userId → 좌표를 돌려주는 가짜 프레임 */
export function fakeFrame(anchors: Record<string, { x: number; y: number }>, zoom = 2): WorldFrame {
  return {
    camera: { originX: 0, originY: 0, zoom },
    viewportWidthPx: 800,
    viewportHeightPx: 600,
    nowMs: 0,
    anchorOf: (userId, out) => {
      const a = anchors[userId];
      if (a === undefined) {
        return false;
      }
      out.x = a.x;
      out.y = a.y;
      return true;
    },
  };
}
