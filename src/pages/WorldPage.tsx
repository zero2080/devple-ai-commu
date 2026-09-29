import { useEffect } from 'react';

import { ConnectionBadge, connectSse, disconnectSse, WorldCanvas } from '@/features/world';
import { useAuthStore } from '@/store/authStore';

import styles from './WorldPage.module.css';

export function WorldPage() {
  const mapId = useAuthStore((s) => s.config?.defaultMapId ?? 'main');

  useEffect(() => {
    connectSse();
    return () => {
      disconnectSse();
    };
  }, []);

  return (
    <main className={styles.page}>
      <WorldCanvas mapId={mapId} />
      <ConnectionBadge />
    </main>
  );
}
