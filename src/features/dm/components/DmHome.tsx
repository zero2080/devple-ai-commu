import { useDeferredValue, useState } from 'react';

import { useUserSearch } from '@/features/profile';
import { messageFor } from '@/shared/errorMessages';
import styles from '@/shared/ui/panel.module.css';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';

import { DmConversationItem } from './DmConversationItem';
import { useDmConversations } from '../hooks/useDmConversations';

/** DM 목록과 닉네임 검색 (PRD 5.5·5.7): 접속 여부와 무관하게 검색해 DM을 시작한다 */
export function DmHome() {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const myUserId = useAuthStore((s) => s.me?.id ?? '');
  const conversations = useDmConversations();
  const search = useUserSearch(deferred);
  const searching = query.trim() !== '';
  const items = conversations.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className={styles.home}>
      <form
        role="search"
        className={styles.searchForm}
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label htmlFor="dm-search" className="sr-only">
          닉네임 검색
        </label>
        <input
          id="dm-search"
          className={styles.search}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="닉네임 검색"
          autoComplete="off"
          spellCheck={false}
        />
      </form>
      {searching ? (
        <ul className={styles.list} aria-label="검색 결과">
          {search.isPending ? <li className={styles.muted}>검색 중…</li> : null}
          {search.isError ? <li className={styles.error}>{messageFor(search.error)}</li> : null}
          {search.data?.length === 0 ? <li className={styles.muted}>검색 결과가 없어요</li> : null}
          {search.data?.map((profile) => (
            <li key={profile.user.id}>
              <button
                type="button"
                className={styles.row}
                data-testid="dm-search-result"
                onClick={() => {
                  useUiStore.getState().openDm(profile.user.id);
                }}
              >
                <span className={styles.rowName}>{profile.user.nickname}</span>
                <span className={profile.online ? styles.online : styles.muted}>
                  {profile.online ? '접속 중' : '오프라인'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className={styles.list} aria-label="DM 대화 목록">
          {conversations.isPending ? <li className={styles.muted}>불러오는 중…</li> : null}
          {conversations.isError ? (
            <li className={styles.error}>{messageFor(conversations.error)}</li>
          ) : null}
          {conversations.isSuccess && items.length === 0 ? (
            <li className={styles.muted}>
              아직 대화가 없어요. 캐릭터를 누르거나 닉네임을 검색해 보세요
            </li>
          ) : null}
          {items.map((conversation) => (
            <DmConversationItem
              key={conversation.id}
              conversation={conversation}
              myUserId={myUserId}
            />
          ))}
          {conversations.hasNextPage ? (
            <li>
              <button
                type="button"
                className={styles.more}
                disabled={conversations.isFetchingNextPage}
                onClick={() => {
                  void conversations.fetchNextPage();
                }}
              >
                더 보기
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
