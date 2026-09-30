import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app';
import { endSession, restoreSession } from '@/features/auth';
import { exposeDebugHooks } from '@/shared/debug';
import { authTokenProvider } from '@/store/authStore';
import { configureHttp } from '@/transport/http';

import './index.css';

async function bootstrap(): Promise<void> {
  if (import.meta.env.VITE_MOCK === 'true') {
    const { startMockWorker } = await import('@/mocks/browser');
    await startMockWorker();
  }
  configureHttp({
    tokens: authTokenProvider,
    onSuspended: () => {
      endSession('suspended');
    },
  });
  exposeDebugHooks();
  await restoreSession();

  const container = document.getElementById('root');
  if (container === null) {
    throw new Error('#root element not found');
  }
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
