import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from '../../src/pages/Home';

describe('Home', () => {
  it('renders VideoBackground (video element) and HeroContent (H1)', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: '你的内容会爆吗？' })).toBeInTheDocument();
    expect(document.querySelector('video')).toBeInTheDocument();
  });

  it('does NOT render NavBar (<nav>) or SocialFooter (<footer>) — those come from Layout', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(document.querySelector('nav')).not.toBeInTheDocument();
    expect(document.querySelector('footer')).not.toBeInTheDocument();
  });
});
