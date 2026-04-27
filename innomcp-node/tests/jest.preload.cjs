// Loaded via `node --require` BEFORE jest boots, so that jest-environment-node's
// teardown `Reflect.get(globalThis, "localStorage")` sees a plain object instead
// of Node v25's lazy webstorage getter (which warns when --localstorage-file
// has no valid path). Same shim defined for sessionStorage.
"use strict";

const desc = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
if (!desc || !("value" in desc)) {
  const make = () => {
    const store = new Map();
    return {
      get length() { return store.size; },
      key(i) { return Array.from(store.keys())[i] ?? null; },
      getItem(k) { return store.has(k) ? store.get(k) : null; },
      setItem(k, v) { store.set(String(k), String(v)); },
      removeItem(k) { store.delete(k); },
      clear() { store.clear(); },
    };
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: make(),
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: make(),
    writable: true,
    configurable: true,
  });
}
