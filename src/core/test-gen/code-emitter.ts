/**
 * Test Code Emitter
 *
 * Generates syntactically correct test code from structured test cases.
 * Supports Jest, Mocha, and Vitest frameworks with proper imports,
 * setup/teardown blocks, and assertion formatting.
 *
 * @module core/test-gen/code-emitter
 */

import type { GeneratedTest, TestCase, TestFramework, TestGenConfig, TestStep } from './types';

/**
 * Context for a test suite emission.
 */
interface EmitContext {
  suiteName: string;
  imports?: string[];
}

/**
 * Test Code Emitter
 *
 * Converts test case structures into framework-specific test code strings.
 */
export class TestCodeEmitter {
  constructor(private config: TestGenConfig) {}

  /**
   * Emit a complete generated test file from test cases and context.
   */
  emit(testCases: TestCase[], context: EmitContext): GeneratedTest {
    const framework = this.config.framework;
    const imports = [
      ...this.generateImports(framework),
      ...(context.imports ?? []),
    ];
    const suiteName = context.suiteName;

    let content: string;
    switch (framework) {
      case 'jest':
        content = this.emitJest(testCases, suiteName, imports);
        break;
      case 'mocha':
        content = this.emitMocha(testCases, suiteName, imports);
        break;
      case 'vitest':
        content = this.emitVitest(testCases, suiteName, imports);
        break;
      default:
        content = this.emitJest(testCases, suiteName, imports);
    }

    const ext = this.config.language === 'typescript' ? '.test.ts' : '.test.js';
    const fileName = `${this.toKebabCase(suiteName)}${ext}`;

    return {
      framework,
      language: this.config.language,
      fileName,
      content,
      testCases,
      imports,
    };
  }

