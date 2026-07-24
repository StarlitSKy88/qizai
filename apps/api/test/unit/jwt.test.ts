import { describe, it, expect } from 'vitest';
import { signToken, verifyToken, JWTPayload } from '../../src/utils/jwt';

describe('jwt', () => {
  it('signs and verifies a token', async () => {
    const token = await signToken({ sub: 'user-1', email: 'a@b.com' }, 'secret');
    const payload = await verifyToken(token, 'secret');
    expect(payload.sub).toBe('user-1');
    expect(payload.email).toBe('a@b.com');
  });

  it('rejects token signed with different secret', async () => {
    const token = await signToken({ sub: 'user-1' }, 'secret-a');
    await expect(verifyToken(token, 'secret-b')).rejects.toThrow();
  });

  it('rejects expired token', async () => {
    const token = await signToken({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 60 }, 'secret');
    await expect(verifyToken(token, 'secret')).rejects.toThrow();
  });
});

export type { JWTPayload };
