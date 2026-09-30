// 그룹 전송·읽음·관리 (PRD 5.6·5.8). 확정된 데이터는 Query 캐시에만, 전송 중 상태는 chatStore (ARCHITECTURE 7)
import { groupNameError } from '@/domain';
import { messageFor } from '@/shared/errorMessages';
import { groupThreadKey, useChatStore } from '@/store/chatStore';
import {
  addCreatedGroup,
  applyGroupInfo,
  markGroupReadLocal,
  removeGroup,
  upsertGroupMessage,
} from '@/store/groupCache';
import { queryClient } from '@/store/queryClient';
import { queryKeys } from '@/store/queryKeys';
import { useUiStore } from '@/store/uiStore';
import { useWorldStore } from '@/store/worldStore';
import {
  createGroup,
  dissolveGroup,
  inviteGroupMember,
  markGroupRead,
  removeGroupMember,
  renameGroup,
  sendGroupMessage,
} from '@/transport/api/groups';
import { ApiError } from '@/transport/http';

/** 실패하면 사용자 문구, 성공하면 null */
export type ActionResult = string | null;

const NAME_RULE = '그룹 이름은 2~20자로 정해 주세요.';

async function deliver(tempId: string, groupId: string, content: string): Promise<void> {
  try {
    const message = await sendGroupMessage(groupId, content);
    upsertGroupMessage(queryClient, message, useWorldStore.getState().myUserId ?? message.senderId);
    useChatStore.getState().removePendingThread(tempId);
  } catch (error) {
    useChatStore
      .getState()
      .failPendingThread(tempId, error instanceof ApiError ? error.code : 'NETWORK');
  }
}

/** pending 추가 → POST /groups/{id}/messages → 캐시 반영(에코와 중복 없음) 또는 failed. 말풍선 없음 */
export async function sendGroupMessageAction(groupId: string, content: string): Promise<void> {
  const tempId = useChatStore
    .getState()
    .addPendingThread(groupThreadKey(groupId), content, Date.now());
  await deliver(tempId, groupId, content);
}

export async function retryGroupMessage(tempId: string, groupId: string): Promise<void> {
  const pending = useChatStore.getState().pendingThread.find((p) => p.tempId === tempId);
  if (pending?.status !== 'failed' || pending.threadKey !== groupThreadKey(groupId)) {
    return;
  }
  useChatStore.getState().markSendingThread(tempId);
  await deliver(tempId, groupId, pending.content);
}

export function dismissGroupMessage(tempId: string): void {
  useChatStore.getState().dismissPendingThread(tempId);
}

/** 스레드가 보이는 동안 안 읽음이 있으면: 목록 0, 서버에 POST /groups/{id}/read */
export async function markGroupThreadRead(groupId: string, lastMessageId: string): Promise<void> {
  markGroupReadLocal(queryClient, groupId);
  try {
    await markGroupRead(groupId, lastMessageId);
  } catch {
    // 실패해도 다음 수신 때 다시 시도한다 (안 읽음은 서버 목록을 다시 받을 때 맞춰진다)
  }
}

/** 만들기 → 목록에 넣고(이벤트 없음) 그 스레드를 연다 */
export async function createGroupAndOpen(name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (groupNameError(trimmed) !== null) {
    return NAME_RULE;
  }
  try {
    const group = await createGroup(trimmed);
    addCreatedGroup(queryClient, group);
    useUiStore.getState().openGroup(group.id);
    return null;
  } catch (error) {
    return messageFor(error);
  }
}

export async function renameGroupAction(groupId: string, name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (groupNameError(trimmed) !== null) {
    return NAME_RULE;
  }
  try {
    applyGroupInfo(queryClient, await renameGroup(groupId, trimmed));
    return null;
  } catch (error) {
    return messageFor(error);
  }
}

/** 초대·강퇴: 성공하면 상세를 다시 받는다 (group.updated도 온다) */
async function changeMembers(groupId: string, run: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await run();
    void queryClient.invalidateQueries({ queryKey: queryKeys.groupDetail(groupId) });
    return null;
  } catch (error) {
    return messageFor(error);
  }
}

export function inviteToGroup(groupId: string, userId: string): Promise<ActionResult> {
  return changeMembers(groupId, () => inviteGroupMember(groupId, userId));
}

export function kickFromGroup(groupId: string, userId: string): Promise<ActionResult> {
  return changeMembers(groupId, () => removeGroupMember(groupId, userId));
}

/** 나가기·해산 성공: 목록·캐시·전송 중 항목을 지우고 스레드를 닫는다 (뒤따르는 group.removed는 안내 없이 무시됨) */
function forgetGroup(groupId: string): void {
  removeGroup(queryClient, groupId);
  useChatStore.getState().clearPendingThread(groupThreadKey(groupId));
  useUiStore.getState().leaveGroupView(groupId, null);
}

export async function leaveGroup(groupId: string, myUserId: string): Promise<ActionResult> {
  try {
    await removeGroupMember(groupId, myUserId);
    forgetGroup(groupId);
    return null;
  } catch (error) {
    return messageFor(error);
  }
}

export async function dissolveGroupAction(groupId: string): Promise<ActionResult> {
  try {
    await dissolveGroup(groupId);
    forgetGroup(groupId);
    return null;
  } catch (error) {
    return messageFor(error);
  }
}
