import { Link } from 'react-router';

import { messageFor } from '@/shared/errorMessages';
import { ApiError } from '@/transport/http';

import styles from './Signup.module.css';
import { useSignupStatus } from '../hooks/useSignupStatus';

interface SignupStatusProps {
  requestId: string;
}

/** 신청 상태 (PRD 5.1, API_CONTRACT 2.1 GET /signup/{requestId}): 대기는 30초마다 다시 확인 */
export function SignupStatus({ requestId }: SignupStatusProps) {
  const status = useSignupStatus(requestId);
  const notFound = status.error instanceof ApiError && status.error.status === 404;

  return (
    <section className={styles.card} aria-labelledby="signup-status-title">
      <h1 id="signup-status-title" className={styles.title}>
        가입 신청 상태
      </h1>
      <p className={styles.hint}>
        신청 번호 <span className={styles.code}>{requestId}</span>
      </p>
      {status.isPending ? <p className={styles.hint}>확인하는 중…</p> : null}
      {notFound ? (
        <p className={styles.error} role="alert">
          이 번호의 신청을 찾을 수 없어요. 번호를 다시 확인해 주세요.
        </p>
      ) : status.isError ? (
        <p className={styles.error} role="alert">
          {messageFor(status.error)}
        </p>
      ) : null}
      {status.data?.status === 'pending' ? (
        <>
          <p className={[styles.status, styles.pending].join(' ')} role="status">
            운영자가 확인하고 있어요
          </p>
          <p className={styles.hint}>
            이 페이지 주소를 저장해 두면 언제든 다시 확인할 수 있어요. 승인되면 접근 키를 이메일로
            보내 드려요.
          </p>
          <button
            type="button"
            className={[styles.button, styles.secondary].join(' ')}
            disabled={status.isFetching}
            onClick={() => {
              void status.refetch();
            }}
          >
            {status.isFetching ? '확인하는 중…' : '다시 확인'}
          </button>
        </>
      ) : null}
      {status.data?.status === 'approved' ? (
        <>
          <p className={[styles.status, styles.approved].join(' ')} role="status">
            승인됐어요
          </p>
          <p className={styles.hint}>이메일로 받은 접근 키로 입장해 주세요.</p>
        </>
      ) : null}
      {status.data?.status === 'rejected' ? (
        <>
          <p className={[styles.status, styles.rejected].join(' ')} role="status">
            신청이 거절됐어요
          </p>
          <p className={styles.hint}>사유: {status.data.rejectReason ?? '없음'}</p>
        </>
      ) : null}
      <div className={styles.links}>
        <Link to="/login">로그인하러 가기</Link>
        <Link to="/signup">새로 신청하기</Link>
      </div>
    </section>
  );
}
