import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

import { useAuthStore } from '@/store/authStore';

interface RequireAuthProps {
  children: ReactNode;
}

/** 인증 가드. 세션 복구 중(unknown)에는 아무것도 그리지 않고, anonymous면 /login으로 */
export function RequireAuth({ children }: RequireAuthProps) {
  const status = useAuthStore((s) => s.status);
  if (status === 'unknown') {
    return null;
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace />;
  }
  return children;
}
