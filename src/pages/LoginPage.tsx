import { Navigate, useNavigate } from 'react-router';

import { LoginForm } from '@/features/auth';
import { messageForCode } from '@/shared/errorMessages';
import { useAuthStore } from '@/store/authStore';

import styles from './LoginPage.module.css';

export function LoginPage() {
  const status = useAuthStore((s) => s.status);
  const notice = useAuthStore((s) => s.notice);
  const navigate = useNavigate();
  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }
  return (
    <main className={styles.page}>
      {notice === 'suspended' ? (
        <p className={styles.notice} role="alert">
          {messageForCode('USER_SUSPENDED')}
        </p>
      ) : null}
      <LoginForm
        onSuccess={() => {
          void navigate('/', { replace: true });
        }}
      />
    </main>
  );
}
