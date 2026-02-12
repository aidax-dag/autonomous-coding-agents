/**
 * Team Learning Hub
 *
 * Manages team-wide instinct synchronization, allowing multiple teams
 * to register, retrieve, merge, and discover shared instinct patterns.
 *
 * @module core/learning
 */

import type { InstinctRecord } from './instinct-export';

// ============================================================================
// Types
// ============================================================================

export interface SharedPattern {
  /** The instinct trigger pattern */
  trigger: string;
  /** The instinct action pattern */
  action: string;
  /** Number of teams that share this pattern */
  teamCount: number;
  /** IDs of teams that share this pattern */
  teamIds: string[];
  /** Average confidence across teams */
  averageConfidence: number;
}

// ============================================================================
// Implementation
// ============================================================================

export class TeamLearningHub {
  private teams: Map<string, InstinctRecord[]> = new Map();

  /**
   * Register a team's instincts.
   * Replaces any previously registered instincts for the team.
   */
  register(teamId: string, instincts: InstinctRecord[]): void {
    this.teams.set(teamId, [...instincts]);
  }

  /**
   * Get instincts for a specific team.
   * Returns an empty array if the team is not registered.
   */
  getTeamInstincts(teamId: string): InstinctRecord[] {
    return this.teams.get(teamId) ?? [];
  }

  /**
   * Merge instincts from multiple teams, deduplicating by trigger+action.
   * When duplicates are found, the one with higher confidence is kept.
   */
  mergeTeams(teamIds: string[]): InstinctRecord[] {
    const merged = new Map<string, InstinctRecord>();

    for (const teamId of teamIds) {
      const instincts = this.teams.get(teamId) ?? [];

      for (const inst of instincts) {
        const key = this.makeKey(inst);
        const existing = merged.get(key);

        if (!existing || inst.confidence > existing.confidence) {
          merged.set(key, inst);
        }
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Find patterns shared across multiple teams.
   *
   * @param minTeams Minimum number of teams a pattern must appear in (default: 2)
   * @returns Array of shared patterns sorted by team count descending
   */
  getSharedPatterns(minTeams: number = 2): SharedPattern[] {
    // Build a map of pattern key -> { teamIds, confidences }
    const patternMap = new Map<
      string,
      {
        trigger: string;
        action: string;
        teamIds: Set<string>;
        confidences: number[];
      }
    >();

    for (const [teamId, instincts] of this.teams) {
      for (const inst of instincts) {
        const key = this.makeKey(inst);

        if (!patternMap.has(key)) {
          patternMap.set(key, {
            trigger: inst.trigger,
            action: inst.action,
            teamIds: new Set(),
            confidences: [],
          });
        }

        const entry = patternMap.get(key)!;
        entry.teamIds.add(teamId);
        entry.confidences.push(inst.confidence);
      }
    }

    // Filter and convert to SharedPattern
    const patterns: SharedPattern[] = [];

    for (const entry of patternMap.values()) {
      if (entry.teamIds.size >= minTeams) {
        const avgConfidence =
          entry.confidences.reduce((sum, c) => sum + c, 0) / entry.confidences.length;

        patterns.push({
          trigger: entry.trigger,
          action: entry.action,
          teamCount: entry.teamIds.size,
          teamIds: Array.from(entry.teamIds),
          averageConfidence: avgConfidence,
        });
      }
    }

    // Sort by team count descending
    patterns.sort((a, b) => b.teamCount - a.teamCount);

    return patterns;
  }

  /**
   * Get all registered team IDs.
   */
  getTeamIds(): string[] {
    return Array.from(this.teams.keys());
  }

  /**
   * Remove a team's instincts from the hub.
   */
  removeTeam(teamId: string): boolean {
    return this.teams.delete(teamId);
  }

  /**
   * Clear all teams and instincts.
   */
  clear(): void {
    this.teams.clear();
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Create a deduplication key from trigger + action (normalized).
   */
  private makeKey(inst: InstinctRecord): string {
    return `${inst.trigger.toLowerCase().trim()}::${inst.action.toLowerCase().trim()}`;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createTeamLearningHub(): TeamLearningHub {
  return new TeamLearningHub();
}
