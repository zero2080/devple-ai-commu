import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LinkButton } from './LinkButton';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LinkButton', () => {
  it('호스트명만 보이고 title은 전체 URL, 클릭하면 noopener·noreferrer 새 창', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<LinkButton url="https://example.com/path?q=1" />);
    const button = screen.getByRole('button', { name: '↗ example.com' });
    expect(button).toHaveAttribute('title', 'https://example.com/path?q=1');
    await userEvent.click(button);
    expect(open).toHaveBeenCalledWith(
      'https://example.com/path?q=1',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('http·https가 아니면 버튼을 만들지 않는다', () => {
    const { container } = render(<LinkButton url="javascript:alert(1)" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('말풍선 안 버튼은 키보드 순서에서 빠진다', () => {
    render(<LinkButton url="https://example.com" inBubble />);
    expect(screen.getByRole('button')).toHaveAttribute('tabindex', '-1');
  });
});
