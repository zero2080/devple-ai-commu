import { describe, expect, it } from 'vitest';

import { emailError, nicknameError, nicknameKey, phoneError, validateSignup } from './signup';

describe('닉네임 (DOMAIN 8장 2.1)', () => {
  it('앞뒤 공백을 뺀 코드 포인트 2~12, 제어·비가시 문자는 invalid', () => {
    expect(nicknameError(' 가 ')).toBe('length');
    expect(nicknameError(' 가나 ')).toBeNull();
    expect(nicknameError('가'.repeat(12))).toBeNull();
    expect(nicknameError('가'.repeat(13))).toBe('length');
    expect(nicknameError('🎮🎮')).toBeNull();
    expect(nicknameError('도\u200B트')).toBe('invalid');
    expect(nicknameError('도\u0007트')).toBe('invalid');
    expect(nicknameError('도\n트')).toBe('invalid');
    expect(nicknameError('도\u007F트')).toBe('invalid');
  });

  it('유일성 비교 키: 앞뒤 공백 제거 + NFC + 대소문자 무시', () => {
    expect(nicknameKey(' Dot ')).toBe(nicknameKey('dot'));
    expect(nicknameKey('가')).toBe(nicknameKey('가'));
    expect(nicknameKey('도트')).not.toBe(nicknameKey('도트2'));
  });
});

describe('이메일·연락처 (API_CONTRACT 2.1)', () => {
  it('이메일 형식', () => {
    expect(emailError('a@b.com')).toBeNull();
    expect(emailError(' a@b.co.kr ')).toBeNull();
    for (const bad of ['a@b', 'ab.com', 'a@@b.com', 'a b@c.com', '@b.com', 'a@.com']) {
      expect(emailError(bad), bad).toBe('format');
    }
  });

  it('연락처는 숫자·하이픈 8~20자', () => {
    expect(phoneError('010-1234-5678')).toBeNull();
    expect(phoneError('01012345678')).toBeNull();
    expect(phoneError('0101234')).toBe('format');
    expect(phoneError('010 1234 5678')).toBe('format');
    expect(phoneError('+82-10-1234-5678')).toBe('format');
    expect(phoneError('1'.repeat(21))).toBe('format');
  });
});

describe('validateSignup', () => {
  it('비어 있으면 required, 나머지는 필드별 사유를 모두 모은다', () => {
    expect(validateSignup({ email: '', nickname: '  ', phone: '' })).toEqual({
      email: 'required',
      nickname: 'required',
      phone: 'required',
    });
    expect(validateSignup({ email: 'x', nickname: '가', phone: '12' })).toEqual({
      email: 'format',
      nickname: 'length',
      phone: 'format',
    });
    expect(validateSignup({ email: 'a@b.com', nickname: '도트', phone: '010-1111-2222' })).toEqual(
      {},
    );
  });
});
