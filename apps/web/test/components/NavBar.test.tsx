import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';

import NavBar from '../../src/components/NavBar';

// Probe component that exposes the current pathname so we can assert
// <Link>-driven navigation without mocking useNavigate.
const LocationProbe = () => {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
};

const renderNavBar = () =>
  render(
    <MemoryRouter>
      <NavBar />
      <LocationProbe />
    </MemoryRouter>,
  );

describe('NavBar', () => {
  // 3 verbatim preserved from v0.13.A
  it('renders qizai brand text', () => {
    renderNavBar();
    expect(screen.getByText('qizai')).toBeInTheDocument();
  });

  it('renders 3 Chinese nav links (功能 / 定价 / 关于)', () => {
    renderNavBar();
    expect(screen.getByText('功能')).toBeInTheDocument();
    expect(screen.getByText('定价')).toBeInTheDocument();
    expect(screen.getByText('关于')).toBeInTheDocument();
  });

  it('renders 登录 button with liquid-glass class', () => {
    renderNavBar();
    const loginBtn = screen.getByRole('button', { name: '登录' });
    expect(loginBtn).toBeInTheDocument();
    expect(loginBtn.className).toContain('liquid-glass');
  });

  // 2 MODIFIED — was <button>, now <Link>
  it('renders 开始预测 as <a> link to /predict (was <button>)', () => {
    renderNavBar();
    const link = screen.getByRole('link', { name: '开始预测' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/predict');
  });

  it('clicking 开始预测 navigates to /predict', async () => {
    const user = userEvent.setup();
    renderNavBar();
    await user.click(screen.getByRole('link', { name: '开始预测' }));
    expect(screen.getByTestId('location').textContent).toBe('/predict');
  });

  // 3 NEW
  it('renders 功能 / 定价 / 关于 as <a> links with correct hrefs', () => {
    renderNavBar();
    expect(screen.getByRole('link', { name: '功能' })).toHaveAttribute('href', '/predict');
    expect(screen.getByRole('link', { name: '定价' })).toHaveAttribute('href', '/pricing');
    expect(screen.getByRole('link', { name: '关于' })).toHaveAttribute('href', '/about');
  });

  it('clicking 功能 navigates to /predict', async () => {
    const user = userEvent.setup();
    renderNavBar();
    await user.click(screen.getByRole('link', { name: '功能' }));
    expect(screen.getByTestId('location').textContent).toBe('/predict');
  });

  it('clicking 定价 navigates to /pricing', async () => {
    const user = userEvent.setup();
    renderNavBar();
    await user.click(screen.getByRole('link', { name: '定价' }));
    expect(screen.getByTestId('location').textContent).toBe('/pricing');
  });
});
