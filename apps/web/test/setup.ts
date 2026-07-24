import '@testing-library/jest-dom/vitest';
import { expect, beforeEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// `@testing-library/jest-dom/vitest` only extends `vitest.expect` when it
// is imported with `globals: false`. Under `globals: true` (which we use
// for `describe / it / expect` global style) vitest's `expect` is a
// chai-backed proxy exposed via the global `expect`, so we have to extend
// it explicitly here. Without this every `toBeInTheDocument()` call fails
// with "Invalid Chai property: toBeInTheDocument".
expect.extend(matchers);

// jsdom 29 + vitest's worker runner ships an empty `localStorage` stub
// (the `--localstorage-file` flag is passed without a path). The web
// auth code reads/writes `qizai_jwt` in localStorage, so we install a
// minimum spec-compliant implementation. Cleared per test so suites stay
// isolated.
if (
  typeof localStorage === 'undefined' ||
  typeof localStorage.getItem !== 'function'
) {
  const store = new Map<string, string>();
  // jsdom exposes `window`; if not, use globalThis.
  const target: any =
    typeof window !== 'undefined' ? window : (globalThis as any);
  target.localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

beforeEach(() => {
  localStorage.clear();
});