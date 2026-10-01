import { createBrowserRouter } from 'react-router';

import { AdminPage, LoginPage, SignupPage, SignupStatusPage, WorldPage } from '@/pages';

import { RequireAuth } from './RequireAuth';

/** 운영 빌드는 '/commu/' 아래에서 돈다 (DEPLOYMENT 3.1, vite.config.ts base). 개발은 '/' */
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export const router = createBrowserRouter(
  [
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
  ],
  { basename },
);
