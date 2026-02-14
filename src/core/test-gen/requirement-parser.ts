/**
 * Requirement Parser
 *
 * Parses natural language text into structured requirement objects.
 * Supports numbered lists, bullet points, Given/When/Then format,
 * and should/must/shall patterns for requirement extraction.
 *
 * @module core/test-gen/requirement-parser
 */

import type { Requirement } from './types';

/** Keywords that indicate test-relevant concerns */
interface DetectedKeywords {
  shouldTest: string[];
  edgeCases: string[];
  securityConcerns: string[];
}

/** Patterns for splitting requirements from text */
const NUMBERED_PATTERN = /^\s*\d+[.)]\s+/;
const BULLET_PATTERN = /^\s*[-*]\s+/;
const GIVEN_WHEN_THEN_PATTERN = /\b(given|when|then)\b/i;
const REQUIREMENT_VERB_PATTERN = /\b(should|must|shall|can|will|needs?\s+to)\b/i;

/** Category keyword maps */
const SECURITY_KEYWORDS = ['security', 'auth', 'encrypt', 'password', 'token', 'permission', 'access control', 'vulnerability', 'sanitize', 'injection'];
const PERFORMANCE_KEYWORDS = ['performance', 'latency', 'throughput', 'response time', 'load', 'scalab', 'concurrent', 'cache', 'optimize'];
const EDGE_CASE_KEYWORDS = ['edge case', 'boundary', 'empty', 'null', 'undefined', 'zero', 'negative', 'overflow', 'maximum', 'minimum', 'invalid', 'malformed', 'special character'];
const HIGH_PRIORITY_KEYWORDS = ['must', 'critical', 'required', 'essential', 'shall', 'mandatory'];
const LOW_PRIORITY_KEYWORDS = ['optional', 'nice to have', 'could', 'may', 'ideally'];

/**
 * Requirement Parser
 *
 * Extracts and classifies requirements from natural language input.
 */
export class RequirementParser {
  private idCounter = 0;

  /**
   * Parse a block of natural language text into structured requirements.
   */
  parseRequirements(text: string): Requirement[] {
    const rawSegments = this.splitRequirements(text);
    const requirements: Requirement[] = [];

    for (const segment of rawSegments) {
      const trimmed = segment.trim();
      if (!trimmed || trimmed.length < 5) continue;

      this.idCounter++;
      const id = `REQ-${String(this.idCounter).padStart(3, '0')}`;
      const category = this.categorize(trimmed);
      const priority = this.prioritize(trimmed);
      const acceptanceCriteria = this.extractAcceptanceCriteria(trimmed);

      requirements.push({
        id,
        text: trimmed,
        category,
        priority,
        acceptanceCriteria,
      });
    }

    return requirements;
  }

  /**
   * Split raw text into individual requirement segments.
   */
  private splitRequirements(text: string): string[] {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    // Check if lines follow numbered/bullet patterns
    const hasNumbered = lines.some((l) => NUMBERED_PATTERN.test(l));
    const hasBullets = lines.some((l) => BULLET_PATTERN.test(l));

    if (hasNumbered || hasBullets) {
      return lines
        .filter((l) => NUMBERED_PATTERN.test(l) || BULLET_PATTERN.test(l))
        .map((l) => l.replace(NUMBERED_PATTERN, '').replace(BULLET_PATTERN, '').trim());
    }

    // Check for Given/When/Then blocks
    if (GIVEN_WHEN_THEN_PATTERN.test(text)) {
      return this.splitGivenWhenThen(text);
    }

    // Fall back to sentence splitting on requirement verbs
    const sentences = text.split(/[.;]\s+/).filter((s) => s.trim().length > 5);
    if (sentences.length > 1) {
      return sentences.map((s) => s.trim().replace(/\.$/, ''));
    }

    return [text.trim()];
  }

  /**
   * Split Given/When/Then blocks into requirement segments.
   */
  private splitGivenWhenThen(text: string): string[] {
    const blocks: string[] = [];
    const segments = text.split(/\b(?=given\b)/i);
    for (const segment of segments) {
      const trimmed = segment.trim();
      if (trimmed && GIVEN_WHEN_THEN_PATTERN.test(trimmed)) {
        blocks.push(trimmed);
      }
    }
    return blocks.length > 0 ? blocks : [text.trim()];
  }

  /**
   * Classify a requirement into a category based on keyword analysis.
   */
  private categorize(text: string): Requirement['category'] {
    const lower = text.toLowerCase();

    if (SECURITY_KEYWORDS.some((kw) => lower.includes(kw))) {
      return 'security';
    }
    if (PERFORMANCE_KEYWORDS.some((kw) => lower.includes(kw))) {
      return 'performance';
    }
    if (EDGE_CASE_KEYWORDS.some((kw) => lower.includes(kw))) {
      return 'edge-case';
    }
    if (REQUIREMENT_VERB_PATTERN.test(text)) {
      return 'functional';
    }
    return 'non-functional';
  }

  /**
   * Assign a priority level based on keyword strength.
   */
  private prioritize(text: string): Requirement['priority'] {
    const lower = text.toLowerCase();

    if (HIGH_PRIORITY_KEYWORDS.some((kw) => lower.includes(kw))) {
      return 'high';
    }
    if (LOW_PRIORITY_KEYWORDS.some((kw) => lower.includes(kw))) {
      return 'low';
    }
    return 'medium';
  }

  /**
   * Extract acceptance criteria from a requirement string.
   * Looks for Given/When/Then clauses, "so that" outcomes, or generates
   * a basic criterion from the requirement text itself.
   */
  extractAcceptanceCriteria(requirement: string): string[] {
    const criteria: string[] = [];
    // Extract Given/When/Then parts
    const givenMatch = requirement.match(/given\s+(.+?)(?=\s+when\b|$)/i);
    const whenMatch = requirement.match(/when\s+(.+?)(?=\s+then\b|$)/i);
    const thenMatch = requirement.match(/then\s+(.+?)$/i);

    if (givenMatch) criteria.push(`Precondition: ${givenMatch[1].trim()}`);
    if (whenMatch) criteria.push(`Action: ${whenMatch[1].trim()}`);
    if (thenMatch) criteria.push(`Expected: ${thenMatch[1].trim()}`);

    if (criteria.length > 0) return criteria;

    // Extract "so that" outcomes
    const soThatMatch = requirement.match(/so\s+that\s+(.+)/i);
    if (soThatMatch) {
      criteria.push(`Outcome: ${soThatMatch[1].trim()}`);
    }

    // Generate basic criteria from the requirement text
    if (criteria.length === 0) {
      const keywords = this.detectKeywords(requirement);
      if (keywords.shouldTest.length > 0) {
        criteria.push(`Verify: ${requirement}`);
      } else {
        criteria.push(`Confirm: ${requirement}`);
      }
    }

    return criteria;
  }

  /**
   * Detect test-relevant keywords in text.
   */
  private detectKeywords(text: string): DetectedKeywords {
    const lower = text.toLowerCase();

    return {
      shouldTest: ['should', 'must', 'shall', 'can', 'will'].filter((kw) => lower.includes(kw)),
      edgeCases: EDGE_CASE_KEYWORDS.filter((kw) => lower.includes(kw)),
      securityConcerns: SECURITY_KEYWORDS.filter((kw) => lower.includes(kw)),
    };
  }
}
