import { createBrowserRouter } from 'react-router';

import { AdminPage, LoginPage, WorldPage } from '@/pages';

import { RequireAuth } from './RequireAuth';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
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
