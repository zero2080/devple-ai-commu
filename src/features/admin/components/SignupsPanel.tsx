import { useState } from 'react';

import { rejectReasonError, type SignupStatus } from '@/domain';
import { messageFor } from '@/shared/errorMessages';

import styles from './AdminConsole.module.css';
import { approve, reject } from '../actions';
import { useAdminSignups } from '../hooks/useAdminLists';

const FILTERS: readonly { value: SignupStatus; label: string }[] = [
  { value: 'pending', label: '대기 중' },
  { value: 'approved', label: '승인됨' },
  { value: 'rejected', label: '거절됨' },
];

type Result = { kind: 'ok' | 'error'; text: string } | null;

const formatTime = (ms: number): string =>
  new Date(ms).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });

/** 가입 신청 (PRD 5.1·5.9): 상태별 목록, 대기 건 승인 / 거절(사유 필수) */
export function SignupsPanel() {
  const [status, setStatus] = useState<SignupStatus>('pending');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const list = useAdminSignups(status);
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];

  const act = async (action: () => Promise<string | null>, done: string): Promise<void> => {
    setBusy(true);
    const error = await action();
    setBusy(false);
    setResult(error === null ? { kind: 'ok', text: done } : { kind: 'error', text: error });
    if (error === null) {
      setRejecting(null);
      setReason('');
    }
  };

  return (
    <section className={styles.panel} aria-label="가입 신청">
      <div className={styles.filters} role="group" aria-label="신청 상태">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={styles.filter}
            aria-pressed={status === filter.value}
            onClick={() => {
              setStatus(filter.value);
              setRejecting(null);
              setResult(null);
            }}
          >
            {filter.label}
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
              <th scope="col">신청</th>
              <th scope="col">{status === 'pending' ? '처리' : '결과'}</th>
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
            {list.isSuccess && items.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.muted}>
                  신청이 없어요
                </td>
              </tr>
            ) : null}
            {items.map((signup) => (
              <tr key={signup.id} data-testid="signup-row">
                <td>{signup.nickname}</td>
                <td>{signup.email}</td>
                <td>{signup.phone}</td>
                <td>{formatTime(signup.createdAt)}</td>
                <td>
                  {signup.status === 'pending' ? (
                    rejecting === signup.id ? (
                      <div className={styles.actions}>
                        <input
                          className={styles.input}
                          aria-label="거절 사유"
                          placeholder="거절 사유 (1~200자, 신청자에게 보여요)"
                          value={reason}
                          onChange={(event) => {
                            setReason(event.target.value);
                          }}
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          className={[styles.button, styles.danger].join(' ')}
                          disabled={busy || rejectReasonError(reason) !== null}
                          onClick={() => {
                            void act(
                              () => reject(signup.id, reason),
                              `‘${signup.nickname}’ 신청을 거절했어요`,
                            );
                          }}
                        >
                          거절 확정
                        </button>
                        <button
                          type="button"
                          className={styles.button}
                          onClick={() => {
                            setRejecting(null);
                            setReason('');
                          }}
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={[styles.button, styles.primary].join(' ')}
                          disabled={busy}
                          onClick={() => {
                            void act(
                              () => approve(signup.id),
                              `‘${signup.nickname}’ 신청을 승인했어요. 접근 키를 메일로 보냈어요`,
                            );
                          }}
                        >
                          승인
                        </button>
                        <button
                          type="button"
                          className={styles.button}
                          disabled={busy}
                          onClick={() => {
                            setRejecting(signup.id);
                            setReason('');
                            setResult(null);
                          }}
                        >
                          거절
                        </button>
                      </div>
                    )
                  ) : signup.status === 'rejected' ? (
                    <span>거절 — {signup.rejectReason ?? '사유 없음'}</span>
                  ) : (
                    <span>승인</span>
                  )}
                </td>
              </tr>
            ))}
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
