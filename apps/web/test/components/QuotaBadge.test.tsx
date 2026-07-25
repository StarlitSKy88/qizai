// apps/web/test/components/QuotaBadge.test.tsx
//
// T11: QuotaBadge rendering + color rules + logged-out hidden.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { mockGetMe } = vi.hoisted(() => ({ mockGetMe: vi.fn() }));

vi.mock('../../src/api/billing', () => ({
  getMe: mockGetMe,
}));

import QuotaBadge from '../../src/components/QuotaBadge';

describe('QuotaBadge', () => {
  beforeEach(() => {
    mockGetMe.mockReset();
  });

  it('renders quota X/Y after fetch resolves', async () => {
    mockGetMe.mockResolvedValue({
      userId: 'u-1',
      email: 'a@b.com',
      plan: 'free',
      quota_used: 5,
      quota_limit: 30,
      quota_limit_renew_at: null,
    });
    render(
      <MemoryRouter>
        <QuotaBadge />
      </MemoryRouter>,
    );
    expect(await screen.findByText('5 / 30')).toBeInTheDocument();
  });

  it('uses red color when remaining <= 5', async () => {
    mockGetMe.mockResolvedValue({
      userId: 'u-1',
      email: 'a@b.com',
      plan: 'free',
      quota_used: 27,
      quota_limit: 30,
      quota_limit_renew_at: null,
    });
    render(
      <MemoryRouter>
        <QuotaBadge />
      </MemoryRouter>,
    );
    const badge = await screen.findByText('27 / 30');
    expect(badge.className).toContain('text-red-300');
  });

  it('uses gray color when quota exhausted', async () => {
    mockGetMe.mockResolvedValue({
      userId: 'u-1',
      email: 'a@b.com',
      plan: 'free',
      quota_used: 30,
      quota_limit: 30,
      quota_limit_renew_at: null,
    });
    render(
      <MemoryRouter>
        <QuotaBadge />
      </MemoryRouter>,
    );
    const badge = await screen.findByText('30 / 30');
    expect(badge.className).toContain('text-gray-400');
  });

  it('renders nothing when getMe rejects (logged out)', async () => {
    mockGetMe.mockRejectedValue(new Error('AUTH_REQUIRED'));
    const { container } = render(
      <MemoryRouter>
        <QuotaBadge />
      </MemoryRouter>,
    );
    // Allow the effect to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(container.firstChild).toBeNull();
  });
});