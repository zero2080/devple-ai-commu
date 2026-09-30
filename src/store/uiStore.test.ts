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

  it('resetUi는 처음 상태로 (로그아웃)', () => {
    useUiStore.getState().setChatTab('dm');
    useUiStore.getState().openProfile('x');
    useUiStore.getState().resetUi();
    expect(useUiStore.getState()).toMatchObject({
      chatTab: 'public',
      dmPeerId: null,
      profileUserId: null,
      zoom: 2,
    });
  });
});
