/**
 * SkillRegistry Tests
 */

import { SkillRegistry, createSkillRegistry } from '../../../../src/core/skills/skill-registry';
import type { ISkill, SkillContext } from '../../../../src/core/skills/interfaces/skill.interface';

function createMockSkill(overrides: Partial<ISkill> = {}): ISkill {
  return {
    name: 'test-skill',
    description: 'A test skill',
    tags: ['test'],
    version: '1.0.0',
    execute: async () => ({ success: true, output: 'ok', duration: 1 }),
    ...overrides,
  };
}

describe('SkillRegistry', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  it('should register and retrieve a skill', () => {
    const skill = createMockSkill();
    registry.register(skill);

    expect(registry.get('test-skill')).toBe(skill);
    expect(registry.count()).toBe(1);
  });

  it('should throw on duplicate registration', () => {
    const skill = createMockSkill();
    registry.register(skill);

    expect(() => registry.register(skill)).toThrow("Skill 'test-skill' is already registered");
  });

  it('should allow overwrite when configured', () => {
    const registry = new SkillRegistry({ allowOverwrite: true });
    const skill1 = createMockSkill({ description: 'v1' });
    const skill2 = createMockSkill({ description: 'v2' });

    registry.register(skill1);
    registry.register(skill2);

    expect(registry.get('test-skill')?.description).toBe('v2');
  });

  it('should throw on skill without name', () => {
    const skill = createMockSkill({ name: '' });
    expect(() => registry.register(skill)).toThrow('Skill must have a name');
  });

  it('should unregister a skill', () => {
    const skill = createMockSkill();
    registry.register(skill);

    expect(registry.unregister('test-skill')).toBe(true);
    expect(registry.get('test-skill')).toBeUndefined();
    expect(registry.count()).toBe(0);
  });

  it('should return false when unregistering nonexistent skill', () => {
    expect(registry.unregister('nonexistent')).toBe(false);
  });

  it('should find skills by tag', () => {
    registry.register(createMockSkill({ name: 'a', tags: ['quality', 'review'] }));
    registry.register(createMockSkill({ name: 'b', tags: ['testing'] }));
    registry.register(createMockSkill({ name: 'c', tags: ['quality'] }));

    const results = registry.findByTag('quality');
    expect(results).toHaveLength(2);
    expect(results.map((s) => s.name).sort()).toEqual(['a', 'c']);
  });

  it('should find skills by capability', () => {
    registry.register(
      createMockSkill({
        name: 'capable',
        canHandle: () => true,
      }),
    );
    registry.register(
      createMockSkill({
        name: 'not-capable',
        canHandle: () => false,
      }),
    );
    registry.register(
      createMockSkill({
        name: 'no-canHandle',
        // no canHandle method
      }),
    );

    const context: SkillContext = { workspaceDir: '/tmp' };
    const results = registry.findByCapability({}, context);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('capable');
  });

  it('should list all skills', () => {
    registry.register(createMockSkill({ name: 'x', description: 'skill x' }));
    registry.register(createMockSkill({ name: 'y', description: 'skill y' }));

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({
      name: 'x',
      description: 'skill x',
      tags: ['test'],
      version: '1.0.0',
    });
  });

  it('should clear all skills', () => {
    registry.register(createMockSkill({ name: 'a' }));
    registry.register(createMockSkill({ name: 'b' }));

    registry.clear();
    expect(registry.count()).toBe(0);
    expect(registry.list()).toHaveLength(0);
  });

  it('should be created via factory function', () => {
    const reg = createSkillRegistry({ allowOverwrite: true });
    expect(reg).toBeInstanceOf(SkillRegistry);
  });
});
