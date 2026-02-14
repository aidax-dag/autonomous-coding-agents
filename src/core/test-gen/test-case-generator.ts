/**
 * Test Case Generator
 *
 * Generates structured test cases from parsed requirements.
 * Produces happy path, edge case, and negative test cases
 * with inferred steps from acceptance criteria.
 *
 * @module core/test-gen/test-case-generator
 */

import type { Requirement, TestCase, TestStep, TestType } from './types';

/** Counter seed for unique ID generation */
let globalCounter = 0;

/**
 * Test Case Generator
 *
 * Transforms requirement objects into executable test case structures
 * covering happy path, edge case, and negative scenarios.
 */
export class TestCaseGenerator {
  /**
   * Generate all test cases for a requirement: happy path, edge cases, and negatives.
   */
  generateTestCases(requirement: Requirement): TestCase[] {
    const cases: TestCase[] = [];

    cases.push(this.generateHappyPath(requirement));
    cases.push(...this.generateEdgeCases(requirement));
    cases.push(...this.generateNegativeCases(requirement));

    return cases;
  }

  /**
   * Generate the happy path test case for a requirement.
   */
  private generateHappyPath(requirement: Requirement): TestCase {
    const steps = this.inferSteps(requirement.acceptanceCriteria);
    const type = this.inferTestType(requirement);

    return {
      id: this.generateId('TC'),
      name: `should ${this.extractAction(requirement.text)}`,
      description: `Happy path: ${requirement.text}`,
      type,
      requirement: requirement.id,
      setup: this.inferSetup(requirement),
      steps,
      expectedResult: this.inferExpectedResult(requirement),
      teardown: this.inferTeardown(requirement),
    };
  }

  /**
   * Generate edge case test cases based on requirement category and content.
   */
  private generateEdgeCases(requirement: Requirement): TestCase[] {
    const cases: TestCase[] = [];
    const lower = requirement.text.toLowerCase();
    const type = this.inferTestType(requirement);

    // Boundary value edge case
    if (this.hasBoundaryContext(lower)) {
      cases.push({
        id: this.generateId('TC'),
        name: `should handle boundary values for ${this.extractSubject(requirement.text)}`,
        description: `Edge case: boundary values for ${requirement.text}`,
        type,
        requirement: requirement.id,
        steps: [
          { action: 'Provide minimum boundary input', input: 'minimum value', expected: 'Handles gracefully' },
          { action: 'Provide maximum boundary input', input: 'maximum value', expected: 'Handles gracefully' },
        ],
        expectedResult: 'System handles boundary values correctly',
      });
    }

    // Empty/null edge case
    if (this.hasInputContext(lower)) {
      cases.push({
        id: this.generateId('TC'),
        name: `should handle empty input for ${this.extractSubject(requirement.text)}`,
        description: `Edge case: empty/null input for ${requirement.text}`,
        type,
        requirement: requirement.id,
        steps: [
          { action: 'Provide empty input', input: '', expected: 'Handles gracefully' },
          { action: 'Provide null input', input: 'null', expected: 'Handles gracefully' },
        ],
        expectedResult: 'System handles empty/null input without crashing',
      });
    }

    // If category is edge-case, always generate at least one
    if (cases.length === 0 && requirement.category === 'edge-case') {
      cases.push({
        id: this.generateId('TC'),
        name: `should handle edge case for ${this.extractSubject(requirement.text)}`,
        description: `Edge case: ${requirement.text}`,
        type,
        requirement: requirement.id,
        steps: [
          { action: 'Trigger edge condition', expected: 'System handles gracefully' },
        ],
        expectedResult: 'System handles edge case correctly',
      });
    }

    return cases;
  }

  /**
   * Generate negative test cases to verify error handling.
   */
  private generateNegativeCases(requirement: Requirement): TestCase[] {
    const cases: TestCase[] = [];
    const lower = requirement.text.toLowerCase();
    const type = this.inferTestType(requirement);

    // Invalid input negative case
    if (this.hasInputContext(lower) || requirement.category === 'functional') {
      cases.push({
        id: this.generateId('TC'),
        name: `should reject invalid input for ${this.extractSubject(requirement.text)}`,
        description: `Negative: invalid input for ${requirement.text}`,
        type,
        requirement: requirement.id,
        steps: [
          { action: 'Provide invalid input', input: 'invalid data', expected: 'Rejection or error' },
        ],
        expectedResult: 'System rejects invalid input with appropriate error',
      });
    }

    // Security-specific negative case
    if (requirement.category === 'security') {
      cases.push({
        id: this.generateId('TC'),
        name: `should prevent unauthorized access for ${this.extractSubject(requirement.text)}`,
        description: `Negative: security violation for ${requirement.text}`,
        type,
        requirement: requirement.id,
        steps: [
          { action: 'Attempt unauthorized access', expected: 'Access denied' },
        ],
        expectedResult: 'System prevents unauthorized access',
      });
    }

    // Performance-specific negative case
    if (requirement.category === 'performance') {
      cases.push({
        id: this.generateId('TC'),
        name: `should handle overload for ${this.extractSubject(requirement.text)}`,
        description: `Negative: overload scenario for ${requirement.text}`,
        type,
        requirement: requirement.id,
        steps: [
          { action: 'Apply excessive load', input: 'overload scenario', expected: 'Graceful degradation' },
        ],
        expectedResult: 'System degrades gracefully under overload',
      });
    }

    return cases;
  }

