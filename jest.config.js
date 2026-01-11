export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
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
    'node_modules/(?!(uuid|chalk|ora)/)',
  ],
  moduleNameMapper: {
    // Handle .js extensions in ESM imports (both alias and relative)
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@/(.*)\\.js$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@agents/(.*)$': '<rootDir>/src/agents/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    // Mock ESM-only packages
    '^@octokit/rest$': '<rootDir>/tests/__mocks__/@octokit/rest.ts',
    '^octokit$': '<rootDir>/tests/__mocks__/octokit.ts',
    '^nats$': '<rootDir>/tests/__mocks__/nats.ts',
    '^uuid$': '<rootDir>/tests/__mocks__/uuid.ts',
  },
};
