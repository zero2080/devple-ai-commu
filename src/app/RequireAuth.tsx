import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

import type { UserRole } from '@/domain';
import { useAuthStore } from '@/store/authStore';

interface RequireAuthProps {
  children: ReactNode;
  /** 필요한 역할. 'admin'이면 운영자만 (아니면 월드로) */
  role?: UserRole;
}

/** 인증 가드. 세션 복구 중(unknown)에는 아무것도 그리지 않고, anonymous면 /login, 역할이 모자라면 / */
export function RequireAuth({ children, role }: RequireAuthProps) {
  const status = useAuthStore((s) => s.status);
  const myRole = useAuthStore((s) => s.me?.role ?? null);
  if (status === 'unknown') {
    return null;
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace />;
  }
  if (role === 'admin' && myRole !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
}
