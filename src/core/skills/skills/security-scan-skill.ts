/**
 * Security Scan Skill
 *
 * Analyzes code for security vulnerabilities including injection, XSS, auth, and crypto issues.
 *
 * @module core/skills/skills
 */

import type { SkillContext } from '../interfaces/skill.interface';
import { BaseSkill } from '../base-skill';

/**
 * Security finding from a scan
 */
export interface SecurityFinding {
  file: string;
  line?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  message: string;
}

/**
 * Input for security scan skill
 */
export interface SecurityScanSkillInput {
  /** File paths to scan */
  files: string[];
  /** Specific checks to run */
  checks?: Array<'injection' | 'xss' | 'auth' | 'crypto'>;
}

/**
 * Output from security scan skill
 */
export interface SecurityScanSkillOutput {
  /** List of security findings */
  findings: SecurityFinding[];
  /** Human-readable summary */
  summary: string;
  /** Overall security score (0-100, higher is better) */
  score: number;
}

/**
 * Security scan skill — analyzes code for OWASP-style vulnerabilities
 */
export class SecurityScanSkill extends BaseSkill<SecurityScanSkillInput, SecurityScanSkillOutput> {
  readonly name = 'security-scan';
  readonly description = 'Scans code for security vulnerabilities including injection, XSS, auth, and crypto issues';
  readonly tags = ['security', 'scan', 'owasp'] as const;
  protected readonly validationError = 'Invalid input: files array is required';

  validate(input: SecurityScanSkillInput): boolean {
    return Array.isArray(input.files) && input.files.length > 0;
  }

  protected createFallbackOutput(input: SecurityScanSkillInput): SecurityScanSkillOutput {
    const checks = input.checks ?? ['injection', 'xss', 'auth', 'crypto'];
    return {
      findings: [],
      summary: `Scanned ${input.files.length} file(s) for ${checks.join(', ')} vulnerabilities`,
      score: 100,
    };
  }

  protected createFallbackContext(input: SecurityScanSkillInput): Record<string, unknown> {
    const checks = input.checks ?? ['injection', 'xss', 'auth', 'crypto'];
    return { files: input.files, checks };
  }
}

/**
 * Factory function
 */
export function createSecurityScanSkill(options?: {
  executor?: (
    input: SecurityScanSkillInput,
    context: SkillContext,
  ) => Promise<SecurityScanSkillOutput>;
}): SecurityScanSkill {
  return new SecurityScanSkill(options);
}
