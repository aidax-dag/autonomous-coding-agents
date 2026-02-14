/**
 * Jest Configuration for LLM Integration Tests
 *
 * Self-contained config that reuses base settings but overrides
 * rootDir so that path aliases (@/) resolve correctly against the
 * project root rather than the config file's directory.
 *
 * Usage:
 *   npx jest --config tests/integration/jest.integration.config.js
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');

export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: [`${projectRoot}/tests`],
  // Only run integration test files
  testMatch: ['**/tests/integration/**/*.integration.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { diagnostics: false }],
  },
  // Transform ESM-only packages
  transformIgnorePatterns: [
    'node_modules/(?!(chalk)/)',
  ],
  moduleNameMapper: {
    // Handle .js extensions in ESM imports (both alias and relative)
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@/(.*)\\.js$': `${projectRoot}/src/$1`,
    '^@/(.*)$': `${projectRoot}/src/$1`,
    // Mock ESM-only packages
    '^@octokit/rest$': `${projectRoot}/tests/__mocks__/@octokit/rest.ts`,
    '^octokit$': `${projectRoot}/tests/__mocks__/octokit.ts`,
    // Mock packages that may not be installed
    '^@mistralai/mistralai$': `${projectRoot}/tests/__mocks__/@mistralai/mistralai.ts`,
  },
  // Longer timeout for real API calls (60 seconds per test)
  testTimeout: 60000,
  // Run sequentially to avoid rate-limit issues across providers
  maxWorkers: 1,
  // Do not enforce coverage thresholds for integration tests
  coverageThreshold: undefined,
  collectCoverage: false,
};
