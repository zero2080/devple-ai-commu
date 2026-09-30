import { useState } from 'react';

import { sortGroupsByActivity, type GroupListItem } from '@/domain';
import { useUsers } from '@/features/profile';
import { messageFor } from '@/shared/errorMessages';
import panel from '@/shared/ui/panel.module.css';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';

import styles from './GroupPane.module.css';
import { createGroupAndOpen } from '../actions';
import { useGroups } from '../hooks/useGroups';

function GroupRow({ group, myUserId }: { group: GroupListItem; myUserId: string }) {
  const last = group.lastMessage;
  const users = useUsers(last !== undefined && last.senderId !== myUserId ? [last.senderId] : []);
  const who =
    last === undefined
      ? ''
      : last.senderId === myUserId
        ? '나'
        : (users.get(last.senderId)?.nickname ?? '…');
  return (
    <li>
      <button
        type="button"
        className={panel.row}
        data-testid="group-row"
        onClick={() => {
          useUiStore.getState().openGroup(group.id);
        }}
      >
        <span className={panel.rowName}>{group.name}</span>
        <span className={panel.muted}>{group.memberCount}명</span>
        <span className={panel.rowPreview}>
          {last === undefined ? '아직 메시지가 없어요' : `${who}: ${last.content}`}
        </span>
        {group.unreadCount > 0 ? (
          <span className={panel.badge} aria-label={`안 읽음 ${String(group.unreadCount)}`}>
            {group.unreadCount}
          </span>
        ) : null}
      </button>
    </li>
  );
}

/** 그룹 목록(최근 활동순)과 만들기 (PRD 5.6). 그룹에서 빠졌으면 안내를 먼저 보여준다 */
export function GroupHome() {
  const groups = useGroups();
  const notice = useUiStore((s) => s.groupNotice);
  const myUserId = useAuthStore((s) => s.me?.id ?? '');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const items = sortGroupsByActivity(groups.data?.items ?? []);

  const create = async (): Promise<void> => {
    setBusy(true);
    const result = await createGroupAndOpen(name);
    setBusy(false);
    setError(result);
    if (result === null) {
      setName('');
    }
  };

  return (
    <div className={styles.home}>
      {notice !== null ? (
        <p className={styles.banner} role="status">
          <span>
            ‘{notice.name}’{' '}
            {notice.reason === 'kicked' ? '그룹에서 강퇴됐어요' : '그룹이 해산됐어요'}
          </span>
          <button
            type="button"
            className={panel.action}
            onClick={() => {
              useUiStore.getState().dismissGroupNotice();
            }}
          >
            닫기
          </button>
        </p>
      ) : null}
      <form
        className={styles.inlineForm}
        aria-label="그룹 만들기"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) {
            void create();
          }
        }}
      >
        <label htmlFor="group-create-name" className="sr-only">
          새 그룹 이름
        </label>
        <input
          id="group-create-name"
          className={panel.search}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="새 그룹 이름 (2~20자)"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className={panel.action} disabled={busy}>
          만들기
        </button>
      </form>
      {error !== null ? (
        <p className={panel.notice} role="alert">
          {error}
        </p>
      ) : null}
      <ul className={[panel.list, styles.grow].join(' ')} aria-label="그룹 목록">
        {groups.isPending ? <li className={panel.muted}>불러오는 중…</li> : null}
        {groups.isError ? <li className={panel.error}>{messageFor(groups.error)}</li> : null}
        {groups.isSuccess && items.length === 0 ? (
          <li className={panel.muted}>아직 그룹이 없어요. 이름을 정해 만들어 보세요</li>
        ) : null}
        {items.map((group) => (
          <GroupRow key={group.id} group={group} myUserId={myUserId} />
        ))}
      </ul>
    </div>
  );
}
