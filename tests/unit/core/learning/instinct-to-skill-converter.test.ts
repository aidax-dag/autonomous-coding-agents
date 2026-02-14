/**
 * Tests for Instinct-to-Skill Converter (F-5)
 *
 * Tests InstinctDerivedSkill and InstinctToSkillConverter with
 * mocked InstinctClusterer and SkillRegistry dependencies.
 */

import { InstinctDerivedSkill } from '@/core/learning/instinct-derived-skill';
import {
  InstinctToSkillConverter,
  createInstinctToSkillConverter,
} from '@/core/learning/instinct-to-skill-converter';
import type { InstinctDerivedSkillInput } from '@/core/learning/instinct-derived-skill';
import type {
  ConversionConfig,
} from '@/core/learning/instinct-to-skill-converter';
import type { InstinctCluster, SkillDefinition } from '@/core/learning/instinct-clustering';
import type { InstinctClusterer } from '@/core/learning/instinct-clustering';
import type { SkillRegistry } from '@/core/skills/skill-registry';
import type { IInstinctStore, Instinct } from '@/core/learning/interfaces/learning.interface';
import type { InstinctRecord } from '@/core/learning/instinct-export';
import type { SkillContext } from '@/core/skills/interfaces/skill.interface';

// ============================================================================
// Test Helpers
// ============================================================================

