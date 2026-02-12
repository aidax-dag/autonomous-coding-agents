/**
 * Migration Skill Tests
 */

import { MigrationSkill, createMigrationSkill } from '../../../../src/core/skills/skills/migration-skill';
import type { SkillContext } from '../../../../src/core/skills/interfaces/skill.interface';

const context: SkillContext = { workspaceDir: '/tmp/test' };

describe('MigrationSkill', () => {
  it('should have correct name, description, tags, and version', () => {
    const skill = new MigrationSkill();
    expect(skill.name).toBe('migration');
    expect(skill.description).toContain('migration');
    expect(skill.tags).toContain('migration');
    expect(skill.tags).toContain('upgrade');
    expect(skill.tags).toContain('framework');
    expect(skill.version).toBe('1.0.0');
  });

  it('should validate input correctly', () => {
    const skill = new MigrationSkill();
    expect(skill.validate({ from: 'react@17', to: 'react@18', files: ['app.tsx'] })).toBe(true);
    expect(skill.validate({ from: '', to: 'v2', files: ['a.ts'] })).toBe(false);
    expect(skill.validate({ from: 'v1', to: '', files: ['a.ts'] })).toBe(false);
    expect(skill.validate({ from: 'v1', to: 'v2', files: [] })).toBe(false);
    expect(skill.validate({} as any)).toBe(false);
  });

  it('should check canHandle', () => {
    const skill = new MigrationSkill();
    expect(skill.canHandle({ from: 'v1', to: 'v2', files: ['a.ts'] })).toBe(true);
    expect(skill.canHandle({ from: '', to: 'v2', files: ['a.ts'] })).toBe(false);
    expect(skill.canHandle(null)).toBe(false);
  });

  it('should execute with custom executor', async () => {
    const skill = new MigrationSkill({
      executor: async (input) => ({
        changes: [{ file: input.files[0], description: 'Updated import', before: 'old', after: 'new' }],
        warnings: ['Check peer deps'],
        incompatible: [],
      }),
    });

    const result = await skill.execute({ from: 'v1', to: 'v2', files: ['app.ts'] }, context);
    expect(result.success).toBe(true);
    expect(result.output!.changes).toHaveLength(1);
    expect(result.output!.changes[0].before).toBe('old');
    expect(result.output!.warnings).toHaveLength(1);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should execute with default behavior', async () => {
    const skill = new MigrationSkill();
    const result = await skill.execute({ from: 'react@17', to: 'react@18', files: ['a.tsx', 'b.tsx'] }, context);

    expect(result.success).toBe(true);
    expect(result.output!.changes).toHaveLength(2);
    expect(result.output!.changes[0].description).toContain('react@17');
    expect(result.output!.warnings).toHaveLength(0);
    expect(result.output!.incompatible).toHaveLength(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should fail on invalid input', async () => {
    const skill = new MigrationSkill();
    const result = await skill.execute({ from: '', to: 'v2', files: ['a.ts'] }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('from, to, and files are required');
  });

  it('should handle execution errors gracefully', async () => {
    const skill = new MigrationSkill({
      executor: async () => { throw new Error('migration failed'); },
    });

    const result = await skill.execute({ from: 'v1', to: 'v2', files: ['a.ts'] }, context);
    expect(result.success).toBe(false);
    expect(result.error).toBe('migration failed');
  });

  it('should create via factory function', () => {
    const skill = createMigrationSkill();
    expect(skill).toBeInstanceOf(MigrationSkill);
    expect(skill.name).toBe('migration');
  });
});
