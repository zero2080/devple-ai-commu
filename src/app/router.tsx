import { createBrowserRouter } from 'react-router';

import { AdminPage, LoginPage, SignupPage, SignupStatusPage, WorldPage } from '@/pages';

import { RequireAuth } from './RequireAuth';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // 가입 신청·상태 (11b단계, 로그인 불필요)
  { path: '/signup', element: <SignupPage /> },
  { path: '/signup/:requestId', element: <SignupStatusPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <WorldPage />
      </RequireAuth>
    ),
  },
  {
    path: '/admin',
    element: (
      <RequireAuth role="admin">
        <AdminPage />
      </RequireAuth>
    ),
  },
]);
