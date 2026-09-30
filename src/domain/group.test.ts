import { describe, expect, it } from 'vitest';

import {
  groupActivityAt,
  groupNameError,
  isGroupFull,
  isGroupOwner,
  sortGroupMembers,
  sortGroupsByActivity,
} from './group';
import type { GroupMessage } from './types';

const message = (id: string, createdAt: number): GroupMessage => ({
  id,
  kind: 'group',
  groupId: 'g',
  senderId: 'u',
  content: 'x',
  links: [],
  createdAt,
});

describe('groupNameError (API_CONTRACT 2.7: 2~20 코드 포인트)', () => {
  it('앞뒤 공백을 뺀 코드 포인트로 센다', () => {
    expect(groupNameError('가')).toBe('length');
    expect(groupNameError('  가  ')).toBe('length');
    expect(groupNameError('가나')).toBeNull();
    expect(groupNameError('가'.repeat(20))).toBeNull();
    expect(groupNameError('가'.repeat(21))).toBe('length');
    // 이모지 1개 = 코드 포인트 1개 (UTF-16 2칸)
    expect(groupNameError('🎮🎮')).toBeNull();
    expect(groupNameError('🎮')).toBe('length');
  });
});

describe('sortGroupsByActivity', () => {
  it('마지막 메시지 시각(없으면 만든 시각) 최신순, 같으면 id 순', () => {
    const items = [
      { id: 'a', createdAt: 10 },
      { id: 'b', createdAt: 5, lastMessage: message('m1', 30) },
      { id: 'd', createdAt: 20 },
      { id: 'c', createdAt: 20 },
    ];
    expect(sortGroupsByActivity(items).map((g) => g.id)).toEqual(['b', 'c', 'd', 'a']);
    expect(items.map((g) => g.id)).toEqual(['a', 'b', 'd', 'c']); // 원본은 그대로
    expect(groupActivityAt(items[1] ?? { createdAt: 0 })).toBe(30);
  });
});

describe('owner·인원', () => {
  it('owner만 관리한다', () => {
    expect(isGroupOwner({ ownerId: 'u1' }, 'u1')).toBe(true);
    expect(isGroupOwner({ ownerId: 'u1' }, 'u2')).toBe(false);
  });

  it('인원이 상한에 닿으면 가득 참', () => {
    expect(isGroupFull({ memberCount: 9 }, 10)).toBe(false);
    expect(isGroupFull({ memberCount: 10 }, 10)).toBe(true);
  });

  it('멤버는 owner 먼저, 그다음 가입순', () => {
    const members = [
      { userId: 'c', role: 'member' as const, joinedAt: 3 },
      { userId: 'b', role: 'member' as const, joinedAt: 2 },
      { userId: 'o', role: 'owner' as const, joinedAt: 9 },
      { userId: 'a', role: 'member' as const, joinedAt: 2 },
    ];
    expect(sortGroupMembers(members).map((m) => m.userId)).toEqual(['o', 'a', 'b', 'c']);
  });
});
