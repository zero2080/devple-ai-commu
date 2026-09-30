// API_CONTRACT 2.7 그룹
import { z } from 'zod';

import type { Group, GroupDetail, GroupListItem, GroupMember, GroupMessage } from '@/domain';

import { request } from '../http';
import {
  groupDetailSchema,
  groupListItemSchema,
  groupMemberSchema,
  groupMessageSchema,
  groupSchema,
  paginated,
} from '../schemas';
import type { CursorQuery, Page } from './dm';
import { ENDPOINTS } from './endpoints';

const groupsResponseSchema = z.object({ items: z.array(groupListItemSchema) });
const groupMessagesPage = paginated(groupMessageSchema);

/** GET /groups → 내가 속한 그룹 (페이지네이션 없음) */
export function fetchGroups(): Promise<{ items: GroupListItem[] }> {
  return request({ ...ENDPOINTS.groups }, groupsResponseSchema);
}

/** POST /groups { name } → 201 Group (생성자 = owner) */
export function createGroup(name: string): Promise<Group> {
  return request({ ...ENDPOINTS.createGroup, body: { name } }, groupSchema);
}

/** GET /groups/{groupId} → 그룹 상세 + 멤버 */
export function fetchGroupDetail(groupId: string): Promise<GroupDetail> {
  return request({ ...ENDPOINTS.groupDetail, params: { groupId } }, groupDetailSchema);
}

/** PATCH /groups/{groupId} { name } → 200 Group — owner 전용 (전 멤버에게 group.updated) */
export function renameGroup(groupId: string, name: string): Promise<Group> {
  return request({ ...ENDPOINTS.renameGroup, params: { groupId }, body: { name } }, groupSchema);
}

/** DELETE /groups/{groupId} — owner 전용 해산 */
export function dissolveGroup(groupId: string): Promise<void> {
  return request({ ...ENDPOINTS.dissolveGroup, params: { groupId } });
}

/** POST /groups/{groupId}/members { userId } → 201 GroupMember / 409 GROUP_FULL */
export function inviteGroupMember(groupId: string, userId: string): Promise<GroupMember> {
  return request(
    { ...ENDPOINTS.inviteGroupMember, params: { groupId }, body: { userId } },
    groupMemberSchema,
  );
}

/** DELETE /groups/{groupId}/members/{userId} — owner: 강퇴 / 본인: 나가기 */
export function removeGroupMember(groupId: string, userId: string): Promise<void> {
  return request({ ...ENDPOINTS.removeGroupMember, params: { groupId, userId } });
}

/** GET /groups/{groupId}/messages?cursor=&limit=50 */
export function fetchGroupMessages(
  groupId: string,
  query: CursorQuery = {},
): Promise<Page<GroupMessage>> {
  return request(
    {
      ...ENDPOINTS.groupMessages,
      params: { groupId },
      query: { cursor: query.cursor, limit: query.limit },
    },
    groupMessagesPage,
  );
}

/** POST /groups/{groupId}/messages { content } → 201 GroupMessage */
export function sendGroupMessage(groupId: string, content: string): Promise<GroupMessage> {
  return request(
    { ...ENDPOINTS.sendGroupMessage, params: { groupId }, body: { content } },
    groupMessageSchema,
  );
}

/** POST /groups/{groupId}/read { lastMessageId } → 204 */
export function markGroupRead(groupId: string, lastMessageId: string): Promise<void> {
  return request({ ...ENDPOINTS.readGroup, params: { groupId }, body: { lastMessageId } });
}
