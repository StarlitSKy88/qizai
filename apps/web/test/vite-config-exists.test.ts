import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';

describe('Vite setup', () => {
  it('has vite.config.ts', () => {
    expect(existsSync('./vite.config.ts')).toBe(true);
  });
  it('has index.html', () => {
    expect(existsSync('./index.html')).toBe(true);
  });
});
