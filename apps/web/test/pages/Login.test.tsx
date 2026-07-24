import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '../../src/pages/Login';

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
});