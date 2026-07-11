/** Jest config for the mobile workspace. Uses the jest-expo preset (handles the
 *  RN/platform transform + native-module mocks — Vitest can't drive Metro/RN).
 *  M1 ships a single, pure-logic test; add module mocks + component tests here as
 *  the suite grows. */
module.exports = {
  preset: "jest-expo",
  roots: ["<rootDir>/src"],
  testMatch: ["**/?(*.)+(spec|test).ts?(x)"],
  setupFiles: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@ticketly/shared$": "<rootDir>/../shared/src",
  },
};
