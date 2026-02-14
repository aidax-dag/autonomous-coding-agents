/**
 * Code Chunk Strategy
 *
 * Intelligent code chunking that splits source files into semantically
 * meaningful pieces, respecting function/class boundaries where possible
 * and applying configurable overlap for context preservation.
 *
 * @module core/rag/chunk-strategy
 */

import { randomUUID } from 'crypto';
import type { CodeChunk, ChunkType } from './types';

// ============================================================================
// Boundary Detection Patterns
// ============================================================================

/** Language-agnostic patterns for detecting structural boundaries */
const BOUNDARY_PATTERNS: Record<string, RegExp[]> = {
  typescript: [
    /^(?:export\s+)?(?:async\s+)?function\s+\w+/,
    /^(?:export\s+)?class\s+\w+/,
    /^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(/,
    /^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?function/,
    /^(?:export\s+)?interface\s+\w+/,
    /^(?:export\s+)?type\s+\w+/,
    /^(?:export\s+)?enum\s+\w+/,
    /^import\s+/,
  ],
  javascript: [
    /^(?:export\s+)?(?:async\s+)?function\s+\w+/,
    /^(?:export\s+)?class\s+\w+/,
    /^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(/,
    /^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?function/,
    /^import\s+/,
  ],
  python: [
    /^(?:async\s+)?def\s+\w+/,
    /^class\s+\w+/,
    /^import\s+/,
    /^from\s+\w+\s+import/,
  ],
  default: [
    /^(?:export\s+)?(?:async\s+)?function\s+\w+/,
    /^(?:export\s+)?class\s+\w+/,
    /^import\s+/,
  ],
};

// ============================================================================
// Type Inference Patterns
// ============================================================================

const TYPE_PATTERNS: Array<{ pattern: RegExp; type: ChunkType }> = [
  { pattern: /^(?:export\s+)?class\s+/, type: 'class' },
  { pattern: /^(?:export\s+)?(?:async\s+)?function\s+/, type: 'function' },
  { pattern: /^\s+(?:async\s+)?(?:public|private|protected|static|get|set)?\s*\w+\s*\(/, type: 'method' },
  { pattern: /^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(/, type: 'function' },
  { pattern: /^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?function/, type: 'function' },
  { pattern: /^import\s+/, type: 'import' },
  { pattern: /^from\s+\w+\s+import/, type: 'import' },
  { pattern: /^\/\*\*/, type: 'comment' },
  { pattern: /^\/\//, type: 'comment' },
  { pattern: /^#/, type: 'comment' },
];

const NAME_PATTERNS: Array<{ pattern: RegExp; group: number }> = [
  { pattern: /class\s+(\w+)/, group: 1 },
  { pattern: /function\s+(\w+)/, group: 1 },
  { pattern: /(?:const|let|var)\s+(\w+)\s*=/, group: 1 },
  { pattern: /(?:async\s+)?def\s+(\w+)/, group: 1 },
  { pattern: /(?:public|private|protected|static)?\s*(\w+)\s*\(/, group: 1 },
];

// ============================================================================
// Implementation
// ============================================================================

export class CodeChunkStrategy {
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor(chunkSize: number, chunkOverlap: number) {
    this.chunkSize = Math.max(chunkSize, 50);
    this.chunkOverlap = Math.max(0, Math.min(chunkOverlap, Math.floor(chunkSize / 2)));
  }

  /**
   * Split a source file into semantically meaningful chunks.
   */
  chunkFile(content: string, filePath: string, language: string): CodeChunk[] {
    if (!content || content.trim().length === 0) {
      return [];
    }

    const lines = content.split('\n');
    const boundaries = this.detectBoundaries(content, language);
    const rawChunks = this.splitAtBoundaries(lines, boundaries);
    const chunks = this.buildChunks(rawChunks, filePath, language);

    return this.addOverlap(chunks, this.chunkOverlap);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Detect line indices that represent structural boundaries
   * (function declarations, class declarations, imports, etc.)
   */
  private detectBoundaries(content: string, language: string): number[] {
    const lines = content.split('\n');
    const patterns = BOUNDARY_PATTERNS[language] ?? BOUNDARY_PATTERNS['default'];
    const boundaries: number[] = [0]; // Always start at the beginning

    for (let i = 1; i < lines.length; i++) {
      const trimmed = lines[i].trimStart();
      for (const pattern of patterns) {
        if (pattern.test(trimmed)) {
          boundaries.push(i);
          break;
        }
      }
    }

    return boundaries;
  }

  /**
   * Split lines into groups based on boundary positions and chunk size limits.
   */
  private splitAtBoundaries(
    lines: string[],
    boundaries: number[],
  ): Array<{ startLine: number; endLine: number; content: string }> {
    const groups: Array<{ startLine: number; endLine: number; content: string }> = [];

    for (let i = 0; i < boundaries.length; i++) {
      const start = boundaries[i];
      const end = i + 1 < boundaries.length ? boundaries[i + 1] : lines.length;
      const segment = lines.slice(start, end).join('\n');

      // If segment exceeds chunk size, split it further
      if (segment.length > this.chunkSize) {
        const subChunks = this.splitLargeSegment(lines, start, end);
        groups.push(...subChunks);
      } else {
        groups.push({
          startLine: start + 1,
          endLine: end,
          content: segment,
        });
      }
    }

    // Merge very small consecutive chunks of the same type
    return this.mergeSmallChunks(groups);
  }

  /**
   * Split a large segment into smaller chunks respecting the size limit.
   */
  private splitLargeSegment(
    lines: string[],
    start: number,
    end: number,
  ): Array<{ startLine: number; endLine: number; content: string }> {
    const result: Array<{ startLine: number; endLine: number; content: string }> = [];
    let currentStart = start;
    let currentContent = '';

    for (let i = start; i < end; i++) {
      const lineWithNewline = lines[i] + '\n';

      if (currentContent.length + lineWithNewline.length > this.chunkSize && currentContent.length > 0) {
        result.push({
          startLine: currentStart + 1,
          endLine: i,
          content: currentContent.replace(/\n$/, ''),
        });
        currentStart = i;
        currentContent = lineWithNewline;
      } else {
        currentContent += lineWithNewline;
      }
    }

    if (currentContent.trim().length > 0) {
      result.push({
        startLine: currentStart + 1,
        endLine: end,
        content: currentContent.replace(/\n$/, ''),
      });
    }

    return result;
  }

  /**
   * Merge consecutive small chunks to avoid excessive fragmentation.
   * Chunks smaller than 20% of chunkSize get merged with their successor.
   */
  private mergeSmallChunks(
    groups: Array<{ startLine: number; endLine: number; content: string }>,
  ): Array<{ startLine: number; endLine: number; content: string }> {
    if (groups.length <= 1) return groups;

    const minSize = Math.floor(this.chunkSize * 0.2);
    const merged: Array<{ startLine: number; endLine: number; content: string }> = [];
    let pending: { startLine: number; endLine: number; content: string } | null = null;

    for (const group of groups) {
      if (pending === null) {
        pending = { ...group };
        continue;
      }

      const combinedLength = pending.content.length + group.content.length + 1;

      if (pending.content.length < minSize && combinedLength <= this.chunkSize) {
        pending = {
          startLine: pending.startLine,
          endLine: group.endLine,
          content: pending.content + '\n' + group.content,
        };
      } else {
        merged.push(pending);
        pending = { ...group };
      }
    }

    if (pending) {
      merged.push(pending);
    }

    return merged;
  }

  /**
   * Build CodeChunk objects from raw content groups.
   */
  private buildChunks(
    groups: Array<{ startLine: number; endLine: number; content: string }>,
    filePath: string,
    language: string,
  ): CodeChunk[] {
    return groups.map((group) => this.createChunk(
      group.content,
      filePath,
      language,
      group.startLine,
      group.endLine,
    ));
  }

  /**
   * Create a single CodeChunk with inferred type and extracted name.
   */
  private createChunk(
    content: string,
    filePath: string,
    language: string,
    startLine: number,
    endLine: number,
  ): CodeChunk {
    const type = this.inferType(content);
    const name = this.extractName(content, type);

    return {
      id: randomUUID(),
      content,
      filePath,
      language,
      startLine,
      endLine,
      type,
      metadata: {
        name,
        complexity: this.estimateComplexity(content),
        dependencies: this.extractDependencies(content),
      },
    };
  }

  /**
   * Infer the structural type of a code chunk from its content.
   */
  private inferType(content: string): ChunkType {
    const firstLine = content.trimStart();

    for (const { pattern, type } of TYPE_PATTERNS) {
      if (pattern.test(firstLine)) {
        return type;
      }
    }

    return 'block';
  }

  /**
   * Extract the primary name (function, class, variable) from a chunk.
   */
  private extractName(content: string, _type: ChunkType): string | undefined {
    const firstLine = content.trimStart().split('\n')[0];

    for (const { pattern, group } of NAME_PATTERNS) {
      const match = firstLine.match(pattern);
      if (match && match[group]) {
        return match[group];
      }
    }

    return undefined;
  }

  /**
   * Estimate cyclomatic complexity based on branching keywords.
   */
  private estimateComplexity(content: string): number {
    const keywords = /\b(if|else|for|while|switch|case|catch|&&|\|\||\?)\b/g;
    const matches = content.match(keywords);
    return 1 + (matches ? matches.length : 0);
  }

  /**
   * Extract import/dependency references from content.
   */
  private extractDependencies(content: string): string[] {
    const deps: string[] = [];

    // ES/TS imports: import ... from 'module'
    const esImports = content.matchAll(/(?:import|from)\s+['"]([^'"]+)['"]/g);
    for (const match of esImports) {
      deps.push(match[1]);
    }

    // require() calls
    const requires = content.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
    for (const match of requires) {
      deps.push(match[1]);
    }

    // Python imports
    const pyImports = content.matchAll(/^(?:import|from)\s+([\w.]+)/gm);
    for (const match of pyImports) {
      deps.push(match[1]);
    }

    return [...new Set(deps)];
  }

  /**
   * Add overlap between consecutive chunks for context preservation.
   * Each chunk (except the first) gets the last N characters from its
   * predecessor prepended to its content.
   */
  private addOverlap(chunks: CodeChunk[], overlap: number): CodeChunk[] {
    if (overlap <= 0 || chunks.length <= 1) {
      return chunks;
    }

    const result: CodeChunk[] = [chunks[0]];

    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1];
      const current = chunks[i];

      // Only add overlap for chunks from the same file
      if (prev.filePath !== current.filePath) {
        result.push(current);
        continue;
      }

      const overlapText = prev.content.slice(-overlap);
      result.push({
        ...current,
        content: overlapText + current.content,
      });
    }

    return result;
  }
}
