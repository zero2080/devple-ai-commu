import { Link } from 'react-router';

import { AdminConsole } from '@/features/admin';
import { NoticeBanner } from '@/features/notice';

import styles from './AdminPage.module.css';

/** 운영자 콘솔 페이지 (PRD 5.9). SSE·자리비움은 세션 수명이라 월드를 떠나도 유지된다 */
export function AdminPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.back}>
          ← 월드로
        </Link>
        <h1 className={styles.title}>운영자 콘솔</h1>
      </header>
      <NoticeBanner placement="inline" />
      <AdminConsole />
    </main>
  );
}
