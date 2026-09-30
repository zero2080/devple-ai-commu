import { useDeferredValue, useState } from 'react';

import { isGroupFull, isGroupOwner, sortGroupMembers } from '@/domain';
import { useUsers, useUserSearch } from '@/features/profile';
import { messageFor } from '@/shared/errorMessages';
import panel from '@/shared/ui/panel.module.css';
import { useAuthStore } from '@/store/authStore';

import styles from './GroupPane.module.css';
import {
  dissolveGroupAction,
  inviteToGroup,
  kickFromGroup,
  leaveGroup,
  renameGroupAction,
  type ActionResult,
} from '../actions';
import { useGroupDetail } from '../hooks/useGroupDetail';

interface GroupMembersProps {
  groupId: string;
  onBack: () => void;
}

type Confirm = 'leave' | 'dissolve' | null;

/**
 * 멤버 화면 (PRD 5.6): owner·나 표시. owner는 초대(닉네임 검색)·강퇴·이름 변경·해산, 모두 나가기.
 * 되돌릴 수 없는 나가기·해산은 한 번 더 확인한다
 */
export function GroupMembers({ groupId, onBack }: GroupMembersProps) {
  const myUserId = useAuthStore((s) => s.me?.id ?? '');
  const maxMembers = useAuthStore((s) => s.config?.maxGroupMembers ?? 10);
  const detail = useGroupDetail(groupId);
  const group = detail.data?.group;
  const members = sortGroupMembers(detail.data?.members ?? []);
  const users = useUsers(
    members.map((m) => m.userId),
    detail.isSuccess,
  );
  const owner = group !== undefined && isGroupOwner(group, myUserId);
  const full = group !== undefined && isGroupFull(group, maxMembers);
  const [query, setQuery] = useState('');
  const search = useUserSearch(useDeferredValue(owner && !full ? query : ''));
  const [renameDraft, setRenameDraft] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [error, setError] = useState<string | null>(null);
  const memberIds = new Set(members.map((m) => m.userId));
  const candidates = (search.data ?? []).filter((profile) => !memberIds.has(profile.user.id));
  const name = group?.name ?? '…';

  const run = async (action: () => Promise<ActionResult>): Promise<ActionResult> => {
    const result = await action();
    setError(result);
    return result;
  };

  return (
    <section className={styles.members} aria-label={`${name} 멤버`}>
      <header className={panel.threadHeader}>
        <button type="button" className={panel.back} onClick={onBack}>
          ← 대화
        </button>
        <span className={panel.threadTitle}>{name}</span>
        {group !== undefined ? (
          <span className={panel.muted}>
            {group.memberCount}/{maxMembers}명
          </span>
        ) : null}
      </header>
      {error !== null ? (
        <p className={panel.notice} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.body}>
        {detail.isPending ? <p className={panel.muted}>불러오는 중…</p> : null}
        {detail.isError ? <p className={panel.error}>{messageFor(detail.error)}</p> : null}
        {owner ? (
          <>
            <form
              role="search"
              className={styles.inlineForm}
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              <label htmlFor="group-invite" className="sr-only">
                초대할 닉네임
              </label>
              <input
                id="group-invite"
                className={panel.search}
                value={query}
                disabled={full}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                placeholder={full ? '인원이 가득 찼어요' : '초대할 닉네임 검색'}
                autoComplete="off"
                spellCheck={false}
              />
            </form>
            {query.trim() !== '' && !full ? (
              <ul className={panel.list} aria-label="초대 검색 결과">
                {search.isPending ? <li className={panel.muted}>검색 중…</li> : null}
                {search.isSuccess && candidates.length === 0 ? (
                  <li className={panel.muted}>초대할 수 있는 사람이 없어요</li>
                ) : null}
                {candidates.map((profile) => (
                  <li key={profile.user.id} className={styles.memberRow}>
                    <span className={panel.rowName}>{profile.user.nickname}</span>
                    <button
                      type="button"
                      className={panel.action}
                      data-testid="group-invite-result"
                      onClick={() => {
                        void run(() => inviteToGroup(groupId, profile.user.id)).then((result) => {
                          if (result === null) {
                            setQuery('');
                          }
                        });
                      }}
                    >
                      초대
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
        <ul className={panel.list} aria-label="멤버 목록">
          {members.map((member) => (
            <li key={member.userId} className={styles.memberRow} data-testid="group-member">
              <span className={panel.rowName}>{users.get(member.userId)?.nickname ?? '…'}</span>
              {member.role === 'owner' ? <span className={styles.ownerTag}>방장</span> : null}
              {member.userId === myUserId ? <span className={panel.muted}>(나)</span> : null}
              {owner && member.userId !== myUserId ? (
                <button
                  type="button"
                  className={panel.action}
                  onClick={() => {
                    void run(() => kickFromGroup(groupId, member.userId));
                  }}
                >
                  강퇴
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {owner ? (
          <>
            <form
              className={styles.inlineForm}
              aria-label="그룹 이름 변경"
              onSubmit={(event) => {
                event.preventDefault();
                void run(() => renameGroupAction(groupId, renameDraft ?? name)).then((result) => {
                  if (result === null) {
                    setRenameDraft(null);
                  }
                });
              }}
            >
              <label htmlFor="group-rename" className="sr-only">
                그룹 이름
              </label>
              <input
                id="group-rename"
                className={panel.search}
                value={renameDraft ?? group.name}
                onChange={(event) => {
                  setRenameDraft(event.target.value);
                }}
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" className={panel.action}>
                이름 변경
              </button>
            </form>
          </>
        ) : null}
        <div className={styles.danger}>
          {confirm === null ? (
            <>
              <button
                type="button"
                className={panel.action}
                onClick={() => {
                  setConfirm('leave');
                }}
              >
                그룹 나가기
              </button>
              {owner ? (
                <button
                  type="button"
                  className={panel.action}
                  onClick={() => {
                    setConfirm('dissolve');
                  }}
                >
                  그룹 해산
                </button>
              ) : null}
            </>
          ) : (
            <>
              <span>
                {confirm === 'dissolve'
                  ? '해산하면 모든 멤버가 빠지고 되돌릴 수 없어요.'
                  : owner
                    ? '나가면 가장 오래된 멤버가 방장이 돼요.'
                    : '그룹에서 나갈까요?'}
              </span>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => {
                  void run(() =>
                    confirm === 'dissolve'
                      ? dissolveGroupAction(groupId)
                      : leaveGroup(groupId, myUserId),
                  );
                }}
              >
                {confirm === 'dissolve' ? '해산 확정' : '나가기 확정'}
              </button>
              <button
                type="button"
                className={panel.action}
                onClick={() => {
                  setConfirm(null);
                }}
              >
                취소
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
