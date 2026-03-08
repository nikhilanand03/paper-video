import '@testing-library/jest-dom';

// Provide a full localStorage mock for environments where jsdom's
// localStorage lacks standard methods (vitest 4 + Node 25).
const store: Record<string, string> = {};

const localStorageMock: Storage = {
  getItem(key: string): string | null {
    return key in store ? store[key] : null;
  },
  setItem(key: string, value: string): void {
    store[key] = String(value);
  },
  removeItem(key: string): void {
    delete store[key];
  },
  clear(): void {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  },
  key(index: number): string | null {
    const keys = Object.keys(store);
    return keys[index] ?? null;
  },
  get length(): number {
    return Object.keys(store).length;
  },
};

// Only install mock if native localStorage is missing key methods
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.getItem !== 'function') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  localStorage.clear();
});
