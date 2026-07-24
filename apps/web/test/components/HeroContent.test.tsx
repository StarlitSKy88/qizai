import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import HeroContent from '../../src/components/HeroContent';

beforeEach(() => {
  mockNavigate.mockClear();
});

const renderHeroContent = () =>
  render(
    <MemoryRouter>
      <HeroContent />
    </MemoryRouter>,
  );

describe('HeroContent', () => {
  it('renders heading "你的内容会爆吗？" with Instrument Serif font', () => {
    renderHeroContent();
    const heading = screen.getByRole('heading', { name: '你的内容会爆吗？' });
    expect(heading).toBeInTheDocument();
    expect(heading.style.fontFamily).toBe('"Instrument Serif", serif');
  });

  it('renders input placeholder "输入你的内容标题"', () => {
    renderHeroContent();
    expect(screen.getByPlaceholderText('输入你的内容标题')).toBeInTheDocument();
  });

  it('renders subtitle text', () => {
    renderHeroContent();
    expect(
      screen.getByText(/先问 1000 个 persona/)
    ).toBeInTheDocument();
  });

  it('renders CTA as <a> link "关于我们" to /about (was 了解工作原理 button)', () => {
    renderHeroContent();
    const link = screen.getByRole('link', { name: '关于我们' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/about');
  });

  it('form input wrapper has liquid-glass class', () => {
    renderHeroContent();
    const input = screen.getByPlaceholderText('输入你的内容标题');
    const form = input.closest('form');
    expect(form?.className).toContain('liquid-glass');
  });

  it('form submit calls useNavigate("/predict?title=...") (was console.log)', async () => {
    renderHeroContent();
    const input = screen.getByPlaceholderText('输入你的内容标题');
    await userEvent.type(input, '三招教你选对洗面奶');
    const form = input.closest('form')!;
    fireEvent.submit(form);
    expect(mockNavigate).toHaveBeenCalledWith(
      '/predict?title=' + encodeURIComponent('三招教你选对洗面奶')
    );
  });
});
