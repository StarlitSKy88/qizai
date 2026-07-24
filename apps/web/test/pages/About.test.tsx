import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import About from '../../src/pages/About';

describe('About', () => {
  it('renders H1 "关于 qizai"', () => {
    render(
      <MemoryRouter>
        <About />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: '关于 qizai' })).toBeInTheDocument();
  });

  it('renders 3 H2 sections: 愿景, 团队, 联系我们', () => {
    render(
      <MemoryRouter>
        <About />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 2, name: '愿景' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '团队' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '联系我们' })).toBeInTheDocument();
  });

  it('renders mailto link to hi@qizai.app', () => {
    render(
      <MemoryRouter>
        <About />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'hi@qizai.app' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'mailto:hi@qizai.app');
  });

  it('renders social hint text "qizai 骑仔"', () => {
    render(
      <MemoryRouter>
        <About />
      </MemoryRouter>,
    );
    expect(screen.getByText(/qizai 骑仔/)).toBeInTheDocument();
  });
});
