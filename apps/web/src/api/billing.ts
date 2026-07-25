/**
 * apps/web/src/api/billing.ts
 *
 * v0.15.0 — billing / WeChat Pay client functions.
 *   createCheckout(plan)  → POST /api/checkout/create
 *   pollOrderStatus(id)   → GET /api/checkout/status/:orderId
 *   getMe()               → GET /api/users/me
 *
 * Each function unwraps the apiFetch Response and surfaces non-2xx as a
 * regular Error so BuyModal + QuotaBadge can show a user-friendly message.
 */
import { apiFetch } from './client';

export type CheckoutPlan = 'personal_sub' | 'team_sub' | 'topup_100';

export interface CheckoutResponse {
  orderId: string;
  qrCodeBase64: string;
  amountFen: number;
  expiresAt: number;
}

export async function createCheckout(plan: CheckoutPlan): Promise<CheckoutResponse> {
  const r = await apiFetch('/api/checkout/create', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });
  if (!r.ok) throw new Error(`Checkout failed: HTTP ${r.status}`);
  return r.json() as Promise<CheckoutResponse>;
}

export interface OrderStatus {
  status: 'pending' | 'paid' | 'closed' | 'refunded';
  paidAt: number | null;
}

export async function pollOrderStatus(orderId: string): Promise<OrderStatus> {
  const r = await apiFetch(`/api/checkout/status/${orderId}`);
  if (!r.ok) throw new Error(`Status failed: HTTP ${r.status}`);
  return r.json() as Promise<OrderStatus>;
}

export interface MeResponse {
  userId: string;
  email: string;
  plan: string;
  quota_used: number;
  quota_limit: number;
  quota_limit_renew_at: number | null;
}

export async function getMe(): Promise<MeResponse> {
  const r = await apiFetch('/api/users/me');
  if (!r.ok) throw new Error(`Me failed: HTTP ${r.status}`);
  return r.json() as Promise<MeResponse>;
}