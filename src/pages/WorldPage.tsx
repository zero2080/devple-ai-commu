import { ConnectionBadge, WorldCanvas } from '@/features/world';
import { useAuthStore } from '@/store/authStore';

import styles from './WorldPage.module.css';

/** SSE 연결은 세션 수명(features/auth/session.ts)이 관리한다. 페이지는 화면만 조립한다 */
export function WorldPage() {
  const mapId = useAuthStore((s) => s.config?.defaultMapId ?? 'main');
  return (
    <main className={styles.page}>
      <WorldCanvas mapId={mapId} />
      <ConnectionBadge />
    </main>
  );
}