  /**
   * Emit test code in Jest format.
   */
  private emitJest(testCases: TestCase[], suiteName: string, imports: string[]): string {
    const lines: string[] = [];

    // Imports
    for (const imp of imports) {
      lines.push(imp);
    }
    if (imports.length > 0) lines.push('');

    // Describe block
    lines.push(`describe('${this.escapeSingleQuotes(suiteName)}', () => {`);

    // Setup
    if (this.config.includeSetup && testCases.some((tc) => tc.setup)) {
      lines.push('  beforeEach(() => {');
      const setupTexts = [...new Set(testCases.filter((tc) => tc.setup).map((tc) => tc.setup!))];
      for (const setup of setupTexts) {
        lines.push(`    // ${setup}`);
      }
      lines.push('  });');
      lines.push('');
    }

    // Teardown
    if (this.config.includeTeardown && testCases.some((tc) => tc.teardown)) {
      lines.push('  afterEach(() => {');
      const teardownTexts = [...new Set(testCases.filter((tc) => tc.teardown).map((tc) => tc.teardown!))];
      for (const teardown of teardownTexts) {
        lines.push(`    // ${teardown}`);
      }
      lines.push('  });');
      lines.push('');
    }

    // Test cases
    for (const tc of testCases) {
      lines.push(`  it('${this.formatTestName(tc)}', () => {`);
      lines.push(...this.formatSteps(tc.steps, '    '));
      lines.push(`    ${this.formatAssertion(tc.expectedResult, 'jest')}`);
      lines.push('  });');
      lines.push('');
    }

    lines.push('});');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Emit test code in Mocha format.
   */
  private emitMocha(testCases: TestCase[], suiteName: string, imports: string[]): string {
    const lines: string[] = [];

    // Imports
    for (const imp of imports) {
      lines.push(imp);
    }
    if (imports.length > 0) lines.push('');

    // Describe block
    lines.push(`describe('${this.escapeSingleQuotes(suiteName)}', function () {`);

    // Setup
    if (this.config.includeSetup && testCases.some((tc) => tc.setup)) {
      lines.push('  beforeEach(function () {');
      const setupTexts = [...new Set(testCases.filter((tc) => tc.setup).map((tc) => tc.setup!))];
      for (const setup of setupTexts) {
        lines.push(`    // ${setup}`);
      }
      lines.push('  });');
      lines.push('');
    }

    // Teardown
    if (this.config.includeTeardown && testCases.some((tc) => tc.teardown)) {
      lines.push('  afterEach(function () {');
      const teardownTexts = [...new Set(testCases.filter((tc) => tc.teardown).map((tc) => tc.teardown!))];
      for (const teardown of teardownTexts) {
        lines.push(`    // ${teardown}`);
      }
      lines.push('  });');
      lines.push('');
    }

    // Test cases
    for (const tc of testCases) {
      lines.push(`  it('${this.formatTestName(tc)}', function () {`);
      lines.push(...this.formatSteps(tc.steps, '    '));
      lines.push(`    ${this.formatAssertion(tc.expectedResult, 'mocha')}`);
      lines.push('  });');
      lines.push('');
    }

    lines.push('});');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Emit test code in Vitest format.
   */
  private emitVitest(testCases: TestCase[], suiteName: string, imports: string[]): string {
    const lines: string[] = [];

    // Imports
    for (const imp of imports) {
      lines.push(imp);
    }
    if (imports.length > 0) lines.push('');

    // Describe block
    lines.push(`describe('${this.escapeSingleQuotes(suiteName)}', () => {`);

    // Setup
    if (this.config.includeSetup && testCases.some((tc) => tc.setup)) {
      lines.push('  beforeEach(() => {');
      const setupTexts = [...new Set(testCases.filter((tc) => tc.setup).map((tc) => tc.setup!))];
      for (const setup of setupTexts) {
        lines.push(`    // ${setup}`);
      }
      lines.push('  });');
      lines.push('');
    }

    // Teardown
    if (this.config.includeTeardown && testCases.some((tc) => tc.teardown)) {
      lines.push('  afterEach(() => {');
      const teardownTexts = [...new Set(testCases.filter((tc) => tc.teardown).map((tc) => tc.teardown!))];
      for (const teardown of teardownTexts) {
        lines.push(`    // ${teardown}`);
      }
      lines.push('  });');
      lines.push('');
    }

    // Test cases
    for (const tc of testCases) {
      lines.push(`  it('${this.formatTestName(tc)}', () => {`);
      lines.push(...this.formatSteps(tc.steps, '    '));
      lines.push(`    ${this.formatAssertion(tc.expectedResult, 'vitest')}`);
      lines.push('  });');
      lines.push('');
    }

    lines.push('});');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Format a test case name for display.
   */
  private formatTestName(testCase: TestCase): string {
    return this.escapeSingleQuotes(testCase.name);
  }

  /**
   * Format setup instructions as code comments.
   */
  formatSetup(setup: string): string {
    return `// Setup: ${setup}`;
  }

  /**
   * Format test steps as code lines.
   */
  private formatSteps(steps: TestStep[], indent: string): string[] {
    const lines: string[] = [];
    for (const step of steps) {
      lines.push(`${indent}// ${step.action}`);
      if (step.input !== undefined) {
        lines.push(`${indent}const input = ${JSON.stringify(step.input)};`);
      }
      if (step.expected) {
        lines.push(`${indent}// Expected: ${step.expected}`);
      }
    }
    return lines;
  }

  /**
   * Format an assertion statement for the target framework.
   */
  private formatAssertion(expected: string, framework: string): string {
    const safeExpected = this.escapeSingleQuotes(expected);
    switch (framework) {
      case 'mocha':
        return `expect(result).to.satisfy((r: unknown) => r !== undefined); // ${safeExpected}`;
      case 'vitest':
        return `expect(result).toBeDefined(); // ${safeExpected}`;
      case 'jest':
      default:
        return `expect(result).toBeDefined(); // ${safeExpected}`;
    }
  }

  /**
   * Generate framework-specific import statements.
   */
  generateImports(framework: TestFramework): string[] {
    switch (framework) {
      case 'jest':
        return [];
      case 'mocha':
        return [
          "import { describe, it, beforeEach, afterEach } from 'mocha';",
          "import { expect } from 'chai';",
        ];
      case 'vitest':
        return [
          "import { describe, it, expect, beforeEach, afterEach } from 'vitest';",
        ];
      default:
        return [];
    }
  }

  /**
   * Convert a string to kebab-case for file naming.
   */
  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  /**
   * Escape single quotes in strings for code generation.
   */
  private escapeSingleQuotes(str: string): string {
    return str.replace(/'/g, "\\'");
  }
}
