import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SocialFooter from '../../src/components/SocialFooter';

describe('SocialFooter', () => {
  it('renders 3 social icon buttons with proper aria-labels', () => {
    render(<SocialFooter />);
    expect(screen.getByRole('button', { name: '小红书' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '抖音' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B站' })).toBeInTheDocument();
  });

  it('all 3 buttons have liquid-glass class', () => {
    render(<SocialFooter />);
    const xhs = screen.getByRole('button', { name: '小红书' });
    const dy = screen.getByRole('button', { name: '抖音' });
    const bili = screen.getByRole('button', { name: 'B站' });
    expect(xhs.className).toContain('liquid-glass');
    expect(dy.className).toContain('liquid-glass');
    expect(bili.className).toContain('liquid-glass');
  });

  it('wrapper has bottom padding pb-12', () => {
    const { container } = render(<SocialFooter />);
    const wrap = container.firstChild as HTMLElement;
    expect(wrap.className).toContain('pb-12');
  });

  it('renders 3 <img> tags with correct social SVG paths (prefix match)', () => {
    const { container } = render(<SocialFooter />);
    const imgs = Array.from(container.querySelectorAll('img'));
    expect(imgs).toHaveLength(3);
    // jsdom normalizes relative paths; use toContain, not toBe (spec §六.1 Test 4)
    expect(imgs[0]?.getAttribute('src')).toContain('/xiaohongshu.svg');
    expect(imgs[1]?.getAttribute('src')).toContain('/tiktok.svg');
    expect(imgs[2]?.getAttribute('src')).toContain('/bilibili.svg');
  });

  it('on <img> error, falls back to lucide Globe (svg.lucide-globe)', () => {
    const { container } = render(<SocialFooter />);
    // Initial render: 0 Globe icons (we start with <img>)
    expect(container.querySelectorAll('svg.lucide-globe')).toHaveLength(0);
    // Trigger error on each <img>
    const imgs = container.querySelectorAll('img');
    imgs.forEach((img) => fireEvent.error(img));
    // After errors: 3 Globe icons appear
    expect(container.querySelectorAll('svg.lucide-globe')).toHaveLength(3);
  });

  it('aria-labels preserved after fallback (button container unchanged)', () => {
    const { container } = render(<SocialFooter />);
    const imgs = container.querySelectorAll('img');
    imgs.forEach((img) => fireEvent.error(img));
    // aria-labels still resolvable via accessible name (spec §六.1 Test 6)
    expect(screen.getByRole('button', { name: '小红书' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '抖音' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B站' })).toBeInTheDocument();
  });
});
