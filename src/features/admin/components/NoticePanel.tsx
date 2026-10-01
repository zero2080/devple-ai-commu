import { useState } from 'react';

import { composeState, nfcLength } from '@/domain';
import { useAuthStore } from '@/store/authStore';

import styles from './AdminConsole.module.css';
import { sendNotice } from '../actions';

type Result = { kind: 'ok' | 'error'; text: string } | null;

/** 전체 공지 (PRD 5.9): 메시지와 같은 규칙(DOMAIN 5.1). 보내면 접속자 전원에게 상단 배너 (system.notice) */
export function NoticePanel() {
  const maxLength = useAuthStore((s) => s.config?.maxMessageLength ?? 200);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const state = composeState(content, maxLength);

  return (
    <section className={styles.panel} aria-label="공지">
      <form
        className={styles.panel}
        onSubmit={(event) => {
          event.preventDefault();
          if (state !== 'ok' || busy) {
            return;
          }
          setBusy(true);
          void sendNotice(content).then((error) => {
            setBusy(false);
            setResult(
              error === null
                ? { kind: 'ok', text: '공지를 보냈어요. 접속 중인 모두에게 배너로 보여요' }
                : { kind: 'error', text: error },
            );
            if (error === null) {
              setContent('');
            }
          });
        }}
      >
        <label htmlFor="notice-content" className={styles.muted}>
          공지 내용 (텍스트만, 링크는 버튼으로 바뀌지 않아요)
        </label>
        <textarea
          id="notice-content"
          className={styles.textarea}
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
          }}
        />
        <div className={styles.actions}>
          <span
            className={state === 'too_long' || state === 'invalid' ? styles.error : styles.muted}
          >
            {state === 'invalid'
              ? '보낼 수 없는 문자가 있어요'
              : `${String(nfcLength(content))}/${String(maxLength)}`}
          </span>
          <button
            type="submit"
            className={[styles.button, styles.primary].join(' ')}
            disabled={state !== 'ok' || busy}
          >
            공지 보내기
          </button>
        </div>
      </form>
      {result !== null ? (
        <p className={result.kind === 'ok' ? styles.ok : styles.error} role="status">
          {result.text}
        </p>
      ) : null}
    </section>
  );
}
