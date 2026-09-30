// SSE `group.removed` (API_CONTRACT 3.3) → 목록·캐시에서 제거, 열려 있으면 닫고 안내 (9단계).
// left(내가 나감, 다중 탭)와 이미 지운 그룹(내가 해산·나가기한 탭)은 안내하지 않는다
import { groupThreadKey, useChatStore } from '@/store/chatStore';
import { removeGroup } from '@/store/groupCache';
import { queryClient } from '@/store/queryClient';
import { useUiStore } from '@/store/uiStore';
import { groupRemovedPayloadSchema } from '@/transport/schemas';

import { defineSseHandler } from '../registry';

export const groupRemovedHandler = defineSseHandler({
  type: 'group.removed',
  schema: groupRemovedPayloadSchema,
  handle(payload) {
    const removed = removeGroup(queryClient, payload.groupId);
    useChatStore.getState().clearPendingThread(groupThreadKey(payload.groupId));
    const notice =
      removed === undefined || payload.reason === 'left'
        ? null
        : { name: removed.name, reason: payload.reason };
    useUiStore.getState().leaveGroupView(payload.groupId, notice);
  },
});
