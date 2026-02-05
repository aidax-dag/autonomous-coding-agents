/**
 * F002-SelfCheckProtocol: Post-execution Self-Check System
 *
 * Validates task completion through 4 essential questions and
 * 7 danger signal detection to identify hallucinations.
 *
 * Core functionality:
 * - 4 essential self-check questions (tests, requirements, assumptions, evidence)
 * - 7+ danger signal patterns for hallucination detection
 * - Context extraction for detected signals
 * - Configurable questions and signals
 */

import type {
  Evidence,
  SelfCheckQuestion,
  DangerSignal,
  SelfCheckResult,
  ISelfCheckProtocol,
} from './interfaces/validation.interface.js';

// ============================================================================
// Constants: 4 Essential Self-Check Questions
// ============================================================================

/**
 * 4 Essential Self-Check Questions (SuperClaude Pattern)
 *
 * 1. tests_pass: All tests passed with actual output
 * 2. requirements_met: All requirements met with specific list
 * 3. no_assumptions: No unverified assumptions
 * 4. evidence_exists: Evidence exists (tests, code changes, etc.)
 */
export const SELF_CHECK_QUESTIONS: SelfCheckQuestion[] = [
  {
    id: 'tests_pass',
    question: '모든 테스트 통과? (실제 출력 필수)',
    validator: async (evidence: Evidence): Promise<boolean> => {
      return evidence.testOutput !== undefined && evidence.testsPassed === true;
    },
    required: true,
  },
  {
    id: 'requirements_met',
    question: '모든 요구사항 충족? (구체적 목록)',
    validator: async (evidence: Evidence): Promise<boolean> => {
      if (!evidence.requirementsList || evidence.requirementsList.length === 0) {
        return false;
      }
      return evidence.requirementsList.every(r => r.met);
    },
    required: true,
  },
  {
    id: 'no_assumptions',
    question: '검증 없는 가정 없음? (문서 제시)',
    validator: async (evidence: Evidence): Promise<boolean> => {
      if (!evidence.assumptions) {
        return true; // No assumptions = pass
      }
      return evidence.assumptions.every(a => a.verified);
    },
    required: true,
  },
  {
    id: 'evidence_exists',
    question: '증거 있음? (테스트 결과, 코드 변경, 검증)',
    validator: async (evidence: Evidence): Promise<boolean> => {
      const hasTestEvidence = evidence.testOutput !== undefined;
      const hasCodeEvidence = evidence.codeChanges !== undefined && evidence.codeChanges.length > 0;
      const hasOtherEvidence = evidence.evidence !== undefined && evidence.evidence.length > 0;
      return hasTestEvidence || hasCodeEvidence || hasOtherEvidence;
    },
    required: true,
  },
];

// ============================================================================
// Constants: 7 Danger Signals
// ============================================================================

/**
 * 7 Danger Signal Patterns (SuperClaude Pattern)
 *
 * Detects uncertain/subjective language that may indicate hallucination
 */
export const DANGER_SIGNALS: DangerSignal[] = [
  {
    pattern: /should work/i,
    severity: 'warning',
    message: '불확실한 표현 감지: "should work"',
  },
  {
    pattern: /probably/i,
    severity: 'warning',
    message: '불확실한 표현 감지: "probably"',
  },
  {
    pattern: /I believe/i,
    severity: 'warning',
    message: '주관적 표현 감지: "I believe"',
  },
  {
    pattern: /I think/i,
    severity: 'warning',
    message: '주관적 표현 감지: "I think"',
  },
  {
    pattern: /typically/i,
    severity: 'warning',
    message: '일반화 표현 감지: "typically"',
  },
  {
    pattern: /usually/i,
    severity: 'warning',
    message: '일반화 표현 감지: "usually"',
  },
  {
    pattern: /without concrete evidence/i,
    severity: 'error',
    message: '증거 없는 주장 감지',
  },
];

/**
 * Extended Danger Signals (Additional Patterns)
 */
export const EXTENDED_DANGER_SIGNALS: DangerSignal[] = [
  ...DANGER_SIGNALS,
  {
    pattern: /might be/i,
    severity: 'warning',
    message: '불확실한 표현 감지: "might be"',
  },
  {
    pattern: /could be/i,
    severity: 'warning',
    message: '불확실한 표현 감지: "could be"',
  },
  {
    pattern: /perhaps/i,
    severity: 'warning',
    message: '불확실한 표현 감지: "perhaps"',
  },
  {
    pattern: /assume/i,
    severity: 'warning',
    message: '가정 표현 감지: "assume"',
  },
  {
    pattern: /TODO|FIXME|HACK/i,
    severity: 'error',
    message: '미완성 마커 감지',
  },
];

// ============================================================================
// Implementation
// ============================================================================

/**
 * SelfCheckProtocol Implementation
 *
 * Validates task completion through systematic self-check questions
 * and danger signal detection.
 */
export class SelfCheckProtocol implements ISelfCheckProtocol {
  private questions: SelfCheckQuestion[];
  private dangerSignals: DangerSignal[];

