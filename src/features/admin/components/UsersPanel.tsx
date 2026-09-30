import { useState } from 'react';

import type { Me } from '@/domain';
import { messageFor } from '@/shared/errorMessages';
import { useAuthStore } from '@/store/authStore';

import styles from './AdminConsole.module.css';
import { reissueKey, suspend, unsuspend, type ActionResult } from '../actions';
import { useAdminUsers, type UserFilter } from '../hooks/useAdminLists';

const FILTERS: readonly { value: UserFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '활성' },
  { value: 'suspended', label: '정지' },
];

type Pending = { userId: string; action: 'suspend' | 'reissue' } | null;
type Result = { kind: 'ok' | 'error'; text: string } | null;

const CONFIRM_TEXT = {
  suspend: '정지하면 접속이 바로 끊기고 다시 로그인할 수 없어요.',
  reissue: '기존 접근 키와 세션이 즉시 무효가 되고, 새 키를 메일로 보내요.',
} as const;

/** 회원 (PRD 5.9): 상태별 목록, 정지·해제, 접근 키 재발급. 되돌리기 어려운 정지·재발급은 한 번 더 확인 */
export function UsersPanel() {
  const myUserId = useAuthStore((s) => s.me?.id ?? '');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const list = useAdminUsers(filter);
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];

  const act = async (action: () => Promise<ActionResult>, done: string): Promise<void> => {
    setBusy(true);
    const error = await action();
    setBusy(false);
    setPending(null);
    setResult(error === null ? { kind: 'ok', text: done } : { kind: 'error', text: error });
  };

  const confirmButtons = (user: Me, action: 'suspend' | 'reissue') => (
    <div className={styles.actions}>
      <span className={styles.muted}>{CONFIRM_TEXT[action]}</span>
      <button
        type="button"
        className={[styles.button, styles.danger].join(' ')}
        disabled={busy}
        onClick={() => {
          void (action === 'suspend'
            ? act(() => suspend(user.id), `‘${user.nickname}’님을 정지했어요`)
            : act(
                () => reissueKey(user.id),
                `‘${user.nickname}’님의 접근 키를 재발급했어요. 새 키를 메일로 보냈어요`,
              ));
        }}
      >
        {action === 'suspend' ? '정지 확정' : '재발급 확정'}
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={() => {
          setPending(null);
        }}
      >
        취소
      </button>
    </div>
  );

  return (
    <section className={styles.panel} aria-label="회원">
      <div className={styles.filters} role="group" aria-label="회원 상태">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={styles.filter}
            aria-pressed={filter === item.value}
            onClick={() => {
              setFilter(item.value);
              setPending(null);
              setResult(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {result !== null ? (
        <p className={result.kind === 'ok' ? styles.ok : styles.error} role="status">
          {result.text}
        </p>
      ) : null}
      {list.isError ? <p className={styles.error}>{messageFor(list.error)}</p> : null}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">닉네임</th>
              <th scope="col">이메일</th>
              <th scope="col">연락처</th>
              <th scope="col">상태</th>
              <th scope="col">관리</th>
            </tr>
          </thead>
          <tbody>
            {list.isPending ? (
              <tr>
                <td colSpan={5} className={styles.muted}>
                  불러오는 중…
                </td>
              </tr>
            ) : null}
            {items.map((user) => {
              const isMe = user.id === myUserId;
              const suspended = user.status === 'suspended';
              return (
                <tr key={user.id} data-testid="admin-user-row">
                  <td>
                    {user.nickname}
                    {user.role === 'admin' ? <span className={styles.tag}>운영자</span> : null}
                    {isMe ? <span className={styles.tag}>나</span> : null}
                  </td>
                  <td>{user.email}</td>
                  <td>{user.phone}</td>
                  <td className={suspended ? styles.suspended : undefined}>
                    {suspended ? '정지' : '활성'}
                  </td>
                  <td>
                    {pending?.userId === user.id ? (
                      confirmButtons(user, pending.action)
                    ) : (
                      <div className={styles.actions}>
                        {suspended ? (
                          <button
                            type="button"
                            className={styles.button}
                            disabled={busy}
                            onClick={() => {
                              void act(
                                () => unsuspend(user.id),
                                `‘${user.nickname}’님의 정지를 풀었어요`,
                              );
                            }}
                          >
                            해제
                          </button>
                        ) : isMe ? null : (
                          <button
                            type="button"
                            className={styles.button}
                            disabled={busy}
                            onClick={() => {
                              setPending({ userId: user.id, action: 'suspend' });
                              setResult(null);
                            }}
                          >
                            정지
                          </button>
                        )}
                        <button
                          type="button"
                          className={styles.button}
                          disabled={busy}
                          onClick={() => {
                            setPending({ userId: user.id, action: 'reissue' });
                            setResult(null);
                          }}
                        >
                          키 재발급
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {list.hasNextPage ? (
        <button
          type="button"
          className={styles.button}
          disabled={list.isFetchingNextPage}
          onClick={() => {
            void list.fetchNextPage();
          }}
        >
          더 보기
        </button>
      ) : null}
    </section>
  );
}
