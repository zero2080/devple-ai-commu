import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from './uiStore';

beforeEach(() => {
  useUiStore.getState().resetUi();
});

describe('uiStore', () => {
  it('openDm은 DM 탭으로 옮기고 스레드를 열며 프로필 카드를 닫는다', () => {
    useUiStore.getState().openProfile('u_01');
    useUiStore.getState().openDm('u_01');
    expect(useUiStore.getState()).toMatchObject({
      chatTab: 'dm',
      dmPeerId: 'u_01',
      profileUserId: null,
    });
    useUiStore.getState().closeDmThread();
    expect(useUiStore.getState().dmPeerId).toBeNull();
    expect(useUiStore.getState().chatTab).toBe('dm');
  });

  it('openGroup은 그룹 탭으로 옮기고 스레드를 열며 안내·프로필을 닫는다', () => {
    const ui = useUiStore.getState();
    ui.leaveGroupView('g_x', { name: '옛 그룹', reason: 'kicked' });
    ui.openProfile('u_01');
    ui.openGroup('g_01');
    expect(useUiStore.getState()).toMatchObject({
      chatTab: 'group',
      groupId: 'g_01',
      groupNotice: null,
      profileUserId: null,
    });
    ui.closeGroupThread();
    expect(useUiStore.getState().groupId).toBeNull();
  });

  it('leaveGroupView는 그 그룹이 열려 있을 때만 닫고, 안내가 없으면(나가기) 이전 안내를 그대로 둔다', () => {
    const ui = useUiStore.getState();
    ui.openGroup('g_01');
    ui.leaveGroupView('g_02', null);
    expect(useUiStore.getState().groupId).toBe('g_01');
    ui.leaveGroupView('g_01', { name: '단골', reason: 'dissolved' });
    expect(useUiStore.getState()).toMatchObject({
      groupId: null,
      groupNotice: { name: '단골', reason: 'dissolved' },
    });
    ui.leaveGroupView('g_03', null); // 나가기(left)는 안내를 덮지 않는다
    expect(useUiStore.getState().groupNotice).toEqual({ name: '단골', reason: 'dissolved' });
    ui.dismissGroupNotice();
    expect(useUiStore.getState().groupNotice).toBeNull();
  });

  it('공지는 최신 1건만 두고 닫을 수 있다', () => {
    const ui = useUiStore.getState();
    ui.showNotice({ id: 'n1', content: '첫 공지', createdBy: 'u_me', createdAt: 1 });
    ui.showNotice({ id: 'n2', content: '둘째 공지', createdBy: 'u_me', createdAt: 2 });
    expect(useUiStore.getState().notice?.id).toBe('n2');
    ui.dismissNotice();
    expect(useUiStore.getState().notice).toBeNull();
  });

  it('resetUi는 처음 상태로 (로그아웃)', () => {
    useUiStore.getState().setChatTab('dm');
    useUiStore.getState().openProfile('x');
    useUiStore.getState().resetUi();
    expect(useUiStore.getState()).toMatchObject({
      chatTab: 'public',
      dmPeerId: null,
      groupId: null,
      groupNotice: null,
      profileUserId: null,
      notice: null,
      zoom: 2,
    });
  });
});
