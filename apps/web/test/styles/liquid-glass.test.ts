import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('liquid-glass.css', () => {
  const css = readFileSync(
    join(__dirname, '../../src/styles/liquid-glass.css'),
    'utf-8'
  );

  it('defines .liquid-glass class', () => {
    expect(css).toMatch(/\.liquid-glass\s*\{/);
  });

  it('uses rgba(255, 255, 255, 0.01) background', () => {
    expect(css).toContain('rgba(255, 255, 255, 0.01)');
  });

  it('uses luminosity background-blend-mode', () => {
    expect(css).toContain('background-blend-mode: luminosity');
  });

  it('applies 4px backdrop-filter blur', () => {
    expect(css).toContain('backdrop-filter: blur(4px)');
    expect(css).toContain('-webkit-backdrop-filter: blur(4px)');
  });

  it('defines ::before pseudo-element with linear-gradient mask', () => {
    expect(css).toMatch(/\.liquid-glass::before\s*\{/);
    expect(css).toContain('linear-gradient(180deg');
    expect(css).toContain('-webkit-mask:');
    expect(css).toContain('mask-composite: exclude');
  });
});
