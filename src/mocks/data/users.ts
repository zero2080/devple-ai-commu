// 고정 시드 사용자 21명 (본인 + 20). MSW와 Express mock이 공유한다.
import type { Me, User } from '../../domain/types.ts';

export const SEED_TIME = 1_727_600_000_000; // 2024-09-29T10:13:20Z

export const ME: Me = {
  id: 'u_me',
  nickname: '데모',
  avatarId: 'char_01',
  statusMessage: 'Mock 모드로 접속 중',
  role: 'admin',
  status: 'active',
  createdAt: SEED_TIME - 86_400_000 * 30,
  email: 'demo@example.com',
  phone: '010-0000-0000',
};

const FAKE_NICKNAMES = [
  '도트',
  '픽셀',
  '레트로',
  '팔비트',
  '타일',
  '스프라이트',
  '아케이드',
  '카트리지',
  '브라운관',
  '조이스틱',
  '모뎀',
  '플로피',
  '삐삐',
  '천리안',
  '하이텔',
  '나우누리',
  '펜티엄',
  '도스',
  '베이직',
  '롬팩',
];

export const FAKE_USERS: User[] = FAKE_NICKNAMES.map((nickname, i) => ({
  id: `u_${String(i + 1).padStart(2, '0')}`,
  nickname,
  avatarId: `char_${String((i % 8) + 1).padStart(2, '0')}`,
  ...(i % 3 === 0 ? { statusMessage: `${nickname}입니다` } : {}),
  role: 'member',
  status: i === 19 ? 'suspended' : 'active',
  createdAt: SEED_TIME - 86_400_000 * (20 - i),
}));

export function meAsUser(): User {
  return {
    id: ME.id,
    nickname: ME.nickname,
    avatarId: ME.avatarId,
    ...(ME.statusMessage === undefined ? {} : { statusMessage: ME.statusMessage }),
    role: ME.role,
    status: ME.status,
    createdAt: ME.createdAt,
  };
}

export const ALL_USERS: User[] = [meAsUser(), ...FAKE_USERS];

export function findUser(userId: string): User | undefined {
  return ALL_USERS.find((u) => u.id === userId);
}
