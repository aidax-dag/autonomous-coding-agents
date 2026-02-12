/**
 * Instinct Clusterer
 *
 * Clusters similar instincts for skill generation using
 * Jaccard similarity on tokenized words. Groups related instincts
 * and suggests skill definitions from clusters.
 *
 * @module core/learning
 */

import type { InstinctRecord } from './instinct-export';

// ============================================================================
// Types
// ============================================================================

export interface InstinctCluster {
  /** Representative instinct records in this cluster */
  instincts: InstinctRecord[];
  /** Average confidence of cluster members */
  averageConfidence: number;
  /** Common words across cluster members */
  commonWords: string[];
}

export interface SkillDefinition {
  name: string;
  description: string;
  tags: string[];
  patterns: string[];
}

// ============================================================================
// Implementation
// ============================================================================

export class InstinctClusterer {
  /**
   * Cluster instincts by similarity using Jaccard index on tokenized words.
   *
   * @param instincts Array of instinct records to cluster
   * @param similarityThreshold Minimum Jaccard similarity (0-1) to group together (default: 0.3)
   * @returns Array of instinct clusters
   */
  cluster(instincts: InstinctRecord[], similarityThreshold: number = 0.3): InstinctCluster[] {
    if (instincts.length === 0) {
      return [];
    }

    // Track which instincts have been assigned to a cluster
    const assigned = new Set<number>();
    const clusters: InstinctCluster[] = [];

    for (let i = 0; i < instincts.length; i++) {
      if (assigned.has(i)) continue;

      const clusterMembers: InstinctRecord[] = [instincts[i]];
      assigned.add(i);

      const tokensA = this.tokenize(instincts[i]);

      for (let j = i + 1; j < instincts.length; j++) {
        if (assigned.has(j)) continue;

        const tokensB = this.tokenize(instincts[j]);
        const similarity = this.jaccardSimilarity(tokensA, tokensB);

        if (similarity >= similarityThreshold) {
          clusterMembers.push(instincts[j]);
          assigned.add(j);
        }
      }

      const avgConfidence =
        clusterMembers.reduce((sum, m) => sum + m.confidence, 0) / clusterMembers.length;

      const commonWords = this.findCommonWords(clusterMembers);

      clusters.push({
        instincts: clusterMembers,
        averageConfidence: avgConfidence,
        commonWords,
      });
    }

    return clusters;
  }

  /**
   * Suggest a skill name from a cluster based on common words.
   */
  suggestSkillName(cluster: InstinctCluster): string {
    if (cluster.commonWords.length === 0) {
      // Fall back to the first instinct's domain
      const firstDomain = cluster.instincts[0]?.domain ?? 'general';
      return `${firstDomain}-skill`;
    }

    const nameParts = cluster.commonWords.slice(0, 3);
    return nameParts.join('-') + '-skill';
  }

  /**
   * Convert a cluster into a skill definition.
   */
  toSkillDefinition(cluster: InstinctCluster): SkillDefinition {
    const name = this.suggestSkillName(cluster);

    const triggers = cluster.instincts.map((i) => i.trigger);
    const actions = cluster.instincts.map((i) => i.action);

    // Build description from most common action patterns
    const description = `Skill derived from ${cluster.instincts.length} instincts: ${actions[0]}`;

    // Tags from domains and common words
    const tags = [
      ...new Set([
        ...cluster.instincts.map((i) => i.domain),
        ...cluster.commonWords,
      ]),
    ];

    return {
      name,
      description,
      tags,
      patterns: triggers,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Tokenize an instinct record into a set of lowercase words
   * from trigger and action fields.
   */
  private tokenize(record: InstinctRecord): Set<string> {
    const text = `${record.trigger} ${record.action}`.toLowerCase();
    const words = text.split(/\s+/).filter((w) => w.length > 2);
    return new Set(words);
  }

  /**
   * Compute Jaccard similarity between two sets.
   */
  private jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 1;

    let intersection = 0;
    for (const word of a) {
      if (b.has(word)) intersection++;
    }

    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Find words that appear in more than half of the cluster members.
   */
  private findCommonWords(instincts: InstinctRecord[]): string[] {
    const wordCounts = new Map<string, number>();

    for (const inst of instincts) {
      const words = this.tokenize(inst);
      for (const word of words) {
        wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
      }
    }

    const threshold = instincts.length / 2;
    return Array.from(wordCounts.entries())
      .filter(([_, count]) => count > threshold)
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createInstinctClusterer(): InstinctClusterer {
  return new InstinctClusterer();
}
