import { createBrowserRouter } from 'react-router';

import { LoginPage, WorldPage } from '@/pages';

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
]);
