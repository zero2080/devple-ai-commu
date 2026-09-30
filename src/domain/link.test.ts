import { describe, expect, it } from 'vitest';

import { isOpenableLink, linkLabel } from './link';

describe('isOpenableLink', () => {
  it('http·https만 연다', () => {
    expect(isOpenableLink('https://example.com/a?b=1')).toBe(true);
    expect(isOpenableLink('http://example.com')).toBe(true);
  });

  it('다른 스킴과 잘못된 URL은 열지 않는다 (서버 규칙의 방어적 재확인)', () => {
    expect(isOpenableLink('javascript:alert(1)')).toBe(false);
    expect(isOpenableLink('data:text/html,hi')).toBe(false);
    expect(isOpenableLink('file:///etc/passwd')).toBe(false);
    expect(isOpenableLink('not a url')).toBe(false);
  });
});

describe('linkLabel', () => {
  it('버튼 라벨은 호스트명만이다', () => {
    expect(linkLabel('https://example.com/hello?x=1#y')).toBe('example.com');
    expect(linkLabel('https://sub.example.co.kr:8443/p')).toBe('sub.example.co.kr');
  });

  it('국제화 도메인은 punycode로 보여준다 (동형 문자 속임 방지)', () => {
    expect(linkLabel('https://한글.com/')).toBe('xn--bj0bj06e.com');
  });

  it('열 수 없는 링크는 null이다', () => {
    expect(linkLabel('javascript:alert(1)')).toBeNull();
  });
});
