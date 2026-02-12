/**
 * Documentation Skill Tests
 */

import { DocumentationSkill, createDocumentationSkill } from '../../../../src/core/skills/skills/documentation-skill';
import type { SkillContext } from '../../../../src/core/skills/interfaces/skill.interface';

const context: SkillContext = { workspaceDir: '/tmp/test' };

describe('DocumentationSkill', () => {
  it('should have correct name, description, tags, and version', () => {
    const skill = new DocumentationSkill();
    expect(skill.name).toBe('documentation');
    expect(skill.description).toContain('documentation');
    expect(skill.tags).toContain('docs');
    expect(skill.tags).toContain('documentation');
    expect(skill.tags).toContain('api');
    expect(skill.version).toBe('1.0.0');
  });

  it('should validate input correctly', () => {
    const skill = new DocumentationSkill();
    expect(skill.validate({ files: ['a.ts'] })).toBe(true);
    expect(skill.validate({ files: ['a.ts'], format: 'jsdoc' })).toBe(true);
    expect(skill.validate({ files: [] })).toBe(false);
    expect(skill.validate({} as any)).toBe(false);
  });

  it('should check canHandle', () => {
    const skill = new DocumentationSkill();
    expect(skill.canHandle({ files: ['a.ts'] })).toBe(true);
    expect(skill.canHandle({ files: [] })).toBe(false);
    expect(skill.canHandle(null)).toBe(false);
  });

  it('should execute with custom executor', async () => {
    const skill = new DocumentationSkill({
      executor: async (input) => ({
        documents: [{ path: input.files[0], content: 'Custom docs', format: 'markdown' }],
        summary: 'Custom generation complete',
      }),
    });

    const result = await skill.execute({ files: ['app.ts'] }, context);
    expect(result.success).toBe(true);
    expect(result.output!.documents).toHaveLength(1);
    expect(result.output!.documents[0].content).toBe('Custom docs');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should execute with default behavior', async () => {
    const skill = new DocumentationSkill();
    const result = await skill.execute({ files: ['a.ts', 'b.ts'] }, context);

    expect(result.success).toBe(true);
    expect(result.output!.documents).toHaveLength(2);
    expect(result.output!.documents[0].format).toBe('markdown');
    expect(result.output!.summary).toContain('2 file(s)');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should fail on invalid input', async () => {
    const skill = new DocumentationSkill();
    const result = await skill.execute({ files: [] }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('files array is required');
  });

  it('should handle execution errors gracefully', async () => {
    const skill = new DocumentationSkill({
      executor: async () => { throw new Error('doc generation failed'); },
    });

    const result = await skill.execute({ files: ['a.ts'] }, context);
    expect(result.success).toBe(false);
    expect(result.error).toBe('doc generation failed');
  });

  it('should create via factory function', () => {
    const skill = createDocumentationSkill();
    expect(skill).toBeInstanceOf(DocumentationSkill);
    expect(skill.name).toBe('documentation');
  });
});
