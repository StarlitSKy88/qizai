// apps/api/test/unit/wechat-pay.test.ts
//
// T03: wechat-pay.ts core primitives.
// - signV3: deterministic lowercase hex HMAC-SHA256
// - verifyCallbackSignature: stub returns false in dev; integration tests mock it
// - unifiedorderNative + queryOrderStatus: not exercised here (require fetch mock
//   in unit; integration tests in T05/T07 cover them with vi.mock)

import { describe, it, expect } from 'vitest';
import { signV3 } from '../../src/utils/wechat-pay';

describe('wechat-pay.signV3', () => {
  it('produces 64-char lowercase hex', async () => {
    const sig = await signV3('POST', '/v3/pay/transactions/native', '{"foo":"bar"}', '1700000000', 'abc123');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for same input', async () => {
    const a = await signV3('POST', '/x', '{}', '1', 'n');
    const b = await signV3('POST', '/x', '{}', '1', 'n');
    expect(a).toBe(b);
  });

  it('differs by method', async () => {
    const base = await signV3('POST', '/x', '{}', '1', 'n');
    expect(await signV3('GET', '/x', '{}', '1', 'n')).not.toBe(base);
  });

  it('differs by urlPath', async () => {
    const base = await signV3('POST', '/x', '{}', '1', 'n');
    expect(await signV3('POST', '/y', '{}', '1', 'n')).not.toBe(base);
  });

  it('differs by body', async () => {
    const base = await signV3('POST', '/x', '{}', '1', 'n');
    expect(await signV3('POST', '/x', '{"a":1}', '1', 'n')).not.toBe(base);
  });

  it('differs by timestamp', async () => {
    const base = await signV3('POST', '/x', '{}', '1', 'n');
    expect(await signV3('POST', '/x', '{}', '2', 'n')).not.toBe(base);
  });

  it('differs by nonce', async () => {
    const base = await signV3('POST', '/x', '{}', '1', 'n');
    expect(await signV3('POST', '/x', '{}', '1', 'm')).not.toBe(base);
  });
});