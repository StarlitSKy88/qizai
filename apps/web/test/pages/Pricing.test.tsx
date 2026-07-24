import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Pricing from '../../src/pages/Pricing';

describe('Pricing', () => {
  it('renders 3 tier cards (试用 / 个人创作者 / 团队)', () => {
    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 2, name: /试用/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /个人创作者/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /团队/ })).toBeInTheDocument();
  });

  it('middle tier (个人创作者) has highlight ring + sr-only "推荐方案"', () => {
    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>,
    );
    // sr-only element exists
    expect(screen.getByText('推荐方案', { selector: 'span' })).toBeInTheDocument();
    // highlight ring class on tier 2 card
    const tier2Card = screen.getByRole('heading', { level: 2, name: /个人创作者/ }).closest('div');
    expect(tier2Card?.className).toContain('ring-2');
  });

  it('renders prices ¥0 / ¥29 / ¥299', () => {
    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>,
    );
    expect(screen.getByText('¥0')).toBeInTheDocument();
    expect(screen.getByText('¥29')).toBeInTheDocument();
    expect(screen.getByText('¥299')).toBeInTheDocument();
  });

  it('each tier lists features with Check icon', () => {
    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>,
    );
    // Sample check from each tier (not exhaustive — 3+5+3 = 11 total)
    expect(screen.getByText('每天 3 次预测')).toBeInTheDocument();
    expect(screen.getByText('无限预测')).toBeInTheDocument();
    expect(screen.getByText('5 个子账号')).toBeInTheDocument();
    // Check icons present (aria-hidden so use querySelector)
    const checkIcons = document.querySelectorAll('svg.lucide-check');
    expect(checkIcons.length).toBeGreaterThan(5);
  });

  it('tier 1/2 CTA is Link to /predict; tier 3 CTA is mailto link', () => {
    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>,
    );
    // Tier 1: 免费开始 → /predict
    expect(screen.getByRole('link', { name: '免费开始' })).toHaveAttribute('href', '/predict');
    // Tier 2: 开始体验 → /predict
    expect(screen.getByRole('link', { name: '开始体验' })).toHaveAttribute('href', '/predict');
    // Tier 3: 联系销售 → mailto
    expect(screen.getByRole('link', { name: '联系销售' })).toHaveAttribute('href', 'mailto:hi@qizai.app');
  });
});
