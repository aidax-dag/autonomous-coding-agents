/**
 * Test Generation Types
 *
 * Type definitions for the natural language test generation system.
 * Defines requirement structures, test cases, and configuration.
 *
 * @module core/test-gen/types
 */

export type TestFramework = 'jest' | 'mocha' | 'vitest';
export type TestType = 'unit' | 'integration' | 'e2e';

/**
 * A parsed requirement extracted from natural language text.
 */
export interface Requirement {
  id: string;
  text: string;
  category: 'functional' | 'non-functional' | 'edge-case' | 'security' | 'performance';
  priority: 'high' | 'medium' | 'low';
  acceptanceCriteria: string[];
}

/**
 * A single test case derived from a requirement.
 */
export interface TestCase {
  id: string;
  name: string;
  description: string;
  type: TestType;
  requirement: string;
  setup?: string;
  steps: TestStep[];
  expectedResult: string;
  teardown?: string;
}

/**
 * An individual step within a test case.
 */
export interface TestStep {
  action: string;
  input?: string;
  expected?: string;
}

/**
 * The output of the test generation pipeline.
 */
export interface GeneratedTest {
  framework: TestFramework;
  language: string;
  fileName: string;
  content: string;
  testCases: TestCase[];
  imports: string[];
}

/**
 * Configuration for the test generation system.
 */
export interface TestGenConfig {
  framework: TestFramework;
  language: string;
  outputDir: string;
  includeSetup: boolean;
  includeTeardown: boolean;
  verbose: boolean;
}

/**
 * Default configuration for test generation.
 */
export const DEFAULT_TESTGEN_CONFIG: TestGenConfig = {
  framework: 'jest',
  language: 'typescript',
  outputDir: 'tests/generated',
  includeSetup: true,
  includeTeardown: true,
  verbose: false,
};
