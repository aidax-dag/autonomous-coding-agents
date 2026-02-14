/**
 * Conflict Resolver
 *
 * Parses git merge conflict markers and applies resolution strategies
 * based on content analysis. Supports auto-merge for simple additions
 * and non-overlapping changes with confidence scoring.
 *
 * @module core/git-workflow
 */

import type {
  ConflictInfo,
  ConflictResolutionResult,
  GitWorkflowConfig,
} from './types';

// ============================================================================
// Conflict Marker Pattern
// ============================================================================

const CONFLICT_START = /^<{7}\s/;
const CONFLICT_SEPARATOR = /^={7}$/;
const CONFLICT_END = /^>{7}\s/;

// ============================================================================
// Conflict Resolver
// ============================================================================

export class ConflictResolver {
  private config: GitWorkflowConfig;

  constructor(config: GitWorkflowConfig) {
    this.config = config;
  }

  /**
   * Parse git conflict markers from file content into structured ConflictInfo objects.
   * The filePath on each result defaults to 'unknown'; callers should override it.
   */
  parseConflicts(content: string, filePath: string = 'unknown'): ConflictInfo[] {
    const lines = content.split('\n');
    const conflicts: ConflictInfo[] = [];

    let i = 0;
    while (i < lines.length) {
      if (CONFLICT_START.test(lines[i])) {
        const startLine = i;
        const oursLines: string[] = [];
        const theirsLines: string[] = [];
        let separatorLine = -1;
        let endLine = -1;

        i++;
        // Collect "ours" content
        while (i < lines.length && !CONFLICT_SEPARATOR.test(lines[i])) {
          oursLines.push(lines[i]);
          i++;
        }

        if (i < lines.length) {
          separatorLine = i;
          i++;
        }

        // Collect "theirs" content
        while (i < lines.length && !CONFLICT_END.test(lines[i])) {
          theirsLines.push(lines[i]);
          i++;
        }

        if (i < lines.length) {
          endLine = i;
          i++;
        }

        conflicts.push({
          filePath,
          conflictType: 'content',
          oursContent: oursLines.join('\n'),
          theirsContent: theirsLines.join('\n'),
          markers: {
            start: startLine,
            separator: separatorLine,
            end: endLine,
          },
        });
      } else {
        i++;
      }
    }

    return conflicts;
  }

  /**
   * Attempt to resolve a single conflict using available strategies.
   */
  resolveConflict(conflict: ConflictInfo): ConflictResolutionResult {
    // Binary conflicts always require manual resolution
    if (conflict.conflictType === 'binary') {
      return {
        filePath: conflict.filePath,
        resolution: 'manual',
        resolvedContent: '',
        confidence: 0,
        reasoning: 'Binary conflicts require manual resolution',
      };
    }

    // Try auto-merge strategies
    const autoResult = this.tryAutoMerge(conflict);
    if (autoResult) {
      return autoResult;
    }

    // Fall back to content-based resolution
    return this.resolveByContent(conflict);
  }

  /**
   * Resolve all conflicts in a batch.
   */
  resolveAll(conflicts: ConflictInfo[]): ConflictResolutionResult[] {
    return conflicts.map((c) => this.resolveConflict(c));
  }

  // ==========================================================================
  // Resolution Strategies
  // ==========================================================================

  /**
   * Attempt auto-merge for simple, non-conflicting changes.
   */
  private tryAutoMerge(conflict: ConflictInfo): ConflictResolutionResult | null {
    if (!this.config.autoResolveConflicts) {
      return null;
    }

    // Simple addition: one side is empty, other adds content
    if (this.isSimpleAddition(conflict.oursContent, conflict.theirsContent, conflict.baseContent)) {
      const resolvedContent = conflict.oursContent || conflict.theirsContent;
      const confidence = this.calculateResolutionConfidence(conflict, resolvedContent);

      if (confidence >= this.config.conflictConfidenceThreshold) {
        return {
          filePath: conflict.filePath,
          resolution: 'merged',
          resolvedContent,
          confidence,
          reasoning: 'Simple addition: one side added content while the other had no changes',
        };
      }
    }

    // Non-overlapping: both sides changed different content
    if (this.isNonOverlapping(conflict.oursContent, conflict.theirsContent)) {
      const resolvedContent = conflict.oursContent + '\n' + conflict.theirsContent;
      const confidence = this.calculateResolutionConfidence(conflict, resolvedContent);

      if (confidence >= this.config.conflictConfidenceThreshold) {
        return {
          filePath: conflict.filePath,
          resolution: 'merged',
          resolvedContent,
          confidence,
          reasoning: 'Non-overlapping changes merged: both sides modified different content',
        };
      }
    }

    return null;
  }

  /**
   * Content-based resolution when auto-merge is not possible.
   * Prefers "ours" by default but with lower confidence.
   */
  private resolveByContent(conflict: ConflictInfo): ConflictResolutionResult {
    // If both sides are identical, trivial resolution
    if (conflict.oursContent === conflict.theirsContent) {
      return {
        filePath: conflict.filePath,
        resolution: 'merged',
        resolvedContent: conflict.oursContent,
        confidence: 1.0,
        reasoning: 'Both sides contain identical content',
      };
    }

    // Default: mark as manual since we cannot confidently resolve
    return {
      filePath: conflict.filePath,
      resolution: 'manual',
      resolvedContent: '',
      confidence: 0.3,
      reasoning: 'Conflicting changes detected; manual resolution recommended',
    };
  }

  // ==========================================================================
  // Content Analysis
  // ==========================================================================

  /**
   * Check if the conflict is a simple addition (one side empty, other has content).
   */
  private isSimpleAddition(ours: string, theirs: string, base?: string): boolean {
    const oursEmpty = ours.trim() === '';
    const theirsEmpty = theirs.trim() === '';

    // One side must be empty and the other must have content
    if (oursEmpty && !theirsEmpty) return true;
    if (!oursEmpty && theirsEmpty) return true;

    // If base is provided and one side matches base (no change), treat as simple addition
    if (base !== undefined) {
      if (ours.trim() === base.trim() && theirs.trim() !== base.trim()) return true;
      if (theirs.trim() === base.trim() && ours.trim() !== base.trim()) return true;
    }

    return false;
  }

  /**
   * Check if two changes are non-overlapping (no shared lines).
   */
  private isNonOverlapping(ours: string, theirs: string): boolean {
    if (ours.trim() === '' || theirs.trim() === '') return false;

    const oursLines = new Set(ours.split('\n').map((l) => l.trim()).filter(Boolean));
    const theirsLines = new Set(theirs.split('\n').map((l) => l.trim()).filter(Boolean));

    // Check for any shared non-empty lines
    for (const line of oursLines) {
      if (theirsLines.has(line)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Calculate confidence for a proposed resolution.
   */
  private calculateResolutionConfidence(conflict: ConflictInfo, _resolution: string): number {
    let confidence = 0.7; // base for auto-resolved

    // Simple additions are highly confident
    if (this.isSimpleAddition(conflict.oursContent, conflict.theirsContent, conflict.baseContent)) {
      confidence = 0.9;
    }

    // Non-overlapping is moderately confident
    if (this.isNonOverlapping(conflict.oursContent, conflict.theirsContent)) {
      confidence = 0.8;
    }

    // Having base content increases confidence
    if (conflict.baseContent !== undefined) {
      confidence = Math.min(confidence + 0.05, 0.95);
    }

    return Math.round(confidence * 100) / 100;
  }
}
