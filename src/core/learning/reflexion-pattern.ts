/**
 * F004-ReflexionPattern: Error Learning System
 *
 * Provides error-driven learning with solution caching.
 * - Cache hit: 0 tokens (instant solution retrieval)
 * - Cache miss: Learn and store for future retrieval
 * - Target: Error recurrence rate < 10%
 *
 * Source: SuperClaude ReflexionPattern
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type {
  IReflexionPattern,
  LearnedSolution,
} from './interfaces/learning.interface';
import {
  generateErrorSignature,
  classifyError,
} from './learning-utils';

// ============================================================================
// Constants: Storage Configuration
// ============================================================================

/**
 * Storage configuration for ReflexionPattern
 */
export const STORAGE_CONFIG = {
  /** Default storage file path */
  filePath: 'docs/memory/solutions_learned.jsonl',
  /** Maximum number of stored solutions */
  maxEntries: 1000,
  /** Retention period in days */
  retentionDays: 365,
  /** Enable backup on save */
  enableBackup: true,
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * Options for ReflexionPattern
 */
export interface ReflexionPatternOptions {
  /** Custom storage file path */
  filePath?: string;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * ReflexionPattern Implementation
 *
 * Error learning system that caches solutions for fast retrieval.
 * Uses error signature matching for similar error detection.
 */
export class ReflexionPattern implements IReflexionPattern {
  private solutions: Map<string, LearnedSolution> = new Map();
  private filePath: string;
  private lookupCount: number = 0;
  private hitCount: number = 0;
  private initialized: boolean = false;

  constructor(options?: ReflexionPatternOptions) {
    this.filePath = options?.filePath ?? STORAGE_CONFIG.filePath;
  }

  /**
   * Initialize - load existing solutions from file
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        const solution = JSON.parse(line) as LearnedSolution;
        // Convert date strings back to Date objects
        solution.createdAt = new Date(solution.createdAt);
        if (solution.lastUsedAt) {
          solution.lastUsedAt = new Date(solution.lastUsedAt);
        }
        this.solutions.set(solution.errorSignature, solution);
      }

      this.initialized = true;
    } catch (error) {
      // File doesn't exist - start with empty state
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.initialized = true;
        return;
      }
      // Re-throw other errors (e.g., malformed JSON)
      throw error;
    }
  }

  /**
   * Look up existing solution for error
   */
  async lookup(error: Error): Promise<LearnedSolution | null> {
    this.lookupCount++;

    const signature = generateErrorSignature(error);
    const solution = this.solutions.get(signature);

    if (solution) {
      this.hitCount++;
      // Update last used time
      solution.lastUsedAt = new Date();
      return solution;
    }

    return null;
  }

  /**
   * Learn from new error resolution
   */
  async learn(error: Error, solution: string, rootCause: string): Promise<void> {
    const signature = generateErrorSignature(error);
    const errorType = classifyError(error);

    const learned: LearnedSolution = {
      id: randomUUID(),
      errorType,
      errorMessage: error.message,
      errorSignature: signature,
      rootCause,
      solution,
      prevention: this.generatePreventionChecklist(errorType, rootCause),
      createdAt: new Date(),
      successCount: 0,
      failureCount: 0,
      tags: [errorType],
    };

    // Store in memory
    this.solutions.set(signature, learned);

    // Persist to file
    await this.appendToFile(learned);
  }

  /**
   * Get prevention checklist for error type
   */
  getPreventionChecklist(errorType: string): string[] {
    const defaultChecklist = [
      '유사 에러 발생 여부 확인',
      '코드 변경 전 테스트 작성',
      '변경 후 전체 테스트 실행',
    ];

    const typeSpecificChecklist: Record<string, string[]> = {
      TYPE: [
        '타입 정의 확인',
        'null/undefined 체크 추가',
        'TypeScript strict 모드 활성화',
      ],
      NETWORK: [
        '네트워크 타임아웃 설정 확인',
        '재시도 로직 구현',
        '오프라인 처리 추가',
      ],
      FILE: [
        '파일 경로 존재 확인',
        '권한 설정 확인',
        '에러 핸들링 추가',
      ],
      AUTH: [
        '토큰 만료 처리 확인',
        '권한 검증 로직 확인',
        '보안 로깅 추가',
      ],
      SYNTAX: [
        '린터 설정 확인',
        'IDE 자동 포맷팅 활성화',
        '코드 리뷰 체크리스트 확인',
      ],
      RUNTIME: [
        '변수 초기화 확인',
        '범위 체크 추가',
        '예외 처리 보강',
      ],
      VALIDATION: [
        '입력 유효성 검사 추가',
        '스키마 검증 로직 확인',
        '에러 메시지 개선',
      ],
      CONFIG: [
        '환경 변수 확인',
        '설정 파일 존재 확인',
        '기본값 설정 추가',
      ],
    };

    return [...defaultChecklist, ...(typeSpecificChecklist[errorType] ?? [])];
  }

  /**
   * Record outcome of solution application
   */
  async recordOutcome(solutionId: string, success: boolean): Promise<void> {
    for (const solution of this.solutions.values()) {
      if (solution.id === solutionId) {
        if (success) {
          solution.successCount++;
        } else {
          solution.failureCount++;
        }
        // Persist changes
        await this.saveToFile();
        return;
      }
    }
    // Solution not found - silently ignore (as per spec)
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalSolutions: number;
    totalLookups: number;
    cacheHitRate: number;
    avgSuccessRate: number;
  }> {
    let totalSuccess = 0;
    let totalAttempts = 0;

    for (const solution of this.solutions.values()) {
      totalSuccess += solution.successCount;
      totalAttempts += solution.successCount + solution.failureCount;
    }

    return {
      totalSolutions: this.solutions.size,
      totalLookups: this.lookupCount,
      cacheHitRate: this.lookupCount > 0 ? this.hitCount / this.lookupCount : 0,
      avgSuccessRate: totalAttempts > 0 ? totalSuccess / totalAttempts : 0,
    };
  }

  /**
   * Generate prevention checklist based on error type and root cause
   */
  private generatePreventionChecklist(errorType: string, rootCause: string): string[] {
    const baseChecklist = this.getPreventionChecklist(errorType);

    // Add root cause specific items
    const rootCauseBased: string[] = [];

    if (rootCause.toLowerCase().includes('null') || rootCause.toLowerCase().includes('undefined')) {
      rootCauseBased.push('null/undefined 방어 코드 추가');
    }
    if (rootCause.toLowerCase().includes('async') || rootCause.toLowerCase().includes('await')) {
      rootCauseBased.push('비동기 에러 핸들링 확인');
    }
    if (rootCause.toLowerCase().includes('timeout') || rootCause.toLowerCase().includes('시간')) {
      rootCauseBased.push('타임아웃 설정 조정');
    }
    if (rootCause.toLowerCase().includes('permission') || rootCause.toLowerCase().includes('권한')) {
      rootCauseBased.push('권한 설정 확인');
    }

    return [...baseChecklist, ...rootCauseBased];
  }

  /**
   * Append solution to file (JSONL format)
   */
  private async appendToFile(solution: LearnedSolution): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(this.filePath, JSON.stringify(solution) + '\n');
  }

  /**
   * Save all solutions to file (full rewrite)
   */
  private async saveToFile(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    const content = Array.from(this.solutions.values())
      .map((s) => JSON.stringify(s))
      .join('\n');

    await fs.writeFile(this.filePath, content + '\n');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Factory function to create and initialize a ReflexionPattern instance
 *
 * @example
 * ```typescript
 * // Create with default options
 * const reflexion = await createReflexionPattern();
 *
 * // Create with custom file path
 * const reflexion = await createReflexionPattern({
 *   filePath: '/custom/path/solutions.jsonl',
 * });
 *
 * // Use the instance
 * const existingSolution = await reflexion.lookup(error);
 * if (!existingSolution) {
 *   await reflexion.learn(error, solution, rootCause);
 * }
 * ```
 */
export async function createReflexionPattern(
  options?: ReflexionPatternOptions
): Promise<ReflexionPattern> {
  const pattern = new ReflexionPattern(options);
  await pattern.initialize();
  return pattern;
}

// ============================================================================
// Barrel Export
// ============================================================================

export default ReflexionPattern;
