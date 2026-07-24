import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Predict from '../../src/pages/Predict';

describe('Predict', () => {
  it('renders H1 "预测你的内容会爆吗？"', () => {
    render(
      <MemoryRouter>
        <Predict />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: '预测你的内容会爆吗？' })).toBeInTheDocument();
  });

  it('renders 3 feature cards: 几分钟拿到投票, 3 平台同测, 可解释报告', () => {
    render(
      <MemoryRouter>
        <Predict />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 3, name: '几分钟拿到投票' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: '3 平台同测' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: '可解释报告' })).toBeInTheDocument();
  });

  it('input updates title state', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Predict />
      </MemoryRouter>,
    );
    const input = screen.getByRole('textbox');
    await user.type(input, 'hello world');
    expect(input).toHaveValue('hello world');
  });

  it('form submit calls console.log with title', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      render(
        <MemoryRouter>
          <Predict />
        </MemoryRouter>,
      );
      const input = screen.getByRole('textbox');
      await user.type(input, 'test title');
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
      await user.click(button);
      expect(consoleSpy).toHaveBeenCalledWith('2026-07-24 stub v0.14: title=test title');
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('deep-link ?title=foo pre-fills input on initial mount', () => {
    render(
      <MemoryRouter initialEntries={['/predict?title=hello']}>
        <Predict />
      </MemoryRouter>,
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('hello');
  });
});
