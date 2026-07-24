import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { signToken, verifyToken, JWTPayload } from '../../src/utils/jwt';

describe('jwt', () => {
  it('signs and verifies a token', async () => {
    const token = await signToken({ sub: 'user-1', email: 'a@b.com' }, 'secret');
    const payload = await verifyToken(token, 'secret');
    expect(payload.sub).toBe('user-1');
    expect(payload.email).toBe('a@b.com');
  });

  it('rejects token signed with different secret', async () => {
    const token = await signToken({ sub: 'user-1', email: 'a@b.com' }, 'secret-a');
    await expect(verifyToken(token, 'secret-b')).rejects.toThrow();
  });

  it('rejects expired token', async () => {
    const token = await new SignJWT({ email: 'a@b.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode('secret'));
    await expect(verifyToken(token, 'secret')).rejects.toThrow();
  });
});

export type { JWTPayload };
