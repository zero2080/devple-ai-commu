import { describe, expect, it } from 'vitest';

import { dmBubbleSpeaker, peerIdOf } from './dm';
import type { Position } from './types';

const conversation = { participantIds: ['alice', 'bob'] as [string, string] };

describe('peerIdOf', () => {
  it('내가 첫 번째 참여자면 두 번째가 상대다', () => {
    expect(peerIdOf(conversation, 'alice')).toBe('bob');
  });

  it('내가 두 번째 참여자면 첫 번째가 상대다', () => {
    expect(peerIdOf(conversation, 'bob')).toBe('alice');
  });

  it('참여자가 아니면 throw한다', () => {
    expect(() => peerIdOf(conversation, 'carol')).toThrow(/not a participant/);
  });
});

describe('dmBubbleSpeaker (PRD 5.5, ARCHITECTURE 2.3)', () => {
  const pos = (x: number, y: number, mapId = 'main'): Position => ({ mapId, x, y, dir: 'down' });
  const positions = new Map<string, Position>([
    ['near', pos(13, 10)],
    ['far', pos(30, 10)],
    ['other-map', pos(10, 10, 'lobby')],
  ]);
  const me = pos(10, 10);

  it('받은 DM은 발신자가 반경 안이면 발신자 머리 위에 띄운다', () => {
    expect(dmBubbleSpeaker('near', 'near', 'me', me, positions, 5)).toBe('near');
  });

  it('받은 DM의 발신자가 반경 밖·다른 맵·접속 안 함이면 패널에만', () => {
    expect(dmBubbleSpeaker('far', 'far', 'me', me, positions, 5)).toBeNull();
    expect(dmBubbleSpeaker('other-map', 'other-map', 'me', me, positions, 5)).toBeNull();
    expect(dmBubbleSpeaker('ghost', 'ghost', 'me', me, positions, 5)).toBeNull();
  });

  it('내가 보낸 DM은 상대가 반경 안일 때만 내 머리 위에 띄운다', () => {
    expect(dmBubbleSpeaker('me', 'near', 'me', me, positions, 5)).toBe('me');
    expect(dmBubbleSpeaker('me', 'far', 'me', me, positions, 5)).toBeNull();
  });

  it('내 위치를 모르면 띄우지 않는다', () => {
    expect(dmBubbleSpeaker('near', 'near', 'me', null, positions, 5)).toBeNull();
  });
});
