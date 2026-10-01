import { useState } from 'react';
import { useNavigate } from 'react-router';

import styles from './Signup.module.css';

/** 이미 신청했다면 신청 번호로 상태 확인 (PRD 5.1 "상태 확인 페이지") */
export function SignupLookup() {
  const navigate = useNavigate();
  const [requestId, setRequestId] = useState('');
  const trimmed = requestId.trim();
  return (
    <form
      className={styles.card}
      aria-label="신청 상태 확인"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed !== '') {
          void navigate(`/signup/${encodeURIComponent(trimmed)}`);
        }
      }}
    >
      <p className={styles.hint}>이미 신청했다면 신청 번호로 상태를 볼 수 있어요.</p>
      <div className={styles.row}>
        <label htmlFor="signup-lookup" className="sr-only">
          신청 번호
        </label>
        <input
          id="signup-lookup"
          className={styles.input}
          value={requestId}
          placeholder="신청 번호"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setRequestId(event.target.value);
          }}
        />
        <button
          type="submit"
          className={[styles.button, styles.secondary].join(' ')}
          disabled={trimmed === ''}
        >
          상태 보기
        </button>
      </div>
    </form>
  );
}
