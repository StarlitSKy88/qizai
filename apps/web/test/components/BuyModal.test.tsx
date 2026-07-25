// apps/web/test/components/BuyModal.test.tsx
//
// T12: BuyModal — tab switch + plan click → createCheckout.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { mockCreateCheckout, mockPollOrderStatus } = vi.hoisted(() => ({
  mockCreateCheckout: vi.fn(),
  mockPollOrderStatus: vi.fn(),
}));

vi.mock('../../src/api/billing', () => ({
  createCheckout: mockCreateCheckout,
  pollOrderStatus: mockPollOrderStatus,
}));

import BuyModal from '../../src/components/BuyModal';

describe('BuyModal', () => {
  beforeEach(() => {
    mockCreateCheckout.mockReset();
    mockPollOrderStatus.mockReset();
    mockPollOrderStatus.mockResolvedValue({ status: 'pending', paidAt: null });
  });

  it('renders subscription tab by default with 2 plans', () => {
    render(<BuyModal onClose={() => {}} />);
    expect(screen.getByText('¥29')).toBeInTheDocument();
    expect(screen.getByText('¥299')).toBeInTheDocument();
  });

  it('switches to topup tab and shows ¥9.9', async () => {
    const user = userEvent.setup();
    render(<BuyModal onClose={() => {}} />);
    await user.click(screen.getByRole('tab', { name: '加量包' }));
    expect(screen.getByText('¥9.9')).toBeInTheDocument();
  });

  it('clicking ¥29 calls createCheckout with personal_sub', async () => {
    mockCreateCheckout.mockResolvedValue({
      orderId: 'o-1',
      qrCodeBase64: 'data:image/png;base64,xxx',
      amountFen: 2900,
      expiresAt: Math.floor(Date.now() / 1000) + 1800,
    });
    const user = userEvent.setup();
    render(<BuyModal onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /个人创作者.*¥29/ }));
    expect(mockCreateCheckout).toHaveBeenCalledWith('personal_sub');
  });

  it('shows error alert when createCheckout rejects', async () => {
    mockCreateCheckout.mockRejectedValue(new Error('网络异常'));
    const user = userEvent.setup();
    render(<BuyModal onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /个人创作者.*¥29/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('网络异常，请稍后重试');
  });
});