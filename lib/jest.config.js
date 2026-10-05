/** Minimal Jest config for pure lib unit tests (no RN preset). */
module.exports = {
  rootDir: "..",
  testEnvironment: "node",
  roots: ["<rootDir>/lib"],
  testMatch: ["**/__tests__/networkDetector.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js"],
  clearMocks: true,
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          types: ["jest", "node"],
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
};
