import { useUiStore } from '@/store/uiStore';

import { DmHome } from './DmHome';
import { DmThread } from './DmThread';

/** DM 탭 내용: 상대를 고르면 스레드, 아니면 목록·검색 (PRD 5.5) */
export function DmPane() {
  const peerId = useUiStore((s) => s.dmPeerId);
  return peerId === null ? <DmHome /> : <DmThread key={peerId} peerId={peerId} />;
}
