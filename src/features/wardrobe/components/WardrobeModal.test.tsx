import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Appearance, AvatarOptions, Me } from '@/domain';
import { signIn } from '@/features/chat/testing';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { TEST_APPEARANCE } from '@/test/fixtures';
import { ApiError } from '@/transport/http';

import { WardrobeModal } from './WardrobeModal';

const api = vi.hoisted(() => ({
  updateMe: vi.fn<(body: { appearance?: Appearance }) => Promise<Me>>(),
}));
vi.mock('@/transport/api/me', () => ({ updateMe: api.updateMe }));

const OPTIONS: AvatarOptions = {
  itemIds: [
    'hair_bob',
    'hair_ponytail',
    'hat_cap',
    'top_tshirt',
    'top_hoodie',
    'bottom_jeans',
    'shoes_sneakers',
    'hand_mic',
  ],
  skinRampIds: ['skin_1', 'skin_2'],
  hairRampIds: ['hair_black', 'hair_pink'],
  itemRampIds: ['item_red', 'item_green', 'item_navy'],
};

function me(): Me {
  const current = useAuthStore.getState().me;
  if (current === null) throw new Error('signed out');
  return current;
}

beforeEach(() => {
  api.updateMe.mockReset();
  useUiStore.getState().resetUi();
  signIn();
  const { config } = useAuthStore.getState();
  if (config === null) throw new Error('no config');
  useAuthStore.getState().setMe(me(), { ...config, avatarOptions: OPTIONS });
  useUiStore.getState().openWardrobe();
});

const group = (name: string) => screen.getByRole('group', { name });

describe('WardrobeModal (ROADMAP 12a)', () => {
  it('닫혀 있으면 그리지 않는다', () => {
    useUiStore.getState().closeWardrobe();
    const { container } = render(<WardrobeModal />);
    expect(container).toBeEmptyDOMElement();
  });

  it('피부색·머리색과 슬롯 7개, 선택 슬롯에만 "없음", 현재 외형이 골라져 있다', () => {
    render(<WardrobeModal />);
    expect(screen.getByRole('dialog', { name: '옷장' })).toHaveFocus();
    expect(within(group('피부색')).getAllByRole('radio')).toHaveLength(2);
    expect(within(group('피부색')).getByRole('radio', { name: '피부 1' })).toBeChecked();
    expect(within(group('머리색')).getByRole('radio', { name: '검정' })).toBeChecked();
    for (const slot of ['머리', '모자', '얼굴', '손']) {
      expect(within(group(slot)).getByRole('radio', { name: '없음' })).toBeInTheDocument();
    }
    for (const slot of ['상의', '하의', '신발']) {
      expect(within(group(slot)).queryByRole('radio', { name: '없음' })).toBeNull();
    }
    expect(within(group('얼굴')).getAllByRole('radio')).toHaveLength(1); // 서버 목록에 얼굴 아이템 없음
    expect(within(group('머리')).getByRole('radio', { name: '단발' })).toBeChecked();
    expect(within(group('모자')).getByRole('radio', { name: '없음' })).toBeChecked();
    // 상의 tshirt(primary만): 고른 빨강, 신발 sneakers: 주색·보조색은 기본색
    expect(within(group('상의 주색')).getByRole('radio', { name: '빨강' })).toBeChecked();
    expect(screen.queryByRole('group', { name: '상의 보조색' })).toBeNull();
    expect(group('신발 보조색')).toBeInTheDocument();
  });

  it('아이템·채널 색을 바꿔 저장하면 전체 외형을 보내고 닫는다', async () => {
    const user = userEvent.setup();
    render(<WardrobeModal />);
    await user.click(within(group('상의')).getByRole('radio', { name: '후드' }));
    await user.click(within(group('상의 주색')).getByRole('radio', { name: '초록' }));
    await user.click(within(group('상의 보조색')).getByRole('radio', { name: '남색' }));
    await user.click(within(group('모자')).getByRole('radio', { name: '야구모자' }));
    await user.click(within(group('피부색')).getByRole('radio', { name: '피부 2' }));
    const expected: Appearance = {
      ...TEST_APPEARANCE,
      skin: 'skin_2',
      hat: { itemId: 'hat_cap' },
      top: { itemId: 'top_hoodie', primary: 'item_green', secondary: 'item_navy' },
    };
    api.updateMe.mockResolvedValue({ ...me(), appearance: expected });
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(api.updateMe).toHaveBeenCalledWith({ appearance: expected });
    expect(useUiStore.getState().wardrobeOpen).toBe(false);
    expect(useAuthStore.getState().me?.appearance).toEqual(expected);
  });

  it('선택 슬롯은 "없음"으로 뺄 수 있다', async () => {
    const user = userEvent.setup();
    render(<WardrobeModal />);
    await user.click(within(group('머리')).getByRole('radio', { name: '없음' }));
    api.updateMe.mockResolvedValue(me());
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(api.updateMe).toHaveBeenCalledWith({ appearance: { ...TEST_APPEARANCE, hair: null } });
  });

  it('서버 필드 오류는 해당 선택지 옆에 보여주고 모달을 연 채로 둔다', async () => {
    const user = userEvent.setup();
    render(<WardrobeModal />);
    api.updateMe.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', 'x', {
        fields: { 'appearance.shoes': 'unknown', 'appearance.top.primary': 'unknown' },
      }),
    );
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('고칠 곳을 확인해 주세요.');
    expect(group('신발')).toHaveTextContent('지금은 고를 수 없는 항목이에요.');
    expect(group('상의 주색')).toHaveTextContent('지금은 고를 수 없는 항목이에요.');
    expect(useUiStore.getState().wardrobeOpen).toBe(true);
    // 다시 고르면 오류 표시를 지운다
    await user.click(within(group('피부색')).getByRole('radio', { name: '피부 2' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('취소·Esc로 저장 없이 닫는다', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<WardrobeModal />);
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(useUiStore.getState().wardrobeOpen).toBe(false);
    unmount();
    useUiStore.getState().openWardrobe();
    render(<WardrobeModal />);
    await user.keyboard('{Escape}');
    expect(useUiStore.getState().wardrobeOpen).toBe(false);
    expect(api.updateMe).not.toHaveBeenCalled();
  });
});
