import { useState, type SubmitEvent } from 'react';

import { messageFor } from '@/shared/errorMessages';

import styles from './LoginForm.module.css';
import { useLogin } from '../hooks/useLogin';

interface LoginFormProps {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [accessKey, setAccessKey] = useState('');
  const login = useLogin();

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const key = accessKey.trim();
    if (key === '') {
      return;
    }
    login.mutate(key, { onSuccess });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} aria-labelledby="login-title">
      <h1 id="login-title" className={styles.title}>
        접근 키로 입장
      </h1>
      <p className={styles.hint}>승인 메일로 받은 접근 키를 입력해 주세요.</p>
      <label htmlFor="access-key" className="sr-only">
        접근 키
      </label>
      <input
        id="access-key"
        className={styles.input}
        value={accessKey}
        onChange={(event) => {
          setAccessKey(event.target.value);
        }}
        placeholder="XXXX-XXXX-XXXX"
        autoComplete="off"
        autoFocus
        spellCheck={false}
      />
      <button type="submit" className={styles.button} disabled={login.isPending}>
        {login.isPending ? '확인 중…' : '입장'}
      </button>
      {login.isError ? (
        <p className={styles.error} role="alert">
          {messageFor(login.error)}
        </p>
      ) : null}
    </form>
  );
}
