import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Signup from '../../src/pages/Signup';

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the auth API so the Signup form exercises its real submit flow
// without hitting the network. Tests assert on the mock's call args
// and on the rendered DOM state (validation error, navigation).
vi.mock('../../src/api/auth', () => ({
  signup: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  getJwt: vi.fn(),
}));

import { signup } from '../../src/api/auth';

const mockedSignup = vi.mocked(signup);

describe('Signup', () => {
  beforeEach(() => {
    mockedSignup.mockReset();
    mockNavigate.mockReset();
    localStorage.removeItem('qizai_jwt');
  });

  it('renders email + password + confirm form', () => {
    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: '注册' })).toBeInTheDocument();
    expect(screen.getByLabelText('邮箱')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByLabelText('确认密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '注册' })).toBeInTheDocument();
  });

  it('submit calls signup() + navigates on success', async () => {
    mockedSignup.mockResolvedValue({ userId: 'u-2', token: 'jwt-2' });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/signup']}>
        <Signup />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('邮箱'), 'new@b.com');
    await user.type(screen.getByLabelText('密码'), 'hunter22');
    await user.type(screen.getByLabelText('确认密码'), 'hunter22');
    await user.click(screen.getByRole('button', { name: '注册' }));

    await waitFor(() => {
      expect(mockedSignup).toHaveBeenCalledTimes(1);
    });
    expect(mockedSignup).toHaveBeenCalledWith('new@b.com', 'hunter22');
  });

  it('navigates to the redirect path after signup', async () => {
    mockedSignup.mockResolvedValue({ userId: 'u-2', token: 'jwt-2' });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/signup?redirect=/report/xyz']}>
        <Signup />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('邮箱'), 'new@b.com');
    await user.type(screen.getByLabelText('密码'), 'hunter22');
    await user.type(screen.getByLabelText('确认密码'), 'hunter22');
    await user.click(screen.getByRole('button', { name: '注册' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/report/xyz');
    });
  });

  it('falls back to /predict for an external redirect after signup', async () => {
    mockedSignup.mockResolvedValue({ userId: 'u-2', token: 'jwt-2' });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/signup?redirect=https://evil.com']}>
        <Signup />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('邮箱'), 'new@b.com');
    await user.type(screen.getByLabelText('密码'), 'hunter22');
    await user.type(screen.getByLabelText('确认密码'), 'hunter22');
    await user.click(screen.getByRole('button', { name: '注册' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/predict');
    });
  });

  it('falls back to /predict for a protocol-relative redirect after signup', async () => {
    mockedSignup.mockResolvedValue({ userId: 'u-2', token: 'jwt-2' });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/signup?redirect=//evil.com']}>
        <Signup />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('邮箱'), 'new@b.com');
    await user.type(screen.getByLabelText('密码'), 'hunter22');
    await user.type(screen.getByLabelText('确认密码'), 'hunter22');
    await user.click(screen.getByRole('button', { name: '注册' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/predict');
    });
  });

  it('falls back to /predict for a backslash redirect after signup', async () => {
    mockedSignup.mockResolvedValue({ userId: 'u-2', token: 'jwt-2' });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/signup?redirect=/\\evil.com']}>
        <Signup />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('邮箱'), 'new@b.com');
    await user.type(screen.getByLabelText('密码'), 'hunter22');
    await user.type(screen.getByLabelText('确认密码'), 'hunter22');
    await user.click(screen.getByRole('button', { name: '注册' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/predict');
    });
  });

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('邮箱'), 'new@b.com');
    await user.type(screen.getByLabelText('密码'), 'hunter22');
    await user.type(screen.getByLabelText('确认密码'), 'different');
    await user.click(screen.getByRole('button', { name: '注册' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('两次输入的密码不一致');
    expect(mockedSignup).not.toHaveBeenCalled();
  });

  it('login link preserves the redirect path', () => {
    render(
      <MemoryRouter initialEntries={['/signup?redirect=/report/xyz']}>
        <Signup />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: '登录' });
    expect(link).toHaveAttribute('href', '/login?redirect=%2Freport%2Fxyz');
  });
});