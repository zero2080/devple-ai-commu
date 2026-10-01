import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/transport/http';

import { SignupForm } from './SignupForm';
import { SignupLookup } from './SignupLookup';

const api = vi.hoisted(() => ({
  signup: vi.fn<
    (body: { email: string; nickname: string; phone: string }) => Promise<{
      requestId: string;
      status: 'pending';
    }>
  >(),
}));
vi.mock('@/transport/api/auth', () => api);

function StatusProbe() {
  const { requestId } = useParams();
  return <p>상태 화면 {requestId}</p>;
}

function renderAt(element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={element} />
        <Route path="/signup/:requestId" element={<StatusProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fill(email: string, nickname: string, phone: string): Promise<void> {
  const type = async (label: string, value: string) => {
    const input = screen.getByLabelText(label);
    await userEvent.clear(input);
    if (value !== '') await userEvent.type(input, value);
  };
  await type('이메일', email);
  await type('닉네임', nickname);
  await type('연락처', phone);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SignupForm', () => {
  it('사전 검증에 걸리면 보내지 않고 필드마다 고칠 점을 알려 준다', async () => {
    renderAt(<SignupForm />);
    await userEvent.click(screen.getByRole('button', { name: '신청하기' }));
    expect(api.signup).not.toHaveBeenCalled();
    expect(screen.getByLabelText('이메일')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('이메일을 입력해 주세요.')).toBeInTheDocument();
    await fill('nope', '가', '12');
    await userEvent.click(screen.getByRole('button', { name: '신청하기' }));
    expect(screen.getByText(/이메일 형식을 확인해 주세요/)).toBeInTheDocument();
    expect(screen.getByText('닉네임은 2~12자로 정해 주세요.')).toBeInTheDocument();
    expect(screen.getByText(/숫자와 하이픈으로 8~20자/)).toBeInTheDocument();
    expect(api.signup).not.toHaveBeenCalled();
  });

  it('앞뒤 공백을 지워 보내고, 성공하면 상태 화면으로 간다', async () => {
    api.signup.mockResolvedValue({ requestId: 'sr_77', status: 'pending' });
    renderAt(<SignupForm />);
    await fill(' a@b.com ', '  새친구 ', '010-1234-5678');
    await userEvent.click(screen.getByRole('button', { name: '신청하기' }));
    expect(api.signup).toHaveBeenCalledWith({
      email: 'a@b.com',
      nickname: '새친구',
      phone: '010-1234-5678',
    });
    expect(await screen.findByText('상태 화면 sr_77')).toBeInTheDocument();
  });

  it('중복(409)·서버 필드 사유는 해당 칸에, 그 밖의 오류는 폼 아래에', async () => {
    api.signup
      .mockRejectedValueOnce(new ApiError(409, 'NICKNAME_TAKEN', 'dup'))
      .mockRejectedValueOnce(new ApiError(409, 'EMAIL_TAKEN', 'dup'))
      .mockRejectedValueOnce(
        new ApiError(400, 'VALIDATION_FAILED', 'bad', { fields: { nickname: 'invalid' } }),
      )
      .mockRejectedValueOnce(new ApiError(500, 'INTERNAL', 'boom'));
    renderAt(<SignupForm />);
    await fill('a@b.com', '도트', '010-1234-5678');
    const submit = screen.getByRole('button', { name: '신청하기' });
    await userEvent.click(submit);
    expect(await screen.findByText('이미 사용 중인 닉네임이에요.')).toBeInTheDocument();
    await userEvent.click(submit);
    expect(await screen.findByText('이미 가입했거나 심사 중인 이메일이에요.')).toBeInTheDocument();
    await userEvent.click(submit);
    expect(await screen.findByText(/보이지 않는 문자나 제어 문자/)).toBeInTheDocument();
    await userEvent.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent('서버 오류가 발생했어요.');
  });
});

describe('SignupLookup', () => {
  it('신청 번호로 상태 화면에 간다 (빈 값이면 버튼이 막힘)', async () => {
    renderAt(<SignupLookup />);
    const button = screen.getByRole('button', { name: '상태 보기' });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: '신청 번호' }), ' sr_04 ');
    await userEvent.click(button);
    expect(await screen.findByText('상태 화면 sr_04')).toBeInTheDocument();
  });
});