function makeRecord(overrides: Partial<InstinctRecord> = {}): InstinctRecord {
  return {
    id: 'inst-1',
    trigger: 'When writing tests',
    action: 'Use describe and it blocks',
    confidence: 0.8,
    domain: 'testing',
    source: 'user-correction',
    evidence: ['Observed'],
    usageCount: 3,
    successCount: 2,
    failureCount: 1,
    createdAt: '2025-12-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeInstinct(overrides: Partial<Instinct> = {}): Instinct {
  return {
    id: 'inst-1',
    trigger: 'When writing tests',
    action: 'Use describe and it blocks',
    confidence: 0.8,
    domain: 'testing',
    source: 'user-correction',
    evidence: ['Observed'],
    usageCount: 3,
    successCount: 2,
    failureCount: 1,
    createdAt: new Date('2025-12-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeDefinition(overrides: Partial<SkillDefinition> = {}): SkillDefinition {
  return {
    name: 'writing-tests-skill',
    description: 'Skill derived from 3 instincts: Use describe and it blocks',
    tags: ['testing', 'writing', 'tests'],
    patterns: ['When writing tests', 'When writing unit tests', 'When creating test files'],
    ...overrides,
  };
}

function makeCluster(overrides: Partial<InstinctCluster> = {}): InstinctCluster {
  return {
    instincts: [
      makeRecord({ id: 'a', trigger: 'When writing tests', action: 'Use describe blocks', confidence: 0.8 }),
      makeRecord({ id: 'b', trigger: 'When writing unit tests', action: 'Use jest matchers', confidence: 0.9 }),
      makeRecord({ id: 'c', trigger: 'When creating test files', action: 'Follow naming convention', confidence: 0.7 }),
    ],
    averageConfidence: 0.8,
    commonWords: ['writing', 'tests'],
    ...overrides,
  };
}

function makeContext(): SkillContext {
  return {
    workspaceDir: '/tmp/test-workspace',
  };
}

function createMockClusterer(overrides: Partial<InstinctClusterer> = {}): InstinctClusterer {
  return {
    cluster: jest.fn().mockReturnValue([]),
    suggestSkillName: jest.fn().mockReturnValue('mock-skill'),
    toSkillDefinition: jest.fn().mockReturnValue(makeDefinition()),
    ...overrides,
  } as unknown as InstinctClusterer;
}

function createMockRegistry(overrides: Partial<Record<string, jest.Mock>> = {}): SkillRegistry {
  return {
    register: jest.fn(),
    unregister: jest.fn().mockReturnValue(true),
    get: jest.fn().mockReturnValue(undefined),
    findByTag: jest.fn().mockReturnValue([]),
    findByCapability: jest.fn().mockReturnValue([]),
    list: jest.fn().mockReturnValue([]),
    count: jest.fn().mockReturnValue(0),
    clear: jest.fn(),
    ...overrides,
  } as unknown as SkillRegistry;
}

function createMockStore(instincts: Instinct[] = []): IInstinctStore {
  return {
    create: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMatching: jest.fn(),
    list: jest.fn().mockResolvedValue(instincts),
    reinforce: jest.fn(),
    correct: jest.fn(),
    recordUsage: jest.fn(),
    evolve: jest.fn(),
    export: jest.fn().mockResolvedValue(instincts),
    import: jest.fn(),
    getStats: jest.fn(),
    getConfidenceDistribution: jest.fn(),
  } as unknown as IInstinctStore;
}

// ============================================================================
// InstinctDerivedSkill Tests
// ============================================================================

describe('InstinctDerivedSkill', () => {
  const definition = makeDefinition();
  const sourceInstincts = [
    makeRecord({ id: 'a', trigger: 'When writing tests', action: 'Use describe blocks', confidence: 0.8 }),
    makeRecord({ id: 'b', trigger: 'When writing unit tests', action: 'Use jest matchers', confidence: 0.9 }),
    makeRecord({ id: 'c', trigger: 'When creating test files', action: 'Follow naming convention', confidence: 0.7 }),
  ];

  describe('constructor', () => {
    it('should create skill from definition with correct name, description, tags', () => {
      const skill = new InstinctDerivedSkill(definition, sourceInstincts);

      expect(skill.name).toBe('writing-tests-skill');
      expect(skill.description).toBe(definition.description);
      expect(skill.tags).toEqual(['testing', 'writing', 'tests']);
      expect(skill.version).toBe('1.0.0-auto');
    });

    it('should accept a custom version', () => {
      const skill = new InstinctDerivedSkill(definition, sourceInstincts, '2.0.0');

      expect(skill.version).toBe('2.0.0');
    });

    it('should freeze tags array', () => {
      const skill = new InstinctDerivedSkill(definition, sourceInstincts);

      expect(() => {
        (skill.tags as string[]).push('new-tag');
      }).toThrow();
    });
  });

  describe('validate', () => {
    it('should return true for valid input with context string', () => {
      const skill = new InstinctDerivedSkill(definition, sourceInstincts);

      expect(skill.validate({ context: 'writing some tests' })).toBe(true);
    });

    it('should return false for input without context', () => {
      const skill = new InstinctDerivedSkill(definition, sourceInstincts);

      expect(skill.validate({} as InstinctDerivedSkillInput)).toBe(false);
    });

    it('should return false for empty context string', () => {
      const skill = new InstinctDerivedSkill(definition, sourceInstincts);

      expect(skill.validate({ context: '   ' })).toBe(false);
    });

    it('should return false for null input', () => {
      const skill = new InstinctDerivedSkill(definition, sourceInstincts);

      expect(skill.validate(null as unknown as InstinctDerivedSkillInput)).toBe(false);
    });
  });

  describe('canHandle', () => {
    it('should return true when patterns match input context', () => {
      const skill = new InstinctDerivedSkill(definition, sourceInstincts);
      const context = makeContext();

      expect(skill.canHandle({ context: 'I am writing some tests now' }, context)).toBe(true);
    });

    it('should return false when no patterns match', () => {
      const skill = new InstinctDerivedSkill(definition, sourceInstincts);
      const context = makeContext();

      expect(skill.canHandle({ context: 'deploying to production' }, context)).toBe(false);
    });

    it('should return false for non-object input', () => {
      const skill = new InstinctDerivedSkill(definition, sourceInstincts);
      const context = makeContext();

      expect(skill.canHandle('string input', context)).toBe(false);
      expect(skill.canHandle(null, context)).toBe(false);
    });

    it('should return false when input has no context property', () => {
      const skill = new InstinctDerivedSkill(definition, sourceInstincts);
      const context = makeContext();

      expect(skill.canHandle({ task: 'something' }, context)).toBe(false);
    });
  });

  describe('execute', () => {
    it('should return matched patterns and suggested actions', async () => {
      const skill = new InstinctDerivedSkill(definition, sourceInstincts);
      const context = makeContext();

      const result = await skill.execute({ context: 'When writing tests for the module' }, context);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output!.matchedPatterns.length).toBeGreaterThan(0);
      expect(result.output!.suggestedActions.length).toBeGreaterThan(0);
    });

    it('should calculate confidence from matching instincts', async () => {
      const skill = new InstinctDerivedSkill(definition, sourceInstincts);
      const context = makeContext();

      const result = await skill.execute({ context: 'When writing tests for auth' }, context);

      expect(result.success).toBe(true);
      expect(result.output!.confidence).toBeGreaterThan(0);
      expect(result.output!.confidence).toBeLessThanOrEqual(1);
    });

    it('should return empty matches when nothing matches', async () => {
      const skill = new InstinctDerivedSkill(definition, sourceInstincts);
      const context = makeContext();

      const result = await skill.execute({ context: 'xyz zzz qqq' }, context);

      expect(result.success).toBe(true);
      expect(result.output!.matchedPatterns).toHaveLength(0);
      expect(result.output!.suggestedActions).toHaveLength(0);
      expect(result.output!.confidence).toBe(0);
      expect(result.output!.sourceInstinctCount).toBe(0);
    });

    it('should fail for invalid input', async () => {
      const skill = new InstinctDerivedSkill(definition, sourceInstincts);
      const context = makeContext();

      const result = await skill.execute({ context: '' }, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should include duration in result', async () => {
      const skill = new InstinctDerivedSkill(definition, sourceInstincts);
      const context = makeContext();

      const result = await skill.execute({ context: 'When writing tests' }, context);

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should include metadata in result', async () => {
      const skill = new InstinctDerivedSkill(definition, sourceInstincts);
      const context = makeContext();

      const result = await skill.execute({ context: 'When writing tests' }, context);

      expect(result.metadata).toBeDefined();
      expect(result.metadata!.totalPatterns).toBe(3);
      expect(result.metadata!.totalSourceInstincts).toBe(3);
    });
  });
});

// ============================================================================
// InstinctToSkillConverter Tests
// ============================================================================

describe('InstinctToSkillConverter', () => {
  describe('convert', () => {
    it('should cluster instincts and create skills', async () => {
      const cluster = makeCluster();
      const def = makeDefinition();
      const clusterer = createMockClusterer({
        cluster: jest.fn().mockReturnValue([cluster]),
        toSkillDefinition: jest.fn().mockReturnValue(def),
      });
      const registry = createMockRegistry();
      const store = createMockStore([
        makeInstinct({ id: 'a', confidence: 0.8 }),
        makeInstinct({ id: 'b', confidence: 0.9 }),
        makeInstinct({ id: 'c', confidence: 0.7 }),
      ]);

      const converter = new InstinctToSkillConverter(clusterer, registry);
      const result = await converter.convert(store);

      expect(result.totalClusters).toBe(1);
      expect(result.convertedSkills).toHaveLength(1);
      expect(result.convertedSkills[0].skillName).toBe('instinct-writing-tests-skill');
      expect(result.registeredCount).toBe(1);
    });

    it('should respect minConfidence filter when exporting from store', async () => {
      const store = createMockStore([]);
      const clusterer = createMockClusterer();
      const registry = createMockRegistry();

      const converter = new InstinctToSkillConverter(clusterer, registry, {
        minConfidence: 0.8,
      });
      await converter.convert(store);

      expect(store.export).toHaveBeenCalledWith({ minConfidence: 0.8 });
    });

    it('should respect minClusterSize filter', async () => {
      const smallCluster = makeCluster({
        instincts: [
          makeRecord({ id: 'a' }),
          makeRecord({ id: 'b' }),
        ],
        averageConfidence: 0.9,
      });
      const clusterer = createMockClusterer({
        cluster: jest.fn().mockReturnValue([smallCluster]),
      });
      const registry = createMockRegistry();
      const store = createMockStore([makeInstinct()]);

      const converter = new InstinctToSkillConverter(clusterer, registry, {
        minClusterSize: 3,
      });
      const result = await converter.convert(store);

      expect(result.convertedSkills).toHaveLength(0);
      expect(result.skippedClusters).toHaveLength(1);
      expect(result.skippedClusters[0].reason).toBe('too_small');
    });

    it('should skip clusters with low confidence', async () => {
      const lowConfCluster = makeCluster({
        averageConfidence: 0.4,
      });
      const clusterer = createMockClusterer({
        cluster: jest.fn().mockReturnValue([lowConfCluster]),
      });
      const registry = createMockRegistry();
      const store = createMockStore([makeInstinct()]);

      const converter = new InstinctToSkillConverter(clusterer, registry, {
        minConfidence: 0.7,
      });
      const result = await converter.convert(store);

      expect(result.convertedSkills).toHaveLength(0);
      expect(result.skippedClusters).toHaveLength(1);
      expect(result.skippedClusters[0].reason).toBe('low_confidence');
    });

    it('should skip clusters that are too small and track in skippedClusters', async () => {
      const tinyCluster = makeCluster({
        instincts: [makeRecord({ id: 'only-one' })],
        averageConfidence: 0.9,
      });
      const clusterer = createMockClusterer({
        cluster: jest.fn().mockReturnValue([tinyCluster]),
      });
      const registry = createMockRegistry();
      const store = createMockStore([makeInstinct()]);

      const converter = new InstinctToSkillConverter(clusterer, registry, {
        minClusterSize: 2,
      });
      const result = await converter.convert(store);

      expect(result.skippedClusters).toHaveLength(1);
      expect(result.skippedClusters[0].reason).toBe('too_small');
      expect(result.skippedClusters[0].instinctCount).toBe(1);
    });

    it('should handle duplicate skill names by skipping', async () => {
      const cluster = makeCluster();
      const def = makeDefinition();
      const clusterer = createMockClusterer({
        cluster: jest.fn().mockReturnValue([cluster]),
        toSkillDefinition: jest.fn().mockReturnValue(def),
      });
      const registry = createMockRegistry({
        // Simulate the skill already existing
        get: jest.fn().mockReturnValue({ name: 'instinct-writing-tests-skill' }),
      });
      const store = createMockStore([makeInstinct()]);

      const converter = new InstinctToSkillConverter(clusterer, registry);
      const result = await converter.convert(store);

      expect(result.convertedSkills).toHaveLength(0);
      expect(result.skippedClusters).toHaveLength(1);
      expect(result.skippedClusters[0].reason).toBe('duplicate_skill');
    });

    it('should register skills when autoRegister is true', async () => {
      const cluster = makeCluster();
      const def = makeDefinition();
      const clusterer = createMockClusterer({
        cluster: jest.fn().mockReturnValue([cluster]),
        toSkillDefinition: jest.fn().mockReturnValue(def),
      });
      const registry = createMockRegistry();
      const store = createMockStore([makeInstinct()]);

      const converter = new InstinctToSkillConverter(clusterer, registry, {
        autoRegister: true,
      });
      const result = await converter.convert(store);

      expect(registry.register).toHaveBeenCalled();
      expect(result.registeredCount).toBe(1);
      expect(result.convertedSkills[0].registered).toBe(true);
    });

    it('should not register when autoRegister is false', async () => {
      const cluster = makeCluster();
      const def = makeDefinition();
      const clusterer = createMockClusterer({
        cluster: jest.fn().mockReturnValue([cluster]),
        toSkillDefinition: jest.fn().mockReturnValue(def),
      });
      const registry = createMockRegistry();
      const store = createMockStore([makeInstinct()]);

      const converter = new InstinctToSkillConverter(clusterer, registry, {
        autoRegister: false,
      });
      const result = await converter.convert(store);

      expect(registry.register).not.toHaveBeenCalled();
      expect(result.registeredCount).toBe(0);
      expect(result.convertedSkills[0].registered).toBe(false);
    });

    it('should return accurate ConversionResult stats', async () => {
      const eligibleCluster = makeCluster({ averageConfidence: 0.85 });
      const smallCluster = makeCluster({
        instincts: [makeRecord({ id: 'x' })],
        averageConfidence: 0.9,
      });
      const lowConfCluster = makeCluster({ averageConfidence: 0.3 });

      const clusterer = createMockClusterer({
        cluster: jest.fn().mockReturnValue([eligibleCluster, smallCluster, lowConfCluster]),
        toSkillDefinition: jest.fn().mockReturnValue(makeDefinition()),
      });
      const registry = createMockRegistry();
      const store = createMockStore([makeInstinct()]);

      const converter = new InstinctToSkillConverter(clusterer, registry);
      const result = await converter.convert(store);

      expect(result.totalClusters).toBe(3);
      expect(result.eligibleClusters).toBe(1);
      expect(result.convertedSkills).toHaveLength(1);
      expect(result.skippedClusters).toHaveLength(2);
      expect(result.registeredCount).toBe(1);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty store with no instincts', async () => {
      const clusterer = createMockClusterer();
      const registry = createMockRegistry();
      const store = createMockStore([]);

      const converter = new InstinctToSkillConverter(clusterer, registry);
      const result = await converter.convert(store);

      expect(result.totalClusters).toBe(0);
      expect(result.eligibleClusters).toBe(0);
      expect(result.convertedSkills).toHaveLength(0);
      expect(result.skippedClusters).toHaveLength(0);
      expect(result.registeredCount).toBe(0);
    });

    it('should handle store where no clusters form', async () => {
      const clusterer = createMockClusterer({
        cluster: jest.fn().mockReturnValue([]),
      });
      const registry = createMockRegistry();
      const store = createMockStore([makeInstinct()]);

      const converter = new InstinctToSkillConverter(clusterer, registry);
      const result = await converter.convert(store);

      expect(result.totalClusters).toBe(0);
      expect(result.convertedSkills).toHaveLength(0);
    });

    it('should apply namePrefix to generated skill names', async () => {
      const cluster = makeCluster();
      const def = makeDefinition({ name: 'test-skill' });
      const clusterer = createMockClusterer({
        cluster: jest.fn().mockReturnValue([cluster]),
        toSkillDefinition: jest.fn().mockReturnValue(def),
      });
      const registry = createMockRegistry();
      const store = createMockStore([makeInstinct()]);

      const converter = new InstinctToSkillConverter(clusterer, registry, {
        namePrefix: 'auto',
      });
      const result = await converter.convert(store);

      expect(result.convertedSkills[0].skillName).toBe('auto-test-skill');
    });

    it('should use custom skillVersion for generated skills', async () => {
      const cluster = makeCluster();
      const def = makeDefinition();
      const clusterer = createMockClusterer({
        cluster: jest.fn().mockReturnValue([cluster]),
        toSkillDefinition: jest.fn().mockReturnValue(def),
      });
      const registerMock = jest.fn();
      const registry = createMockRegistry({ register: registerMock });
      const store = createMockStore([makeInstinct()]);

      const converter = new InstinctToSkillConverter(clusterer, registry, {
        skillVersion: '3.0.0-beta',
      });
      await converter.convert(store);

      expect(registerMock).toHaveBeenCalled();
      const registeredSkill = registerMock.mock.calls[0][0];
      expect(registeredSkill.version).toBe('3.0.0-beta');
    });
  });

  describe('convertCluster', () => {
    it('should convert a single eligible cluster to a skill', () => {
      const cluster = makeCluster();
      const def = makeDefinition();
      const clusterer = createMockClusterer({
        toSkillDefinition: jest.fn().mockReturnValue(def),
      });
      const registry = createMockRegistry();

      const converter = new InstinctToSkillConverter(clusterer, registry);
      const result = converter.convertCluster(cluster);

      expect(result).not.toBeNull();
      expect(result!.skillName).toBe('instinct-writing-tests-skill');
      expect(result!.sourceInstinctCount).toBe(3);
      expect(result!.averageConfidence).toBe(0.8);
    });

    it('should return null for ineligible cluster (too small)', () => {
      const cluster = makeCluster({
        instincts: [makeRecord()],
      });
      const clusterer = createMockClusterer();
      const registry = createMockRegistry();

      const converter = new InstinctToSkillConverter(clusterer, registry, {
        minClusterSize: 3,
      });
      const result = converter.convertCluster(cluster);

      expect(result).toBeNull();
    });

    it('should return null for ineligible cluster (low confidence)', () => {
      const cluster = makeCluster({
        averageConfidence: 0.3,
      });
      const clusterer = createMockClusterer();
      const registry = createMockRegistry();

      const converter = new InstinctToSkillConverter(clusterer, registry, {
        minConfidence: 0.7,
      });
      const result = converter.convertCluster(cluster);

      expect(result).toBeNull();
    });
  });

  describe('preview', () => {
    it('should return results without registering any skills', async () => {
      const cluster = makeCluster();
      const def = makeDefinition();
      const clusterer = createMockClusterer({
        cluster: jest.fn().mockReturnValue([cluster]),
        toSkillDefinition: jest.fn().mockReturnValue(def),
      });
      const registry = createMockRegistry();
      const store = createMockStore([makeInstinct()]);

      const converter = new InstinctToSkillConverter(clusterer, registry, {
        autoRegister: true,
      });
      const result = await converter.preview(store);

      expect(registry.register).not.toHaveBeenCalled();
      expect(result.convertedSkills).toHaveLength(1);
      expect(result.convertedSkills[0].registered).toBe(false);
      expect(result.registeredCount).toBe(0);
    });

    it('should restore autoRegister setting after preview', async () => {
      const cluster = makeCluster();
      const def = makeDefinition();
      const clusterer = createMockClusterer({
        cluster: jest.fn().mockReturnValue([cluster]),
        toSkillDefinition: jest.fn().mockReturnValue(def),
      });
      const registry = createMockRegistry();
      const store = createMockStore([makeInstinct()]);

      const converter = new InstinctToSkillConverter(clusterer, registry, {
        autoRegister: true,
      });

      // Preview should not register
      await converter.preview(store);
      expect(registry.register).not.toHaveBeenCalled();

      // Subsequent convert should register (autoRegister was restored)
      await converter.convert(store);
      expect(registry.register).toHaveBeenCalled();
    });
  });

  describe('createInstinctToSkillConverter factory', () => {
    it('should create an InstinctToSkillConverter instance', () => {
      const clusterer = createMockClusterer();
      const registry = createMockRegistry();

      const converter = createInstinctToSkillConverter(clusterer, registry);

      expect(converter).toBeInstanceOf(InstinctToSkillConverter);
    });

    it('should accept optional config', () => {
      const clusterer = createMockClusterer();
      const registry = createMockRegistry();
      const config: ConversionConfig = { minConfidence: 0.9 };

      const converter = createInstinctToSkillConverter(clusterer, registry, config);

      expect(converter).toBeInstanceOf(InstinctToSkillConverter);
    });
  });
});
