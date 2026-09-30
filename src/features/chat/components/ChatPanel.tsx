import type { ReactNode } from 'react';

import { useUiStore, type ChatTab } from '@/store/uiStore';

import { ChatComposer } from './ChatComposer';
import styles from './ChatPanel.module.css';
import { PublicLog } from './PublicLog';

interface ChatPanelProps {
  /** DM·그룹 탭 내용 (features/dm·group). 채팅 기능이 그 기능들을 import하지 않도록 페이지가 넣어 준다 */
  dmPane: ReactNode;
  dmUnread: number;
  groupPane: ReactNode;
  groupUnread: number;
}

interface TabSpec {
  id: ChatTab;
  label: string;
  unread: number;
}

/** 하단 채팅 패널: 탭 근접 / DM / 그룹 (PRD 5.4·5.5·5.6). 캔버스 아래 분할 배치로 보장 영역을 가리지 않는다 (ARCHITECTURE 2.5) */
export function ChatPanel({ dmPane, dmUnread, groupPane, groupUnread }: ChatPanelProps) {
  const tab = useUiStore((s) => s.chatTab);
  const tabs: TabSpec[] = [
    { id: 'public', label: '근접', unread: 0 },
    { id: 'dm', label: 'DM', unread: dmUnread },
    { id: 'group', label: '그룹', unread: groupUnread },
  ];
  return (
    <section className={styles.panel} aria-label="채팅" data-testid="chat-panel">
      <div className={styles.tabs} role="tablist" aria-label="채팅 종류">
        {tabs.map((spec) => (
          <button
            key={spec.id}
            type="button"
            role="tab"
            id={`chat-tab-${spec.id}`}
            aria-selected={tab === spec.id}
            aria-controls={`chat-panel-${spec.id}`}
            className={styles.tab}
            onClick={() => {
              useUiStore.getState().setChatTab(spec.id);
            }}
          >
            {spec.label}
            {spec.unread > 0 ? (
              <span
                className={styles.badge}
                aria-label={`안 읽음 ${String(spec.unread)}`}
                data-testid={`${spec.id}-unread`}
              >
                {spec.unread}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <div
        className={styles.tabpanel}
        role="tabpanel"
        id={`chat-panel-${tab}`}
        aria-labelledby={`chat-tab-${tab}`}
      >
        {tab === 'public' ? (
          <>
            <PublicLog />
            <ChatComposer />
          </>
        ) : tab === 'dm' ? (
          dmPane
        ) : (
          groupPane
        )}
      </div>
    </section>
  );
}
