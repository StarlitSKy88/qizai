import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Hero from '../../src/components/Hero';

describe('Hero', () => {
  it('renders all 4 child components', () => {
    render(<Hero />);
    // NavBar
    expect(screen.getByText('qizai')).toBeInTheDocument();
    // HeroContent
    expect(screen.getByRole('heading', { name: '你的内容会爆吗？' })).toBeInTheDocument();
    // SocialFooter
    expect(screen.getByRole('button', { name: '小红书' })).toBeInTheDocument();
    // VideoBackground
    expect(document.querySelector('video')).toBeInTheDocument();
  });

  it('top-level wrapper has min-h-screen bg-black overflow-hidden', () => {
    const { container } = render(<Hero />);
    const wrap = container.firstChild as HTMLElement;
    expect(wrap.className).toContain('min-h-screen');
    expect(wrap.className).toContain('bg-black');
    expect(wrap.className).toContain('overflow-hidden');
  });
});