  constructor(options?: {
    questions?: SelfCheckQuestion[];
    dangerSignals?: DangerSignal[];
  }) {
    this.questions = options?.questions ?? [];
    this.dangerSignals = options?.dangerSignals ?? [];
  }

  /**
   * Run self-check after task execution
   */
  async check(evidence: Evidence): Promise<SelfCheckResult> {
    // 1. Execute all question validators in parallel
    const questionResults = await Promise.all(
      this.questions.map(async (q) => {
        let passed = false;
        try {
          passed = await q.validator(evidence);
        } catch {
          // Validator errors are treated as failures
          passed = false;
        }
        return {
          id: q.id,
          passed,
          evidence: this.getEvidenceForQuestion(q.id, evidence),
        };
      })
    );

    // 2. Scan for danger signals
    const textToScan = this.collectTextForScan(evidence);
    const foundSignals = this.scanForDangerSignals(textToScan);

    // 3. Build danger signal results
    const dangerSignalResults = this.dangerSignals.map(signal => ({
      signal: signal.message,
      found: foundSignals.some(s => s.signal === signal.message),
      context: foundSignals.find(s => s.signal === signal.message)?.context,
    }));

    // 4. Determine overall pass/fail
    const requiredQuestionsPassed = this.questions
      .filter(q => q.required)
      .every(q => questionResults.find(r => r.id === q.id)?.passed);

    const noErrorSignals = !foundSignals.some(found => {
      const signal = this.dangerSignals.find(s => s.message === found.signal);
      return signal?.severity === 'error';
    });

    const passed = requiredQuestionsPassed && noErrorSignals;

    return {
      passed,
      questions: questionResults,
      dangerSignals: dangerSignalResults,
    };
  }

  /**
   * Scan text for danger signals
   */
  scanForDangerSignals(text: string): { signal: string; context: string }[] {
    const results: { signal: string; context: string }[] = [];

    for (const signal of this.dangerSignals) {
      const match = text.match(signal.pattern);
      if (match) {
        // Extract context around matched pattern
        const index = match.index ?? 0;
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + match[0].length + 50);
        const context = text.substring(start, end);

        results.push({
          signal: signal.message,
          context: start > 0 || end < text.length ? `...${context}...` : context,
        });
      }
    }

    return results;
  }

  /**
   * Configure questions
   */
  setQuestions(questions: SelfCheckQuestion[]): void {
    this.questions = questions;
  }

  /**
   * Configure danger signals
   */
  setDangerSignals(signals: DangerSignal[]): void {
    this.dangerSignals = signals;
  }

  /**
   * Get evidence string for a specific question
   */
  private getEvidenceForQuestion(questionId: string, evidence: Evidence): string {
    switch (questionId) {
      case 'tests_pass':
        return evidence.testOutput ?? 'No test output';
      case 'requirements_met':
        return JSON.stringify(evidence.requirementsList ?? []);
      case 'no_assumptions':
        return JSON.stringify(evidence.assumptions ?? []);
      case 'evidence_exists':
        return `Tests: ${!!evidence.testOutput}, Code: ${evidence.codeChanges?.length ?? 0} files, Other: ${evidence.evidence?.length ?? 0}`;
      default:
        return '';
    }
  }

  /**
   * Collect all text for danger signal scanning
   */
  private collectTextForScan(evidence: Evidence): string {
    const parts: string[] = [];

    if (evidence.testOutput) {
      parts.push(evidence.testOutput);
    }

    if (evidence.evidence) {
      parts.push(...evidence.evidence.map(e => e.content));
    }

    if (evidence.assumptions) {
      parts.push(...evidence.assumptions.map(a => a.assumption));
    }

    return parts.join('\n');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Options for creating a SelfCheckProtocol
 */
export interface SelfCheckProtocolOptions {
  /** Custom questions (defaults to empty) */
  questions?: SelfCheckQuestion[];
  /** Custom danger signals (defaults to empty) */
  dangerSignals?: DangerSignal[];
}

/**
 * Factory function to create a SelfCheckProtocol instance
 *
 * @example
 * ```typescript
 * // Create with custom configuration
 * const protocol = createSelfCheckProtocol({
 *   questions: SELF_CHECK_QUESTIONS,
 *   dangerSignals: DANGER_SIGNALS,
 * });
 * ```
 */
export function createSelfCheckProtocol(
  options?: SelfCheckProtocolOptions
): SelfCheckProtocol {
  return new SelfCheckProtocol(options);
}

/**
 * Factory function to create a SelfCheckProtocol with default configuration
 *
 * Uses SELF_CHECK_QUESTIONS (4 questions) and DANGER_SIGNALS (7 signals)
 *
 * @example
 * ```typescript
 * const protocol = createDefaultSelfCheckProtocol();
 * const result = await protocol.check(evidence);
 * ```
 */
export function createDefaultSelfCheckProtocol(): SelfCheckProtocol {
  return createSelfCheckProtocol({
    questions: SELF_CHECK_QUESTIONS,
    dangerSignals: DANGER_SIGNALS,
  });
}

// ============================================================================
// Barrel Export
// ============================================================================

export default SelfCheckProtocol;
