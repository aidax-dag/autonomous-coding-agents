/**
 * Test Generator
 *
 * Main orchestrator for the natural language test generation pipeline.
 * Coordinates requirement parsing, test case generation, and code emission
 * with event-based progress reporting.
 *
 * @module core/test-gen/test-generator
 */

import { EventEmitter } from 'events';
import type { GeneratedTest, Requirement, TestGenConfig } from './types';
import { DEFAULT_TESTGEN_CONFIG } from './types';
import { RequirementParser } from './requirement-parser';
import { TestCaseGenerator } from './test-case-generator';
import { TestCodeEmitter } from './code-emitter';

/**
 * Test Generator
 *
 * Orchestrates the full pipeline from natural language requirements
 * to generated test code. Emits events at each stage:
 * - 'requirements:parsed' — after requirements are extracted
 * - 'cases:generated' — after test cases are created
 * - 'code:emitted' — after code is generated
 */
export class TestGenerator extends EventEmitter {
  private parser: RequirementParser;
  private caseGenerator: TestCaseGenerator;
  private emitter: TestCodeEmitter;

  constructor(private config: TestGenConfig = DEFAULT_TESTGEN_CONFIG) {
    super();
    this.parser = new RequirementParser();
    this.caseGenerator = new TestCaseGenerator();
    this.emitter = new TestCodeEmitter(this.config);
  }

  /**
   * Generate test code from raw natural language requirement text.
   */
  generate(requirementText: string): GeneratedTest {
    // Phase 1: Parse requirements
    const requirements = this.parser.parseRequirements(requirementText);
    this.emit('requirements:parsed', requirements);

    // Phase 2 & 3: Generate test cases and emit code
    return this.generateFromRequirements(requirements);
  }

  /**
   * Generate test code from pre-parsed requirement objects.
   */
  generateFromRequirements(requirements: Requirement[]): GeneratedTest {
    // Phase 2: Generate test cases
    const allTestCases = requirements.flatMap((req) =>
      this.caseGenerator.generateTestCases(req),
    );
    this.emit('cases:generated', allTestCases);

    // Phase 3: Emit code
    const suiteName = this.deriveSuiteName(requirements);
    const result = this.emitter.emit(allTestCases, {
      suiteName,
    });
    this.emit('code:emitted', result);

    return result;
  }

  /**
   * Derive a test suite name from the set of requirements.
   */
  private deriveSuiteName(requirements: Requirement[]): string {
    if (requirements.length === 0) return 'GeneratedTests';
    if (requirements.length === 1) {
      // Use first few meaningful words
      const words = requirements[0].text.split(/\s+/).slice(0, 4).join(' ');
      return words || 'GeneratedTests';
    }

    // Find common theme from multiple requirements
    const categories = [...new Set(requirements.map((r) => r.category))];
    if (categories.length === 1) {
      return `${this.capitalize(categories[0])} Tests`;
    }

    return 'GeneratedTests';
  }

  /**
   * Capitalize the first letter of a string.
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
