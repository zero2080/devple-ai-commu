import { useParams } from 'react-router';

import { SignupStatus } from '@/features/signup';

import styles from './SignupPage.module.css';

/** /signup/:requestId — 로그인 불필요 (신청 번호는 URL에만 둔다) */
export function SignupStatusPage() {
  const { requestId = '' } = useParams();
  return (
    <main className={styles.page}>
      <SignupStatus key={requestId} requestId={requestId} />
    </main>
  );
}
