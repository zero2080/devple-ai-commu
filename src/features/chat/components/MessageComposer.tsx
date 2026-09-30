import { useRef, useState, type KeyboardEvent, type SubmitEvent } from 'react';

import { codePointLength, composeState } from '@/domain';
import { useWorldContext } from '@/features/world';
import { useAuthStore } from '@/store/authStore';

import styles from './ChatComposer.module.css';
import { useEnterToFocus } from '../hooks/useEnterToFocus';

interface MessageComposerProps {
  inputId: string;
  /** 보조기기용 입력창 이름 */
  label: string;
  placeholder: string;
  onSend: (content: string) => void;
  autoFocus?: boolean;
}

/**
 * 메시지 입력 (공개·DM 공통, PRD 5.3). Enter 전송(IME 조합 중 제외), Esc → 캔버스,
 * 코드 포인트 카운터. 포커스가 body·캔버스일 때 전역 Enter로 이 입력창에 들어온다 (탭당 하나만 마운트)
 */
export function MessageComposer({
  inputId,
  label,
  placeholder,
  onSend,
  autoFocus = false,
}: MessageComposerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const composing = useRef(false);
  const [draft, setDraft] = useState('');
  const maxLength = useAuthStore((s) => s.config?.maxMessageLength ?? 0);
  const { focusCanvas } = useWorldContext();
  useEnterToFocus(inputRef);

  const state = composeState(draft, maxLength);
  const count = codePointLength(draft);
  const counterId = `${inputId}-counter`;

  const submit = (): void => {
    if (composing.current || state !== 'ok') {
      return;
    }
    onSend(draft);
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
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input
        id={inputId}
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
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        // DM 보내기로 스레드를 열면 바로 입력하도록 (사용자 동작의 결과로만 true)
        autoFocus={autoFocus}
        aria-describedby={counterId}
        aria-invalid={state === 'too_long'}
      />
      <span id={counterId} className={state === 'too_long' ? styles.counterOver : styles.counter}>
        {count}/{maxLength}
      </span>
      <button type="submit" className={styles.send} disabled={state !== 'ok'}>
        보내기
      </button>
    </form>
  );
}