  /**
   * Infer test steps from acceptance criteria strings.
   */
  private inferSteps(criteria: string[]): TestStep[] {
    return criteria.map((criterion) => {
      const colonIndex = criterion.indexOf(':');
      if (colonIndex > 0) {
        const prefix = criterion.slice(0, colonIndex).trim().toLowerCase();
        const content = criterion.slice(colonIndex + 1).trim();

        if (prefix === 'precondition' || prefix === 'given') {
          return { action: `Set up: ${content}` };
        }
        if (prefix === 'action' || prefix === 'when') {
          return { action: content, expected: 'Action completes successfully' };
        }
        if (prefix === 'expected' || prefix === 'then') {
          return { action: 'Verify result', expected: content };
        }
        if (prefix === 'verify' || prefix === 'confirm') {
          return { action: content, expected: 'Condition is met' };
        }
        if (prefix === 'outcome') {
          return { action: 'Verify outcome', expected: content };
        }
      }

      return { action: criterion, expected: 'Condition is met' };
    });
  }

  /**
   * Generate a unique ID with a prefix.
   */
  private generateId(prefix: string): string {
    globalCounter++;
    return `${prefix}-${String(globalCounter).padStart(4, '0')}`;
  }

  /**
   * Infer the test type based on requirement properties.
   */
  private inferTestType(requirement: Requirement): TestType {
    const lower = requirement.text.toLowerCase();
    if (lower.includes('end-to-end') || lower.includes('e2e') || lower.includes('workflow')) {
      return 'e2e';
    }
    if (lower.includes('integrat') || lower.includes('api') || lower.includes('database') || lower.includes('service')) {
      return 'integration';
    }
    return 'unit';
  }

  /**
   * Extract the main action verb phrase from requirement text.
   */
  private extractAction(text: string): string {
    const verbMatch = text.match(/(?:should|must|shall|can|will|needs?\s+to)\s+(.+)/i);
    if (verbMatch) return verbMatch[1].replace(/\.$/, '').trim();

    // Fallback: return a simplified version of the text
    const truncated = text.length > 60 ? text.slice(0, 57) + '...' : text;
    return truncated.toLowerCase().replace(/\.$/, '');
  }

  /**
   * Extract the primary subject from requirement text.
   */
  private extractSubject(text: string): string {
    // Try to find the main noun phrase after "the" or at start
    const subjectMatch = text.match(/(?:the\s+)?(\w+(?:\s+\w+)?)\s+(?:should|must|shall|can|will)/i);
    if (subjectMatch) return subjectMatch[1].toLowerCase();

    const words = text.split(/\s+/).slice(0, 3).join(' ');
    return words.toLowerCase();
  }

  /**
   * Check if text implies boundary-related concerns.
   */
  private hasBoundaryContext(lower: string): boolean {
    return ['boundary', 'limit', 'range', 'maximum', 'minimum', 'max', 'min', 'between'].some((kw) => lower.includes(kw));
  }

  /**
   * Check if text implies input processing.
   */
  private hasInputContext(lower: string): boolean {
    return ['input', 'enter', 'provide', 'submit', 'send', 'receive', 'accept', 'validate', 'data', 'field', 'form', 'request', 'parameter'].some((kw) => lower.includes(kw));
  }

  /**
   * Infer setup instructions from a requirement.
   */
  private inferSetup(requirement: Requirement): string | undefined {
    const lower = requirement.text.toLowerCase();
    if (lower.includes('login') || lower.includes('auth')) return 'Set up authenticated user session';
    if (lower.includes('database') || lower.includes('data')) return 'Set up test data';
    if (lower.includes('api') || lower.includes('service')) return 'Set up service dependencies';
    return undefined;
  }

  /**
   * Infer teardown instructions from a requirement.
   */
  private inferTeardown(requirement: Requirement): string | undefined {
    const lower = requirement.text.toLowerCase();
    if (lower.includes('database') || lower.includes('data')) return 'Clean up test data';
    if (lower.includes('file') || lower.includes('upload')) return 'Remove temporary files';
    return undefined;
  }

  /**
   * Infer the expected result from a requirement.
   */
  private inferExpectedResult(requirement: Requirement): string {
    // Check acceptance criteria for expected outcomes
    for (const criterion of requirement.acceptanceCriteria) {
      if (criterion.startsWith('Expected:') || criterion.startsWith('Outcome:')) {
        return criterion.split(':').slice(1).join(':').trim();
      }
    }

    // Derive from the requirement text
    const verbMatch = requirement.text.match(/(?:should|must|shall|can|will|needs?\s+to)\s+(.+)/i);
    if (verbMatch) return verbMatch[1].replace(/\.$/, '').trim();

    return `Requirement fulfilled: ${requirement.text}`;
  }
}

/**
 * Reset the global counter (for testing purposes).
 */
export function resetTestCaseCounter(): void {
  globalCounter = 0;
}
