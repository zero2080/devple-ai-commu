// 그룹 컴포넌트 테스트 데이터
import type {
  Group,
  GroupListItem,
  GroupMemberWithUser,
  GroupMessage,
  User,
  UserProfile,
} from '@/domain';
import { TEST_APPEARANCE } from '@/test/fixtures';

export const user = (id: string, nickname: string): User => ({
  id,
  nickname,
  appearance: TEST_APPEARANCE,
  role: 'member',
  status: 'active',
  createdAt: 1,
});

export const profile = (id: string, nickname: string): UserProfile => ({
  user: user(id, nickname),
  online: true,
});

export const group = (id: string, extra: Partial<Group> = {}): Group => ({
  id,
  name: `그룹-${id}`,
  ownerId: 'u_me',
  memberCount: 3,
  createdAt: 1,
  ...extra,
});

export const listItem = (id: string, extra: Partial<GroupListItem> = {}): GroupListItem => ({
  ...group(id),
  unreadCount: 0,
  ...extra,
});

export const groupMessage = (
  id: string,
  senderId: string,
  createdAt: number,
  groupId = 'g1',
): GroupMessage => ({
  id,
  kind: 'group',
  groupId,
  senderId,
  content: `본문-${id}`,
  links: [],
  createdAt,
});

export const member = (
  userId: string,
  nickname: string,
  role: 'owner' | 'member' = 'member',
  groupId = 'g1',
): GroupMemberWithUser => ({
  groupId,
  userId,
  role,
  joinedAt: role === 'owner' ? 1 : 2,
  user: user(userId, nickname),
});
