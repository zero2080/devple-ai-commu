import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { signIn, withWorld } from '../testing';
import { ChatComposer } from './ChatComposer';

const actions = vi.hoisted(() => ({ sendPublic: vi.fn<(content: string) => Promise<void>>() }));
vi.mock('../actions', () => ({ sendPublic: actions.sendPublic }));

const input = () => screen.getByRole('textbox', { name: '근접 대화 입력' });

beforeEach(() => {
  actions.sendPublic.mockReset();
  actions.sendPublic.mockResolvedValue(undefined);
  signIn(); // maxMessageLength 10
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ChatComposer', () => {
  it('Enter로 보내고 입력창을 비우며 포커스는 입력창에 남는다', async () => {
    render(withWorld(<ChatComposer />));
    await userEvent.click(input());
    await userEvent.keyboard('안녕{Enter}');
    expect(actions.sendPublic).toHaveBeenCalledWith('안녕');
    expect(input()).toHaveValue('');
    expect(input()).toHaveFocus();
  });

  it('IME 조합 중 Enter는 보내지 않는다 (한글 마지막 글자 확정용)', () => {
    render(withWorld(<ChatComposer />));
    fireEvent.change(input(), { target: { value: '안녕' } });
    fireEvent.compositionStart(input());
    fireEvent.keyDown(input(), { key: 'Enter', isComposing: true });
    fireEvent.submit(input());
    expect(actions.sendPublic).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input());
    fireEvent.submit(input());
    expect(actions.sendPublic).toHaveBeenCalledWith('안녕');
  });

  it('공백만이거나 코드 포인트가 넘치면 보내지 않고 버튼을 막는다', async () => {
    render(withWorld(<ChatComposer />));
    await userEvent.click(input());
    await userEvent.keyboard('   {Enter}');
    expect(actions.sendPublic).not.toHaveBeenCalled();
    fireEvent.change(input(), { target: { value: '가'.repeat(11) } });
    expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled();
    expect(screen.getByText('11/10')).toBeInTheDocument();
    expect(input()).toHaveAttribute('aria-invalid', 'true');
  });

  it('Esc는 입력창을 떠나 캔버스로 포커스를 돌린다', async () => {
    render(withWorld(<ChatComposer />));
    await userEvent.click(input());
    await userEvent.keyboard('{Escape}');
    expect(input()).not.toHaveFocus();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('test-canvas');
  });

  it('포커스가 body·캔버스일 때 Enter는 입력창으로 간다. 버튼 위 Enter는 가로채지 않는다', async () => {
    render(
      withWorld(
        <>
          <button type="button">다른 버튼</button>
          <ChatComposer />
        </>,
      ),
    );
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard('{Enter}');
    expect(input()).toHaveFocus();

    screen.getByRole('button', { name: '다른 버튼' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: '다른 버튼' })).toHaveFocus();
  });

  it('보이지 않는 금지 문자가 있으면 보내지 않고 이유를 보여 준다 (DOMAIN 2.3 5.1)', () => {
    render(withWorld(<ChatComposer />));
    const rtlOverride = String.fromCodePoint(0x202e);
    fireEvent.change(input(), { target: { value: `안녕${rtlOverride}` } });
    expect(input()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('보낼 수 없는 문자가 있어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled();
    fireEvent.submit(input());
    expect(actions.sendPublic).not.toHaveBeenCalled();
    // 결합 이모지(ZWJ로 이은 가족 이모지)는 보낼 수 있다 — 길이는 NFC 코드 포인트 5
    const family = [0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467]
      .map((cp) => String.fromCodePoint(cp))
      .join('');
    fireEvent.change(input(), { target: { value: family } });
    expect(screen.getByText('5/10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '보내기' })).toBeEnabled();
  });
});
