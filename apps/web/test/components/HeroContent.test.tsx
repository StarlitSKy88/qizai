import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeroContent from '../../src/components/HeroContent';

describe('HeroContent', () => {
  it('renders heading "你的内容会爆吗？" with Instrument Serif font', () => {
    render(<HeroContent />);
    const heading = screen.getByRole('heading', { name: '你的内容会爆吗？' });
    expect(heading).toBeInTheDocument();
    expect(heading.style.fontFamily).toBe('"Instrument Serif", serif');
  });

  it('renders input placeholder "输入你的内容标题"', () => {
    render(<HeroContent />);
    expect(screen.getByPlaceholderText('输入你的内容标题')).toBeInTheDocument();
  });

  it('renders subtitle text', () => {
    render(<HeroContent />);
    expect(
      screen.getByText(/先问 1000 个 persona，再决定要不要发布/)
    ).toBeInTheDocument();
  });

  it('renders Manifesto button "了解工作原理"', () => {
    render(<HeroContent />);
    expect(screen.getByRole('button', { name: '了解工作原理' })).toBeInTheDocument();
  });

  it('form input wrapper has liquid-glass class', () => {
    render(<HeroContent />);
    const input = screen.getByPlaceholderText('输入你的内容标题');
    const form = input.closest('form');
    expect(form?.className).toContain('liquid-glass');
  });

  it('on submit, calls console.log with the title', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    render(<HeroContent />);
    const input = screen.getByPlaceholderText('输入你的内容标题');
    await userEvent.type(input, '三招教你选对洗面奶');
    const form = input.closest('form')!;
    fireEvent.submit(form);
    expect(log).toHaveBeenCalledWith('敬请期待 /predict', '三招教你选对洗面奶');
    log.mockRestore();
  });
});
