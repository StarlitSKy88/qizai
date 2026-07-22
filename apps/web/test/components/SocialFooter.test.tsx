import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
