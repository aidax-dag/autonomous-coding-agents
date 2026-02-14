/**
 * Branch Strategist
 *
 * Analyzes task descriptions and changed files to recommend
 * an appropriate git branching strategy, branch name, and base branch.
 *
 * @module core/git-workflow
 */

import type { BranchStrategy, BranchRecommendation, GitWorkflowConfig } from './types';

// ============================================================================
// Strategy Detection Patterns
// ============================================================================

const STRATEGY_PATTERNS: ReadonlyArray<{ strategy: BranchStrategy; keywords: string[] }> = [
  { strategy: 'hotfix', keywords: ['hotfix', 'urgent', 'critical', 'patch', 'emergency'] },
  { strategy: 'bugfix', keywords: ['fix', 'bug', 'error', 'crash', 'issue', 'broken', 'fault'] },
  { strategy: 'release', keywords: ['release', 'version', 'v1.', 'v2.', 'v3.', 'v0.'] },
  { strategy: 'refactor', keywords: ['refactor', 'cleanup', 'reorganize', 'restructure', 'rewrite', 'simplify'] },
  { strategy: 'docs', keywords: ['doc', 'readme', 'changelog', 'guide', 'documentation', 'comment'] },
  { strategy: 'test', keywords: ['test', 'spec', 'coverage', 'e2e', 'unit test', 'integration test'] },
];

const FILE_STRATEGY_HINTS: ReadonlyArray<{ strategy: BranchStrategy; patterns: RegExp[] }> = [
  { strategy: 'docs', patterns: [/\.md$/i, /docs\//i, /README/i, /CHANGELOG/i] },
  { strategy: 'test', patterns: [/\.test\.[jt]sx?$/i, /\.spec\.[jt]sx?$/i, /tests?\//i, /__tests__\//i] },
  { strategy: 'refactor', patterns: [] },
];

// ============================================================================
// Branch Strategist
// ============================================================================

export class BranchStrategist {
  private config: GitWorkflowConfig;

  constructor(config: GitWorkflowConfig) {
    this.config = config;
  }

  /**
   * Analyze a task description and optional changed files to produce
   * a branch recommendation with confidence scoring.
   */
  recommend(description: string, changedFiles?: string[]): BranchRecommendation {
    const strategy = this.detectStrategy(description, changedFiles);
    const branchName = this.generateBranchName(strategy, description);
    const baseBranch = this.determineBaseBranch(strategy);
    const confidence = this.calculateConfidence(description, strategy, changedFiles);

    return {
      strategy,
      branchName,
      baseBranch,
      confidence,
      reasoning: this.buildReasoning(strategy, description, changedFiles),
    };
  }

  // ==========================================================================
  // Analysis Methods
  // ==========================================================================

  private detectStrategy(description: string, changedFiles?: string[]): BranchStrategy {
    const lower = description.toLowerCase();

    // Check description keywords (ordered by specificity)
    for (const { strategy, keywords } of STRATEGY_PATTERNS) {
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          return strategy;
        }
      }
    }

    // Check file-based hints when description is ambiguous
    if (changedFiles && changedFiles.length > 0) {
      const fileStrategy = this.detectFromFiles(changedFiles);
      if (fileStrategy) {
        return fileStrategy;
      }
    }

    // Default to feature
    return 'feature';
  }

  private detectFromFiles(files: string[]): BranchStrategy | null {
    const counts = new Map<BranchStrategy, number>();

    for (const file of files) {
      for (const { strategy, patterns } of FILE_STRATEGY_HINTS) {
        for (const pattern of patterns) {
          if (pattern.test(file)) {
            counts.set(strategy, (counts.get(strategy) ?? 0) + 1);
          }
        }
      }
    }

    if (counts.size === 0) return null;

    // Return strategy with highest file match count
    let best: BranchStrategy | null = null;
    let bestCount = 0;
    for (const [strategy, count] of counts) {
      if (count > bestCount) {
        best = strategy;
        bestCount = count;
      }
    }
    return best;
  }

  private generateBranchName(strategy: BranchStrategy, description: string): string {
    const slug = this.slugify(description);
    const truncated = this.truncate(slug, 50);

    if (this.config.branchPrefix) {
      return `${strategy}/${truncated}`;
    }
    return truncated;
  }

  private determineBaseBranch(strategy: BranchStrategy): string {
    // Hotfixes branch from main/production, everything else from default
    if (strategy === 'hotfix') {
      return this.config.defaultBaseBranch;
    }
    if (strategy === 'release') {
      return this.config.defaultBaseBranch;
    }
    return this.config.defaultBaseBranch;
  }

  private calculateConfidence(
    description: string,
    strategy: BranchStrategy,
    changedFiles?: string[],
  ): number {
    const lower = description.toLowerCase();
    let confidence = 0.5; // base confidence for default (feature)

    // Exact keyword match boosts confidence
    for (const { strategy: s, keywords } of STRATEGY_PATTERNS) {
      if (s === strategy) {
        const matchCount = keywords.filter((k) => lower.includes(k)).length;
        if (matchCount > 0) {
          confidence = 0.7 + Math.min(matchCount * 0.1, 0.25);
        }
        break;
      }
    }

    // File-based confirmation boosts confidence
    if (changedFiles && changedFiles.length > 0) {
      for (const { strategy: s, patterns } of FILE_STRATEGY_HINTS) {
        if (s === strategy) {
          const fileMatches = changedFiles.filter((f) =>
            patterns.some((p) => p.test(f)),
          ).length;
          if (fileMatches > 0) {
            confidence = Math.min(confidence + 0.1, 0.95);
          }
          break;
        }
      }
    }

    return Math.round(confidence * 100) / 100;
  }

  private buildReasoning(
    strategy: BranchStrategy,
    description: string,
    changedFiles?: string[],
  ): string {
    const lower = description.toLowerCase();
    const matchedKeywords: string[] = [];

    for (const { strategy: s, keywords } of STRATEGY_PATTERNS) {
      if (s === strategy) {
        for (const keyword of keywords) {
          if (lower.includes(keyword)) {
            matchedKeywords.push(keyword);
          }
        }
        break;
      }
    }

    if (matchedKeywords.length > 0) {
      return `Detected '${strategy}' strategy from keywords: ${matchedKeywords.join(', ')}`;
    }

    if (changedFiles && changedFiles.length > 0) {
      return `Detected '${strategy}' strategy from file patterns in changed files`;
    }

    return `Defaulted to '${strategy}' strategy (no specific keywords matched)`;
  }

  // ==========================================================================
  // Name Helpers
  // ==========================================================================

  /**
   * Convert a description to a URL-safe slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Truncate text to maxLength, breaking at word boundaries
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    const truncated = text.slice(0, maxLength);
    const lastDash = truncated.lastIndexOf('-');
    if (lastDash > maxLength * 0.5) {
      return truncated.slice(0, lastDash);
    }
    return truncated;
  }
}
