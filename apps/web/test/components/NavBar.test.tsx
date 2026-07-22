import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NavBar from '../../src/components/NavBar';

describe('NavBar', () => {
  it('renders qizai brand with Globe icon', () => {
    render(<NavBar />);
    expect(screen.getByText('qizai')).toBeInTheDocument();
  });

  it('renders three Chinese nav links (功能 / 定价 / 关于)', () => {
    render(<NavBar />);
    expect(screen.getByText('功能')).toBeInTheDocument();
    expect(screen.getByText('定价')).toBeInTheDocument();
    expect(screen.getByText('关于')).toBeInTheDocument();
  });

  it('renders 开始预测 button and 登录 button', () => {
    render(<NavBar />);
    expect(screen.getByRole('button', { name: '开始预测' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
  });

  it('登录 button has liquid-glass class', () => {
    render(<NavBar />);
    const loginBtn = screen.getByRole('button', { name: '登录' });
    expect(loginBtn.className).toContain('liquid-glass');
  });

  it('calls console.log on 开始预测 click', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    render(<NavBar />);
    await userEvent.click(screen.getByRole('button', { name: '开始预测' }));
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
