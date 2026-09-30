import { useEffect, useState } from 'react';

import { ThreadView, type ThreadRow } from '@/features/chat';
import { useUsers } from '@/features/profile';
import panel from '@/shared/ui/panel.module.css';
import { useAuthStore } from '@/store/authStore';
import { groupThreadKey, useChatStore } from '@/store/chatStore';
import { useUiStore } from '@/store/uiStore';

import {
  dismissGroupMessage,
  markGroupThreadRead,
  retryGroupMessage,
  sendGroupMessageAction,
} from '../actions';
import { GroupMembers } from './GroupMembers';
import { useGroupDetail } from '../hooks/useGroupDetail';
import { useGroups } from '../hooks/useGroups';
import { useGroupThread } from '../hooks/useGroupThread';

interface GroupThreadProps {
  groupId: string;
}

/** 그룹 대화 (PRD 5.6·5.8): 멤버 전원에게 전달, 말풍선 없음. 보이는 동안 안 읽음이 있으면 읽음 처리 */
function GroupConversation({
  groupId,
  onShowMembers,
}: GroupThreadProps & { onShowMembers: () => void }) {
  const myUserId = useAuthStore((s) => s.me?.id ?? '');
  const myNickname = useAuthStore((s) => s.me?.nickname ?? '');
  const pendingAll = useChatStore((s) => s.pendingThread);
  const group = useGroups().data?.items.find((g) => g.id === groupId);
  const detail = useGroupDetail(groupId);
  const thread = useGroupThread(groupId);

  const newestFirst = thread.data?.pages.flatMap((page) => page.items) ?? [];
  // 상세가 멤버를 사용자 캐시에 넣은 뒤에 켜서, 멤버가 아닌 발신자(나간 사람)만 따로 받는다
  const users = useUsers(
    newestFirst.map((m) => m.senderId).filter((id) => id !== myUserId),
    !detail.isPending,
  );
  const threadKey = groupThreadKey(groupId);
  const pending = pendingAll.filter((p) => p.threadKey === threadKey);
  const name = group?.name ?? detail.data?.group.name ?? '…';
  const memberCount = group?.memberCount ?? detail.data?.group.memberCount;
  const unread = group?.unreadCount ?? 0;
  const newestId = newestFirst[0]?.id ?? null;

  useEffect(() => {
    if (unread > 0 && newestId !== null) {
      void markGroupThreadRead(groupId, newestId);
    }
  }, [groupId, unread, newestId]);

  const rows: ThreadRow[] = [...newestFirst].reverse().map((m) => {
    const mine = m.senderId === myUserId;
    return {
      id: m.id,
      mine,
      nickname: mine ? myNickname : (users.get(m.senderId)?.nickname ?? '…'),
      content: m.content,
      links: m.links,
    };
  });

  return (
    <ThreadView
      title={name}
      onBack={() => {
        useUiStore.getState().closeGroupThread();
      }}
      headerActions={
        <button type="button" className={panel.action} onClick={onShowMembers}>
          멤버{memberCount === undefined ? '' : ` ${String(memberCount)}명`}
        </button>
      }
      logLabel={`${name} 그룹 대화`}
      testId="group"
      rows={rows}
      pending={pending}
      myNickname={myNickname}
      onRetry={(tempId) => {
        void retryGroupMessage(tempId, groupId);
      }}
      onDismiss={dismissGroupMessage}
      loading={thread.isPending}
      hasOlder={thread.hasNextPage}
      loadingOlder={thread.isFetchingNextPage}
      onLoadOlder={() => {
        void thread.fetchNextPage();
      }}
      notice={null}
      composer={{
        inputId: 'group-input',
        label: `${name} 그룹에 메시지`,
        placeholder: `${name} · 멤버 전원에게 전달`,
        onSend: (content) => {
          void sendGroupMessageAction(groupId, content);
        },
      }}
    />
  );
}

/** 열린 그룹: 대화 ↔ 멤버 화면 */
export function GroupThread({ groupId }: GroupThreadProps) {
  const [view, setView] = useState<'conversation' | 'members'>('conversation');
  return view === 'members' ? (
    <GroupMembers
      groupId={groupId}
      onBack={() => {
        setView('conversation');
      }}
    />
  ) : (
    <GroupConversation
      groupId={groupId}
      onShowMembers={() => {
        setView('members');
      }}
    />
  );
}
