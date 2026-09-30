import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { TEST_SESSION } from '@/features/chat/testing';
import { useAuthStore } from '@/store/authStore';

import { RequireAuth } from './RequireAuth';

function renderAt(role?: 'admin') {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/login" element={<p>로그인 화면</p>} />
        <Route path="/" element={<p>월드 화면</p>} />
        <Route
          path="/admin"
          element={
            <RequireAuth {...(role === undefined ? {} : { role })}>
              <p>콘솔 화면</p>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthStore.getState().clear();
});

describe('RequireAuth', () => {
  it('세션 복구 중(unknown)에는 아무것도 그리지 않는다', () => {
    useAuthStore.setState({ status: 'unknown' });
    const { container } = renderAt('admin');
    expect(container).toBeEmptyDOMElement();
  });

  it('로그인 전이면 /login', () => {
    renderAt('admin');
    expect(screen.getByText('로그인 화면')).toBeInTheDocument();
  });

  it('role="admin"이면 운영자만 — 회원은 월드로 돌려보낸다', () => {
    useAuthStore
      .getState()
      .setSession({ ...TEST_SESSION, me: { ...TEST_SESSION.me, role: 'member' } });
    renderAt('admin');
    expect(screen.getByText('월드 화면')).toBeInTheDocument();
  });

  it('운영자는 콘솔을 본다, role이 없으면 로그인만 확인한다', () => {
    useAuthStore
      .getState()
      .setSession({ ...TEST_SESSION, me: { ...TEST_SESSION.me, role: 'admin' } });
    renderAt('admin');
    expect(screen.getByText('콘솔 화면')).toBeInTheDocument();
  });

  it('role 없이 쓰면 회원도 통과', () => {
    useAuthStore.getState().setSession(TEST_SESSION);
    renderAt();
    expect(screen.getByText('콘솔 화면')).toBeInTheDocument();
  });
});
