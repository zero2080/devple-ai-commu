import { useState } from 'react';
import { useNavigate } from 'react-router';

import type { SignupField } from '@/domain';

import styles from './Signup.module.css';
import { submitSignup, type FieldMessages, type SignupValues } from '../actions';

const FIELDS: readonly {
  name: SignupField;
  label: string;
  type: string;
  autoComplete: string;
  placeholder: string;
}[] = [
  {
    name: 'email',
    label: '이메일',
    type: 'email',
    autoComplete: 'email',
    placeholder: 'name@example.com',
  },
  {
    name: 'nickname',
    label: '닉네임',
    type: 'text',
    autoComplete: 'nickname',
    placeholder: '2~12자',
  },
  {
    name: 'phone',
    label: '연락처',
    type: 'tel',
    autoComplete: 'tel',
    placeholder: '010-1234-5678',
  },
];

/** 가입 신청 폼 (PRD 5.1): 이메일·닉네임·연락처 → 운영자 승인 대기. 성공하면 상태 화면으로 */
export function SignupForm() {
  const navigate = useNavigate();
  const [values, setValues] = useState<SignupValues>({ email: '', nickname: '', phone: '' });
  const [errors, setErrors] = useState<FieldMessages>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className={styles.card}
      noValidate
      aria-labelledby="signup-title"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) {
          return;
        }
        setBusy(true);
        void submitSignup(values).then((result) => {
          setBusy(false);
          if (result.ok) {
            void navigate(`/signup/${encodeURIComponent(result.requestId)}`);
            return;
          }
          setErrors(result.fields);
          setMessage(result.message);
        });
      }}
    >
      <h1 id="signup-title" className={styles.title}>
        가입 신청
      </h1>
      <p className={styles.hint}>운영자가 확인한 뒤 승인하면 접근 키를 이메일로 보내 드려요.</p>
      {FIELDS.map((field) => {
        const error = errors[field.name];
        const errorId = `signup-${field.name}-error`;
        return (
          <div key={field.name} className={styles.field}>
            <label htmlFor={`signup-${field.name}`} className={styles.label}>
              {field.label}
            </label>
            <input
              id={`signup-${field.name}`}
              className={styles.input}
              type={field.type}
              autoComplete={field.autoComplete}
              placeholder={field.placeholder}
              value={values[field.name]}
              aria-invalid={error !== undefined}
              aria-describedby={error === undefined ? undefined : errorId}
              onChange={(event) => {
                setValues({ ...values, [field.name]: event.target.value });
                if (error !== undefined) {
                  setErrors({ ...errors, [field.name]: undefined });
                }
              }}
            />
            {error !== undefined ? (
              <p id={errorId} className={styles.error}>
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
      <button type="submit" className={styles.button} disabled={busy}>
        {busy ? '보내는 중…' : '신청하기'}
      </button>
      {message !== null ? (
        <p className={styles.error} role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
