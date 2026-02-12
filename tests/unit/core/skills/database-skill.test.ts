/**
 * Database Skill Tests
 */

import { DatabaseSkill, createDatabaseSkill } from '../../../../src/core/skills/skills/database-skill';
import type { SkillContext } from '../../../../src/core/skills/interfaces/skill.interface';

const context: SkillContext = { workspaceDir: '/tmp/test' };

describe('DatabaseSkill', () => {
  it('should have correct name, description, tags, and version', () => {
    const skill = new DatabaseSkill();
    expect(skill.name).toBe('database');
    expect(skill.description).toContain('database');
    expect(skill.tags).toContain('database');
    expect(skill.tags).toContain('sql');
    expect(skill.tags).toContain('schema');
    expect(skill.tags).toContain('optimization');
    expect(skill.version).toBe('1.0.0');
  });

  it('should validate input correctly', () => {
    const skill = new DatabaseSkill();
    expect(skill.validate({ operation: 'schema' })).toBe(true);
    expect(skill.validate({ operation: 'query' })).toBe(true);
    expect(skill.validate({ operation: 'migration' })).toBe(true);
    expect(skill.validate({ operation: 'optimize' })).toBe(true);
    expect(skill.validate({ operation: 'invalid' as any })).toBe(false);
    expect(skill.validate({} as any)).toBe(false);
  });

  it('should check canHandle', () => {
    const skill = new DatabaseSkill();
    expect(skill.canHandle({ operation: 'schema' })).toBe(true);
    expect(skill.canHandle({ operation: 'invalid' })).toBe(false);
    expect(skill.canHandle(null)).toBe(false);
  });

  it('should execute with custom executor', async () => {
    const skill = new DatabaseSkill({
      executor: async (_input) => ({
        result: 'CREATE TABLE users (id SERIAL PRIMARY KEY)',
        suggestions: ['Add index on email'],
        warnings: [],
        optimized: 'SELECT * FROM users WHERE id = $1',
      }),
    });

    const result = await skill.execute({ operation: 'schema' }, context);
    expect(result.success).toBe(true);
    expect(result.output!.result).toContain('CREATE TABLE');
    expect(result.output!.suggestions).toHaveLength(1);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should execute with default behavior', async () => {
    const skill = new DatabaseSkill();
    const result = await skill.execute({ operation: 'schema' }, context);

    expect(result.success).toBe(true);
    expect(result.output!.result).toContain('schema');
    expect(result.output!.suggestions).toHaveLength(0);
    expect(result.output!.warnings).toHaveLength(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should include optimized field for optimize operation', async () => {
    const skill = new DatabaseSkill();
    const result = await skill.execute({
      operation: 'optimize',
      query: 'SELECT * FROM users',
    }, context);

    expect(result.success).toBe(true);
    expect(result.output!.optimized).toBe('SELECT * FROM users');
  });

  it('should fail on invalid input', async () => {
    const skill = new DatabaseSkill();
    const result = await skill.execute({ operation: 'invalid' as any }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('operation must be');
  });

  it('should handle execution errors gracefully', async () => {
    const skill = new DatabaseSkill({
      executor: async () => { throw new Error('db error'); },
    });

    const result = await skill.execute({ operation: 'query' }, context);
    expect(result.success).toBe(false);
    expect(result.error).toBe('db error');
  });

  it('should create via factory function', () => {
    const skill = createDatabaseSkill();
    expect(skill).toBeInstanceOf(DatabaseSkill);
    expect(skill.name).toBe('database');
  });
});
