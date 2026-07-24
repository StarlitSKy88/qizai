// apps/api/test/unit/password.test.ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/utils/password';

describe('password', () => {
  it('hashes a password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it('verifies correct password', async () => {
    const hash = await hashPassword('hello world');
    expect(await verifyPassword('hello world', hash)).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('hello world');
    expect(await verifyPassword('not hello', hash)).toBe(false);
  });
});
