export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { diagnostics: false, tsconfig: { jsx: 'react-jsx' } }],
  },
  collectCoverageFrom: ['src/**/*.ts', 'src/**/*.tsx', '!src/**/*.d.ts', '!src/types/**'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  // Transform ESM-only packages
  transformIgnorePatterns: [
    'node_modules/(?!(chalk)/)',
  ],
  moduleNameMapper: {
    // Handle .js extensions in ESM imports (both alias and relative)
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@/(.*)\\.js$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock ink and ink-testing-library (ESM + WASM, not compatible with CJS Jest)
    '^ink$': '<rootDir>/tests/__mocks__/ink.ts',
    '^ink-testing-library$': '<rootDir>/tests/__mocks__/ink-testing-library.ts',
    // Mock ESM-only packages
    '^@octokit/rest$': '<rootDir>/tests/__mocks__/@octokit/rest.ts',
    '^octokit$': '<rootDir>/tests/__mocks__/octokit.ts',
    // Mock packages that may not be installed
    '^@mistralai/mistralai$': '<rootDir>/tests/__mocks__/@mistralai/mistralai.ts',
    // Mock vscode module for VS Code extension tests
    '^vscode$': '<rootDir>/tests/__mocks__/vscode.ts',
  },
};
