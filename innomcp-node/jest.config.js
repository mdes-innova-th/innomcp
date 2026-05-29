// Jest configuration. Defined in JS (not JSON) so we can ensure NODE_OPTIONS
// includes our localStorage shim BEFORE jest spawns worker processes —
// jest-worker forks child processes that inherit env at fork time, and
// jest-environment-node's teardown calls Reflect.get(globalThis, "localStorage")
// which trips Node v25's lazy webstorage getter without --localstorage-file.

const path = require("path");

const preload = path.join(__dirname, "tests", "jest.preload.cjs");
const requireArg = `--require ${JSON.stringify(preload)}`;
const existing = process.env.NODE_OPTIONS || "";
if (!existing.includes("jest.preload.cjs")) {
  process.env.NODE_OPTIONS = existing ? `${existing} ${requireArg}` : requireArg;
}

/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  testPathIgnorePatterns: ["/node_modules/", "/tests/e2e/"],
  setupFiles: ["<rootDir>/tests/jest.setup.ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/**/*.test.ts"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  verbose: true,
  testTimeout: 30000,
};
