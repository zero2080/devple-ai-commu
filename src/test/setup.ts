// Vitest 공통 셋업. vite.config.ts test.setupFiles에서 로드된다.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
