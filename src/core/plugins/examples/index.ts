/**
 * Example Plugins
 *
 * Three reference plugins demonstrating the ACA plugin system:
 * linting, test running, and documentation generation.
 *
 * @module core/plugins/examples
 */

export {
  LintingPlugin,
  createLintingPlugin,
  LINTING_PLUGIN_MANIFEST,
  LINTING_MARKETPLACE_MANIFEST,
} from './linting-plugin';
export type { LintIssue, LintResult, TypeCheckResult } from './linting-plugin';

export {
  TestRunnerPlugin,
  createTestRunnerPlugin,
  TEST_RUNNER_PLUGIN_MANIFEST,
  TEST_RUNNER_MARKETPLACE_MANIFEST,
} from './test-runner-plugin';
export type { TestResult, TestSuiteResult, CoverageResult, CoverageMetric, UncoveredFile } from './test-runner-plugin';

export {
  DocumentationPlugin,
  createDocumentationPlugin,
  DOCS_PLUGIN_MANIFEST,
  DOCS_MARKETPLACE_MANIFEST,
} from './documentation-plugin';
export type {
  ApiDocResult,
  LinkCheckResult,
  BrokenLink,
  ChangelogEntry,
  ChangelogResult,
  ReadmeValidation,
  ReadmeSection,
} from './documentation-plugin';
