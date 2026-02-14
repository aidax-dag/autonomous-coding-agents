/**
 * Instinct-to-Skill Converter
 *
 * Analyzes InstinctClustering clusters and converts eligible ones
 * into SkillRegistry-registered skills. Bridges the learning system
 * (instincts) with the execution system (skills).
 *
 * F-5: Instinct -> Skill Auto-Conversion
 *
 * @module core/learning
 */

import type { IInstinctStore } from './interfaces/learning.interface';
import type { InstinctRecord } from './instinct-export';
import type { InstinctCluster, SkillDefinition } from './instinct-clustering';
import type { InstinctClusterer } from './instinct-clustering';
import type { SkillRegistry } from '../skills/skill-registry';
import { InstinctDerivedSkill } from './instinct-derived-skill';
import { createAgentLogger } from '../../shared/logging/logger';

const logger = createAgentLogger('Learning', 'instinct-to-skill-converter');

// ============================================================================
// Types
// ============================================================================

export interface ConversionConfig {
  /** Minimum cluster average confidence to be eligible (default: 0.7) */
  minConfidence?: number;
  /** Minimum number of instincts in a cluster to be eligible (default: 3) */
  minClusterSize?: number;
  /** Jaccard similarity threshold for clustering (default: 0.3) */
  similarityThreshold?: number;
  /** Whether to auto-register converted skills to the SkillRegistry (default: true) */
  autoRegister?: boolean;
  /** Version string for generated skills (default: '1.0.0-auto') */
  skillVersion?: string;
  /** Prefix for generated skill names (default: 'instinct') */
  namePrefix?: string;
}

export interface ConversionResult {
  /** Total clusters found by the clusterer */
  totalClusters: number;
  /** Clusters that met confidence and size thresholds */
  eligibleClusters: number;
  /** Successfully converted skills */
  convertedSkills: ConvertedSkillInfo[];
  /** Clusters that were skipped and why */
  skippedClusters: SkippedClusterInfo[];
  /** How many skills were registered in the SkillRegistry */
  registeredCount: number;
  /** Total conversion time in milliseconds */
  duration: number;
}

export interface ConvertedSkillInfo {
  /** Generated skill name */
  skillName: string;
  /** Skill description */
  description: string;
  /** Tags for discovery */
  tags: string[];
  /** Trigger patterns from source instincts */
  patterns: string[];
  /** Number of instincts that formed this skill */
  sourceInstinctCount: number;
  /** Average confidence of the source cluster */
  averageConfidence: number;
  /** Whether the skill was registered in the SkillRegistry */
  registered: boolean;
}

export interface SkippedClusterInfo {
  /** Reason for skipping: 'low_confidence' | 'too_small' | 'duplicate_skill' */
  reason: string;
  /** Number of instincts in the skipped cluster */
  instinctCount: number;
  /** Average confidence of the skipped cluster */
  averageConfidence: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: Required<ConversionConfig> = {
  minConfidence: 0.7,
  minClusterSize: 3,
  similarityThreshold: 0.3,
  autoRegister: true,
  skillVersion: '1.0.0-auto',
  namePrefix: 'instinct',
};

// ============================================================================
// Implementation
// ============================================================================

export class InstinctToSkillConverter {
  private readonly config: Required<ConversionConfig>;

