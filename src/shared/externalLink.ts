// 외부 링크 열기 (ARCHITECTURE 2.4): 새 창, opener·referrer 차단. 확인 다이얼로그 없음(호스트명이 보이므로)
import { isOpenableLink } from '@/domain';

export function openExternalLink(url: string): void {
  if (!isOpenableLink(url)) {
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
