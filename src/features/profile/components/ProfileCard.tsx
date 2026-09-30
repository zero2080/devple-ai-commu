import { useEffect, useRef } from 'react';

import { messageFor } from '@/shared/errorMessages';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';

import { AvatarPreview } from './AvatarPreview';
import styles from './ProfileCard.module.css';
import { useUserProfile } from '../hooks/useUserProfile';

/**
 * 캐릭터 클릭 시 프로필 카드 (PRD 5.7): 닉네임·아바타·상태 메시지·접속 여부 + "DM 보내기".
 * 사용자가 연 일시적 오버레이라 캔버스 왼쪽 위에 겹쳐 띄운다 (ARCHITECTURE 7). 닫기·Esc
 */
export function ProfileCard() {
  const userId = useUiStore((s) => s.profileUserId);
  const myUserId = useAuthStore((s) => s.me?.id ?? null);
  const profile = useUserProfile(userId);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const isMe = userId !== null && userId === myUserId;

  // 외부 시스템(키보드) 동기화: Esc로 닫는다. 입력창이 먼저 Esc를 처리했으면(defaultPrevented) 무시
  useEffect(() => {
    if (userId === null) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        useUiStore.getState().closeProfile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [userId]);

  // 카드가 뜨면 주 버튼으로 포커스 (키보드로 바로 DM 보내기·닫기)
  useEffect(() => {
    if (profile.data !== undefined) {
      primaryRef.current?.focus();
    }
  }, [profile.data]);

  if (userId === null) {
    return null;
  }

  const close = (): void => {
    useUiStore.getState().closeProfile();
  };

  const user = profile.data?.user;
  return (
    <section
      className={styles.card}
      role="dialog"
      aria-label={user === undefined ? '프로필' : `프로필: ${user.nickname}`}
      data-testid="profile-card"
    >
      {profile.isPending ? <p className={styles.muted}>불러오는 중…</p> : null}
      {profile.isError ? (
        <p className={styles.error} role="alert">
          {messageFor(profile.error)}
        </p>
      ) : null}
      {user !== undefined ? (
        <div className={styles.body}>
          <AvatarPreview appearance={user.appearance} />
          <div className={styles.info}>
            <h2 className={styles.nickname}>{user.nickname}</h2>
            <p className={profile.data?.online === true ? styles.online : styles.muted}>
              {profile.data?.online === true ? '접속 중' : '오프라인'}
            </p>
            <p className={styles.status}>{user.statusMessage ?? '상태 메시지 없음'}</p>
          </div>
        </div>
      ) : null}
      <div className={styles.actions}>
        {user !== undefined && !isMe ? (
          <button
            ref={primaryRef}
            type="button"
            className={styles.primary}
            onClick={() => {
              useUiStore.getState().openDm(user.id);
            }}
          >
            DM 보내기
          </button>
        ) : null}
        <button
          ref={isMe || user === undefined ? primaryRef : undefined}
          type="button"
          className={styles.secondary}
          onClick={close}
        >
          닫기
        </button>
      </div>
    </section>
  );
}
