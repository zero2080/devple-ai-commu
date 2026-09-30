// 앱(Provider)과 SSE 핸들러가 함께 쓰는 단일 QueryClient (ARCHITECTURE 5장)
import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 30_000 },
    },
  });
}

export const queryClient = createQueryClient();
