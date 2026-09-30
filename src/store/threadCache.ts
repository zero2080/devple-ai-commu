// 커서 페이지 무한 쿼리 공통 (API_CONTRACT 1.1 목록 형태). DM·그룹 스레드가 함께 쓴다
import type { InfiniteData } from '@tanstack/react-query';

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

/** 스레드 무한 쿼리 데이터: 페이지는 최신순, pageParam = 커서 (이전 페이지의 가장 오래된 id) */
export type ThreadPages<T> = InfiniteData<CursorPage<T>, string | undefined>;

export function threadHas<T extends { id: string }>(data: ThreadPages<T>, id: string): boolean {
  return data.pages.some((page) => page.items.some((m) => m.id === id));
}

/** 새 메시지를 첫 페이지 앞에 넣는다. 캐시가 없거나(아직 안 연 스레드) 이미 있으면(id 중복) 그대로 */
export function prependToThread<T extends { id: string }>(
  old: ThreadPages<T> | undefined,
  message: T,
): ThreadPages<T> | undefined {
  if (old === undefined || threadHas(old, message.id)) {
    return old;
  }
  const [first, ...rest] = old.pages;
  const head: CursorPage<T> = {
    items: [message, ...(first?.items ?? [])],
    nextCursor: first?.nextCursor ?? null,
  };
  return { ...old, pages: [head, ...rest] };
}
