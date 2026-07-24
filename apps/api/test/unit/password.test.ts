// apps/api/test/unit/password.test.ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/utils/password';

describe('password', () => {
  it('hashes then verifies the same password', async () => {
    const hash = await hashPassword('correct horse battery staple');

    expect(hash).toMatch(/^pbkdf2\$100000\$[^$]+\$[^$]+$/);
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('hello world');

    expect(await verifyPassword('not hello', hash)).toBe(false);
  });

  it('rejects a legacy bcrypt hash gracefully', async () => {
    await expect(
      verifyPassword(
        'hello world',
        '$2b$10$N9qo8uLOick817fqnP2rHe123456789012345678901234567890',
      ),
    ).resolves.toBe(false);
  });

  it('supports passwords longer than bcrypt’s 72-byte limit', async () => {
    const longPassword = 'a'.repeat(73);
    const hash = await hashPassword(longPassword);

    expect(await verifyPassword(longPassword, hash)).toBe(true);
    expect(await verifyPassword(`${longPassword}b`, hash)).toBe(false);
  });
});