  constructor(
    private readonly clusterer: InstinctClusterer,
    private readonly registry: SkillRegistry,
    config: ConversionConfig = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Convert instincts from store into skills.
   *
   * 1. Export instincts from store (with minConfidence filter)
   * 2. Cluster using InstinctClusterer
   * 3. Filter eligible clusters (minClusterSize, minConfidence)
   * 4. Convert each to SkillDefinition using clusterer.toSkillDefinition()
   * 5. Create InstinctDerivedSkill for each
   * 6. Register in SkillRegistry (if autoRegister and not duplicate)
   * 7. Return ConversionResult
   */
  async convert(store: IInstinctStore): Promise<ConversionResult> {
    const start = Date.now();

    logger.info('Starting instinct-to-skill conversion', {
      minConfidence: this.config.minConfidence,
      minClusterSize: this.config.minClusterSize,
      autoRegister: this.config.autoRegister,
    });

    // Step 1: Export instincts from store
    const instincts = await store.export({ minConfidence: this.config.minConfidence });
    const records = this.toRecords(instincts);

    if (records.length === 0) {
      logger.info('No instincts found matching criteria, nothing to convert');
      return {
        totalClusters: 0,
        eligibleClusters: 0,
        convertedSkills: [],
        skippedClusters: [],
        registeredCount: 0,
        duration: Date.now() - start,
      };
    }

    // Step 2: Cluster instincts
    const clusters = this.clusterer.cluster(records, this.config.similarityThreshold);

    logger.info(`Found ${clusters.length} clusters from ${records.length} instincts`);

    // Steps 3-6: Process each cluster
    const convertedSkills: ConvertedSkillInfo[] = [];
    const skippedClusters: SkippedClusterInfo[] = [];
    let registeredCount = 0;

    for (const cluster of clusters) {
      const result = this.processCluster(cluster);

      if (result.skipped) {
        skippedClusters.push(result.skipped);
        continue;
      }

      if (result.converted) {
        convertedSkills.push(result.converted);
        if (result.converted.registered) {
          registeredCount++;
        }
      }
    }

    const duration = Date.now() - start;

    logger.info(
      `Conversion complete: ${convertedSkills.length} skills created, ` +
        `${registeredCount} registered, ${skippedClusters.length} skipped`,
      { duration }
    );

    return {
      totalClusters: clusters.length,
      eligibleClusters: convertedSkills.length,
      convertedSkills,
      skippedClusters,
      registeredCount,
      duration,
    };
  }

  /**
   * Convert a single cluster to a skill (without store).
   * Useful for manual/targeted conversion.
   *
   * @returns ConvertedSkillInfo or null if the cluster is ineligible
   */
  convertCluster(cluster: InstinctCluster): ConvertedSkillInfo | null {
    const result = this.processCluster(cluster);
    return result.converted ?? null;
  }

  /**
   * Preview what would be converted without actually registering.
   * Same as convert() but with autoRegister forced to false.
   */
  async preview(store: IInstinctStore): Promise<ConversionResult> {
    const originalAutoRegister = this.config.autoRegister;
    this.config.autoRegister = false;

    try {
      const result = await this.convert(store);
      return result;
    } finally {
      this.config.autoRegister = originalAutoRegister;
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Process a single cluster: validate eligibility, convert to skill,
   * and optionally register.
   */
  private processCluster(cluster: InstinctCluster): {
    converted?: ConvertedSkillInfo;
    skipped?: SkippedClusterInfo;
  } {
    // Check cluster size
    if (cluster.instincts.length < this.config.minClusterSize) {
      return {
        skipped: {
          reason: 'too_small',
          instinctCount: cluster.instincts.length,
          averageConfidence: cluster.averageConfidence,
        },
      };
    }

    // Check confidence threshold
    if (cluster.averageConfidence < this.config.minConfidence) {
      return {
        skipped: {
          reason: 'low_confidence',
          instinctCount: cluster.instincts.length,
          averageConfidence: cluster.averageConfidence,
        },
      };
    }

    // Convert to SkillDefinition
    const definition = this.clusterer.toSkillDefinition(cluster);
    const prefixedName = this.applyNamePrefix(definition.name);
    const prefixedDefinition: SkillDefinition = {
      ...definition,
      name: prefixedName,
    };

    // Check for duplicate in registry
    if (this.registry.get(prefixedName) !== undefined) {
      return {
        skipped: {
          reason: 'duplicate_skill',
          instinctCount: cluster.instincts.length,
          averageConfidence: cluster.averageConfidence,
        },
      };
    }

    // Create the skill
    const skill = new InstinctDerivedSkill(
      prefixedDefinition,
      cluster.instincts,
      this.config.skillVersion
    );

    // Register if configured
    let registered = false;
    if (this.config.autoRegister) {
      try {
        this.registry.register(skill);
        registered = true;
        logger.debug(`Registered skill: ${prefixedName}`);
      } catch (error) {
        logger.warn(`Failed to register skill '${prefixedName}': ${error}`);
      }
    }

    return {
      converted: {
        skillName: prefixedName,
        description: prefixedDefinition.description,
        tags: prefixedDefinition.tags,
        patterns: prefixedDefinition.patterns,
        sourceInstinctCount: cluster.instincts.length,
        averageConfidence: cluster.averageConfidence,
        registered,
      },
    };
  }

  /**
   * Apply the name prefix to a skill name.
   * Avoids double-prefixing if the name already starts with the prefix.
   */
  private applyNamePrefix(name: string): string {
    if (!this.config.namePrefix) {
      return name;
    }

    const prefix = this.config.namePrefix;
    if (name.startsWith(`${prefix}-`)) {
      return name;
    }

    return `${prefix}-${name}`;
  }

  /**
   * Convert Instinct objects (from store) to InstinctRecord format
   * expected by the clusterer.
   */
  private toRecords(instincts: import('./interfaces/learning.interface').Instinct[]): InstinctRecord[] {
    return instincts.map((inst) => ({
      id: inst.id,
      trigger: inst.trigger,
      action: inst.action,
      confidence: inst.confidence,
      domain: inst.domain,
      source: inst.source,
      evidence: inst.evidence,
      usageCount: inst.usageCount,
      successCount: inst.successCount,
      failureCount: inst.failureCount,
      createdAt: inst.createdAt instanceof Date ? inst.createdAt.toISOString() : String(inst.createdAt),
      updatedAt: inst.updatedAt instanceof Date ? inst.updatedAt.toISOString() : String(inst.updatedAt),
      lastUsedAt: inst.lastUsedAt
        ? (inst.lastUsedAt instanceof Date ? inst.lastUsedAt.toISOString() : String(inst.lastUsedAt))
        : undefined,
      metadata: inst.metadata as Record<string, unknown> | undefined,
    }));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createInstinctToSkillConverter(
  clusterer: InstinctClusterer,
  registry: SkillRegistry,
  config?: ConversionConfig
): InstinctToSkillConverter {
  return new InstinctToSkillConverter(clusterer, registry, config);
}
