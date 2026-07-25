import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '../../src/pages/Login';

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

// Mock the auth API so the Login form exercises its real submit flow
// without hitting the network. Tests assert on the mock's call args
// and on the rendered DOM state (error message, navigation).
vi.mock('../../src/api/auth', () => ({
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  getJwt: vi.fn(),
}));

import { login } from '../../src/api/auth';

const mockedLogin = vi.mocked(login);

describe('Login', () => {
  beforeEach(() => {
    mockedLogin.mockReset();
    mockNavigate.mockReset();
    localStorage.removeItem('qizai_jwt');
  });

  it('renders email + password form', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: '登录' })).toBeInTheDocument();
    expect(screen.getByLabelText('邮箱')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
  });

  it('submit calls login() with email/password + navigates to /predict on success', async () => {
    mockedLogin.mockResolvedValue({ userId: 'u-1', token: 'jwt-1' });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('邮箱'), 'a@b.com');
    await user.type(screen.getByLabelText('密码'), 'hunter2');
    await user.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(mockedLogin).toHaveBeenCalledTimes(1);
    });
    expect(mockedLogin).toHaveBeenCalledWith('a@b.com', 'hunter2');
  });

  it('submit shows error message on AUTH_FAILED', async () => {
    const authError = Object.assign(new Error('邮箱或密码错误'), { code: 'AUTH_FAILED' });
    mockedLogin.mockRejectedValue(authError);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('邮箱'), 'a@b.com');
    await user.type(screen.getByLabelText('密码'), 'wrong');
    await user.click(screen.getByRole('button', { name: '登录' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('邮箱或密码错误');
  });

  it('signup link href="/signup"', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: '注册' });
    expect(link).toHaveAttribute('href', '/signup');
  });

  it('navigates to the redirect path after login', async () => {
    mockedLogin.mockResolvedValue({ userId: 'u-1', token: 'jwt-1' });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/login?redirect=/report/xyz']}>
        <Login />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('邮箱'), 'a@b.com');
    await user.type(screen.getByLabelText('密码'), 'hunter2');
    await user.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/report/xyz');
    });
  });

  it('falls back to /predict for an external redirect after login', async () => {
    mockedLogin.mockResolvedValue({ userId: 'u-1', token: 'jwt-1' });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/login?redirect=https://evil.com']}>
        <Login />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('邮箱'), 'a@b.com');
    await user.type(screen.getByLabelText('密码'), 'hunter2');
    await user.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/predict');
    });
  });

  it('falls back to /predict for a protocol-relative redirect after login', async () => {
    mockedLogin.mockResolvedValue({ userId: 'u-1', token: 'jwt-1' });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/login?redirect=//evil.com']}>
        <Login />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('邮箱'), 'a@b.com');
    await user.type(screen.getByLabelText('密码'), 'hunter2');
    await user.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/predict');
    });
  });

  it('falls back to /predict for a backslash redirect after login', async () => {
    mockedLogin.mockResolvedValue({ userId: 'u-1', token: 'jwt-1' });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/login?redirect=/\\evil.com']}>
        <Login />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('邮箱'), 'a@b.com');
    await user.type(screen.getByLabelText('密码'), 'hunter2');
    await user.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/predict');
    });
  });

  it('falls back to /predict for a whitespace-prefixed redirect after login', async () => {
    // Defense in depth: `   /evil.com` is not a valid path, browsers
    // may normalize it; safeRedirect rejects it because it does not
    // start with `/`.
    mockedLogin.mockResolvedValue({ userId: 'u-1', token: 'jwt-1' });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/login?redirect=%20%20%20/evil.com']}>
        <Login />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('邮箱'), 'a@b.com');
    await user.type(screen.getByLabelText('密码'), 'hunter2');
    await user.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/predict');
    });
  });

  it('treats pseudo-scheme paths (e.g. /javascript:alert(1)) as in-app paths', async () => {
    // react-router@6 treats anything starting with `/` as a path, so
    // pseudo-schemes stay in-app and never reach a real URL parser.
    mockedLogin.mockResolvedValue({ userId: 'u-1', token: 'jwt-1' });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/login?redirect=/javascript:alert(1)']}>
        <Login />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('邮箱'), 'a@b.com');
    await user.type(screen.getByLabelText('密码'), 'hunter2');
    await user.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/javascript:alert(1)');
    });
  });
});