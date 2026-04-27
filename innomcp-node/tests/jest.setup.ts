// Jest setup — runs ONCE per worker before tests.
//
// Node v25 ships built-in webstorage gated behind `--localstorage-file=<path>`.
// Jest's jest-environment-node teardown does `Reflect.get(globalThis, "localStorage")`
// to clear globals between tests, which trips Node's lazy getter and prints:
//   Warning: `--localstorage-file` was provided without a valid path
//
// We defuse it by replacing the lazy getter with a plain in-memory shim
// BEFORE jest's first teardown runs. The shim is API-compatible (Storage
// interface) so any test code that touches localStorage still works.

(() => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  // Already replaced (or browser env) — leave it alone.
  if (desc && "value" in desc) return;

  const store = new Map<string, string>();
  const shim = {
    get length() {
      return store.size;
    },
    key(i: number): string | null {
      return Array.from(store.keys())[i] ?? null;
    },
    getItem(k: string): string | null {
      return store.has(k) ? store.get(k)! : null;
    },
    setItem(k: string, v: string): void {
      store.set(String(k), String(v));
    },
    removeItem(k: string): void {
      store.delete(k);
    },
    clear(): void {
      store.clear();
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    value: shim,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: shim,
    writable: true,
    configurable: true,
  });
})();
