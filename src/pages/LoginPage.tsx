import { Navigate, useNavigate } from 'react-router';

import { LoginForm } from '@/features/auth';
import { useAuthStore } from '@/store/authStore';

import styles from './LoginPage.module.css';

export function LoginPage() {
  const status = useAuthStore((s) => s.status);
  const navigate = useNavigate();
  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }
  return (
    <main className={styles.page}>
      <LoginForm
        onSuccess={() => {
          void navigate('/', { replace: true });
        }}
      />
    </main>
  );
}
