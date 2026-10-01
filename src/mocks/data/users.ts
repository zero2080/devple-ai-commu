// 고정 시드 사용자 21명 (본인 + 20). MSW와 Express mock이 공유한다.
import { ME_APPEARANCE, seedAppearance } from './avatar.ts';
import type { Me, SignupRequest, User } from '../../domain/types.ts';

export const SEED_TIME = 1_727_600_000_000; // 2024-09-29T10:13:20Z

export const ME: Me = {
  id: 'u_me',
  nickname: '데모',
  appearance: ME_APPEARANCE,
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
  appearance: seedAppearance(i + 1),
  ...(i % 3 === 0 ? { statusMessage: `${nickname}입니다` } : {}),
  role: 'member',
  status: i === 19 ? 'suspended' : 'active',
  createdAt: SEED_TIME - 86_400_000 * (20 - i),
}));

export function meAsUser(): User {
  return {
    id: ME.id,
    nickname: ME.nickname,
    appearance: ME.appearance,
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

/**
 * 시드 가입 신청 ID. 서버처럼 128비트 난수 Base64URL 22자 모양 (API_CONTRACT 2.3 8장) — 순서·모양에 기대지 않게
 * 고정값을 쓴다 (테스트·E2E가 참조)
 */
export const SEED_SIGNUP_IDS = {
  newbie: 'Kx3vQ8mZpL2wN7tR5yB9dA',
  visitor: 'b4HjW1sYe6Uq0cVn8gTk3w',
  dot: 'Zr7Fp2LmXa9Dq4Sv1Hc6Nw',
  spam: 'tM5yG8kQwE2rB7nJ0vXu4g',
} as const;

/** 가입 신청 시드 (운영자 콘솔 11단계): 대기 2 · 승인 1(도트) · 거절 1 */
export const SEED_SIGNUPS: SignupRequest[] = [
  {
    id: SEED_SIGNUP_IDS.newbie,
    email: 'newbie@example.com',
    nickname: '신입',
    phone: '010-1111-2222',
    status: 'pending',
    createdAt: SEED_TIME - 3_600_000,
  },
  {
    id: SEED_SIGNUP_IDS.visitor,
    email: 'visitor@example.com',
    nickname: '방문자',
    phone: '010-3333-4444',
    status: 'pending',
    createdAt: SEED_TIME - 1_800_000,
  },
  {
    id: SEED_SIGNUP_IDS.dot,
    email: 'dot@example.com',
    nickname: '도트',
    phone: '010-5555-6666',
    status: 'approved',
    createdAt: SEED_TIME - 86_400_000 * 21,
    reviewedAt: SEED_TIME - 86_400_000 * 20,
    reviewedBy: ME.id,
  },
  {
    id: SEED_SIGNUP_IDS.spam,
    email: 'spam@example.com',
    nickname: '스팸봇',
    phone: '000-0000-0000',
    status: 'rejected',
    rejectReason: '연락처 확인 불가',
    createdAt: SEED_TIME - 86_400_000 * 3,
    reviewedAt: SEED_TIME - 86_400_000 * 2,
    reviewedBy: ME.id,
  },
];
