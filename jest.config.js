export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { diagnostics: false }],
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/types/**'],
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
    // Mock ESM-only packages
    '^@octokit/rest$': '<rootDir>/tests/__mocks__/@octokit/rest.ts',
    '^octokit$': '<rootDir>/tests/__mocks__/octokit.ts',
    // Mock packages that may not be installed
    '^@mistralai/mistralai$': '<rootDir>/tests/__mocks__/@mistralai/mistralai.ts',
    // Mock vscode module for VS Code extension tests
    '^vscode$': '<rootDir>/tests/__mocks__/vscode.ts',
  },
};
