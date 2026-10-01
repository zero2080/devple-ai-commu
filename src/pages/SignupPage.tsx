import { Link, Navigate } from 'react-router';

import { SignupForm, SignupLookup } from '@/features/signup';
import { useAuthStore } from '@/store/authStore';

import styles from './SignupPage.module.css';

/** /signup — 로그인 불필요. 이미 로그인했으면 월드로 */
export function SignupPage() {
  const status = useAuthStore((s) => s.status);
  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }
  return (
    <main className={styles.page}>
      <SignupForm />
      <SignupLookup />
      <Link to="/login" className={styles.link}>
        접근 키가 있다면 로그인
      </Link>
    </main>
  );
}
