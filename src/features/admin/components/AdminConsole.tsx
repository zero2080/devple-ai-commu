import { useState } from 'react';

import styles from './AdminConsole.module.css';
import { NoticePanel } from './NoticePanel';
import { SignupsPanel } from './SignupsPanel';
import { UsersPanel } from './UsersPanel';

type Tab = 'signups' | 'users' | 'notice';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'signups', label: '가입 신청' },
  { id: 'users', label: '회원' },
  { id: 'notice', label: '공지' },
];

/** 운영자 콘솔 (PRD 5.9): 가입 신청 · 회원 · 공지 */
export function AdminConsole() {
  const [tab, setTab] = useState<Tab>('signups');
  return (
    <div className={styles.console}>
      <div className={styles.tabs} role="tablist" aria-label="콘솔 메뉴">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`admin-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`admin-panel-${item.id}`}
            className={styles.tab}
            onClick={() => {
              setTab(item.id);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`}>
        {tab === 'signups' ? <SignupsPanel /> : tab === 'users' ? <UsersPanel /> : <NoticePanel />}
      </div>
    </div>
  );
}
