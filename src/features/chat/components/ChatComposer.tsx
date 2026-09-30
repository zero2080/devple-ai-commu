import { useRef, useState, type KeyboardEvent, type SubmitEvent } from 'react';

import { codePointLength, composeState } from '@/domain';
import { useWorldContext } from '@/features/world';
import { useAuthStore } from '@/store/authStore';

import styles from './ChatComposer.module.css';
import { sendPublic } from '../actions';
import { useEnterToFocus } from '../hooks/useEnterToFocus';

const COUNTER_ID = 'public-chat-counter';

/** 근접 대화 입력 (PRD 5.3·5.4). Enter 전송(IME 조합 중 제외), Esc → 캔버스 */
export function ChatComposer() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const composing = useRef(false);
  const [draft, setDraft] = useState('');
  const maxLength = useAuthStore((s) => s.config?.maxMessageLength ?? 0);
  const radius = useAuthStore((s) => s.config?.proximityRadius ?? 0);
  const { focusCanvas } = useWorldContext();
  useEnterToFocus(inputRef);

  const state = composeState(draft, maxLength);
  const count = codePointLength(draft);

  const submit = (): void => {
    if (composing.current || state !== 'ok') {
      return;
    }
    void sendPublic(draft);
    setDraft('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      inputRef.current?.blur();
      focusCanvas();
      return;
    }
    if (event.key === 'Enter' && (event.nativeEvent.isComposing || composing.current)) {
      event.preventDefault(); // 한글 조합 확정용 Enter는 전송하지 않는다
    }
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    submit();
  };

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      <label htmlFor="public-chat-input" className="sr-only">
        근접 대화 입력
      </label>
      <input
        id="public-chat-input"
        ref={inputRef}
        className={styles.input}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
        }}
        placeholder={`Enter로 입력 · 반경 ${String(radius)}타일에 전달`}
        autoComplete="off"
        spellCheck={false}
        aria-describedby={COUNTER_ID}
        aria-invalid={state === 'too_long'}
      />
      <span id={COUNTER_ID} className={state === 'too_long' ? styles.counterOver : styles.counter}>
        {count}/{maxLength}
      </span>
      <button type="submit" className={styles.send} disabled={state !== 'ok'}>
        보내기
      </button>
    </form>
  );
}
