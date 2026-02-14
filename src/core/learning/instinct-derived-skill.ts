/**
 * Instinct-Derived Skill
 *
 * A skill implementation automatically derived from instinct clusters.
 * Wraps instinct patterns and actions into an ISkill-compatible object
 * for registration in the SkillRegistry.
 *
 * @module core/learning
 */

import type { InstinctRecord } from './instinct-export';
import type { SkillDefinition } from './instinct-clustering';
import type {
  ISkill,
  SkillContext,
  SkillResult,
} from '../skills/interfaces/skill.interface';

// ============================================================================
// Types
// ============================================================================

export interface InstinctDerivedSkillInput {
  /** Context to match against patterns */
  context: string;
  /** Optional task description */
  task?: string;
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
}

export interface InstinctDerivedSkillOutput {
  /** Which patterns matched the input context */
  matchedPatterns: string[];
  /** Actions from matching instincts */
  suggestedActions: string[];
  /** Average confidence of matches */
  confidence: number;
  /** Number of source instincts that contributed */
  sourceInstinctCount: number;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * A skill automatically derived from instinct clusters.
 * Implements ISkill interface for SkillRegistry compatibility.
 *
 * execute() matches input context against stored patterns
 * and returns suggested actions from the source instincts.
 */
export class InstinctDerivedSkill
  implements ISkill<InstinctDerivedSkillInput, InstinctDerivedSkillOutput>
{
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly version: string;

  constructor(
    private readonly definition: SkillDefinition,
    private readonly sourceInstincts: InstinctRecord[],
    version?: string
  ) {
    this.name = definition.name;
    this.description = definition.description;
    this.tags = Object.freeze([...definition.tags]);
    this.version = version ?? '1.0.0-auto';
  }

  /**
   * Validate that input has a non-empty context string.
   */
  validate(input: InstinctDerivedSkillInput): boolean {
    if (!input || typeof input.context !== 'string' || input.context.trim().length === 0) {
      return false;
    }
    return true;
  }

  /**
   * Check if this skill can handle the given input by matching
   * any stored pattern against the input context using keyword matching.
   */
  canHandle(input: unknown, _context: SkillContext): boolean {
    if (!input || typeof input !== 'object') {
      return false;
    }

    const typed = input as Record<string, unknown>;
    if (typeof typed.context !== 'string') {
      return false;
    }

    const contextLower = typed.context.toLowerCase();
    return this.definition.patterns.some((pattern) => {
      const patternWords = pattern.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      return patternWords.some((word) => contextLower.includes(word));
    });
  }

  /**
   * Execute the skill by matching input context against stored patterns,
   * collecting actions from matching source instincts, and calculating
   * confidence from the matching instincts.
   */
  async execute(
    input: InstinctDerivedSkillInput,
    _context: SkillContext
  ): Promise<SkillResult<InstinctDerivedSkillOutput>> {
    const start = Date.now();

    if (!this.validate(input)) {
      return {
        success: false,
        error: 'Invalid input: context string is required',
        duration: Date.now() - start,
      };
    }

    const contextLower = input.context.toLowerCase();
    const matchedPatterns: string[] = [];
    const suggestedActions: string[] = [];
    const matchedConfidences: number[] = [];

    for (let i = 0; i < this.definition.patterns.length; i++) {
      const pattern = this.definition.patterns[i];
      const patternWords = pattern.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const matches = patternWords.some((word) => contextLower.includes(word));

      if (matches) {
        matchedPatterns.push(pattern);

        // Collect action and confidence from the corresponding source instinct
        if (i < this.sourceInstincts.length) {
          const instinct = this.sourceInstincts[i];
          if (!suggestedActions.includes(instinct.action)) {
            suggestedActions.push(instinct.action);
          }
          matchedConfidences.push(instinct.confidence);
        }
      }
    }

    const confidence =
      matchedConfidences.length > 0
        ? matchedConfidences.reduce((sum, c) => sum + c, 0) / matchedConfidences.length
        : 0;

    return {
      success: true,
      output: {
        matchedPatterns,
        suggestedActions,
        confidence,
        sourceInstinctCount: matchedConfidences.length,
      },
      duration: Date.now() - start,
      metadata: {
        totalPatterns: this.definition.patterns.length,
        totalSourceInstincts: this.sourceInstincts.length,
      },
    };
  }
}
