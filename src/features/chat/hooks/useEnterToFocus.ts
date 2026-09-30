import { useEffect, type RefObject } from 'react';

/**
 * 포커스가 body나 캔버스에 있을 때 Enter → 입력창 (PRD 5.3, ARCHITECTURE 3.1).
 * 버튼·링크·다른 입력의 Enter는 가로채지 않는다
 */
export function useEnterToFocus(inputRef: RefObject<HTMLInputElement | null>): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Enter' || event.isComposing || event.defaultPrevented) {
        return;
      }
      const active = document.activeElement;
      const idle =
        active === null || active === document.body || active instanceof HTMLCanvasElement;
      if (!idle) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [inputRef]);
}
