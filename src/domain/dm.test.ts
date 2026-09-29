import { describe, expect, it } from 'vitest';

import { peerIdOf } from './dm';

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
