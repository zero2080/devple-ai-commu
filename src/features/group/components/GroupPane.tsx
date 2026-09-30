import { useUiStore } from '@/store/uiStore';

import { GroupHome } from './GroupHome';
import { GroupThread } from './GroupThread';

/** 그룹 탭 내용: 그룹을 고르면 스레드(대화·멤버), 아니면 목록·만들기 (PRD 5.6) */
export function GroupPane() {
  const groupId = useUiStore((s) => s.groupId);
  return groupId === null ? <GroupHome /> : <GroupThread key={groupId} groupId={groupId} />;
}
