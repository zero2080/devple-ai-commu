import type { ReactNode } from 'react';

import { useUiStore } from '@/store/uiStore';

import { ChatComposer } from './ChatComposer';
import styles from './ChatPanel.module.css';
import { PublicLog } from './PublicLog';

interface ChatPanelProps {
  /** DM 탭 내용 (features/dm). 채팅 기능이 DM 기능을 import하지 않도록 페이지가 넣어 준다 */
  dmPane: ReactNode;
  dmUnread: number;
}

/** 하단 채팅 패널: 탭 근접 / DM (PRD 5.4·5.5). 캔버스 아래 분할 배치로 보장 영역을 가리지 않는다 (ARCHITECTURE 2.5) */
export function ChatPanel({ dmPane, dmUnread }: ChatPanelProps) {
  const tab = useUiStore((s) => s.chatTab);
  return (
    <section className={styles.panel} aria-label="채팅" data-testid="chat-panel">
      <div className={styles.tabs} role="tablist" aria-label="채팅 종류">
        <button
          type="button"
          role="tab"
          id="chat-tab-public"
          aria-selected={tab === 'public'}
          aria-controls="chat-panel-public"
          className={styles.tab}
          onClick={() => {
            useUiStore.getState().setChatTab('public');
          }}
        >
          근접
        </button>
        <button
          type="button"
          role="tab"
          id="chat-tab-dm"
          aria-selected={tab === 'dm'}
          aria-controls="chat-panel-dm"
          className={styles.tab}
          onClick={() => {
            useUiStore.getState().setChatTab('dm');
          }}
        >
          DM
          {dmUnread > 0 ? (
            <span
              className={styles.badge}
              aria-label={`안 읽음 ${String(dmUnread)}`}
              data-testid="dm-unread"
            >
              {dmUnread}
            </span>
          ) : null}
        </button>
      </div>
      {tab === 'public' ? (
        <div
          className={styles.tabpanel}
          role="tabpanel"
          id="chat-panel-public"
          aria-labelledby="chat-tab-public"
        >
          <PublicLog />
          <ChatComposer />
        </div>
      ) : (
        <div
          className={styles.tabpanel}
          role="tabpanel"
          id="chat-panel-dm"
          aria-labelledby="chat-tab-dm"
        >
          {dmPane}
        </div>
      )}
    </section>
  );
}
