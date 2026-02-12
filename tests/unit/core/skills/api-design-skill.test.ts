/**
 * API Design Skill Tests
 */

import { ApiDesignSkill, createApiDesignSkill } from '../../../../src/core/skills/skills/api-design-skill';
import type { SkillContext } from '../../../../src/core/skills/interfaces/skill.interface';

const context: SkillContext = { workspaceDir: '/tmp/test' };

describe('ApiDesignSkill', () => {
  it('should have correct name, description, tags, and version', () => {
    const skill = new ApiDesignSkill();
    expect(skill.name).toBe('api-design');
    expect(skill.description).toContain('API');
    expect(skill.tags).toContain('api');
    expect(skill.tags).toContain('design');
    expect(skill.tags).toContain('rest');
    expect(skill.tags).toContain('graphql');
    expect(skill.version).toBe('1.0.0');
  });

  it('should validate input correctly', () => {
    const skill = new ApiDesignSkill();
    expect(skill.validate({ name: 'UserAPI' })).toBe(true);
    expect(skill.validate({ name: 'UserAPI', type: 'graphql' })).toBe(true);
    expect(skill.validate({ name: '' })).toBe(false);
    expect(skill.validate({} as any)).toBe(false);
  });

  it('should check canHandle', () => {
    const skill = new ApiDesignSkill();
    expect(skill.canHandle({ name: 'UserAPI' })).toBe(true);
    expect(skill.canHandle({ name: '' })).toBe(false);
    expect(skill.canHandle(null)).toBe(false);
  });

  it('should execute with custom executor', async () => {
    const skill = new ApiDesignSkill({
      executor: async (input) => ({
        schema: '{"openapi":"3.0"}',
        endpoints: [{ method: 'GET', path: '/users', description: 'List users', request: '{}', response: '[]' }],
        documentation: `# ${input.name}`,
      }),
    });

    const result = await skill.execute({ name: 'UserAPI' }, context);
    expect(result.success).toBe(true);
    expect(result.output!.endpoints).toHaveLength(1);
    expect(result.output!.documentation).toContain('UserAPI');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should execute with default behavior for REST', async () => {
    const skill = new ApiDesignSkill();
    const result = await skill.execute({
      name: 'OrderAPI',
      type: 'rest',
      endpoints: [{ method: 'POST', path: '/orders', description: 'Create order' }],
    }, context);

    expect(result.success).toBe(true);
    expect(result.output!.schema).toContain('openapi');
    expect(result.output!.schema).toContain('OrderAPI');
    expect(result.output!.endpoints).toHaveLength(1);
    expect(result.output!.documentation).toContain('OrderAPI');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should execute with default behavior for GraphQL', async () => {
    const skill = new ApiDesignSkill();
    const result = await skill.execute({ name: 'GraphAPI', type: 'graphql' }, context);

    expect(result.success).toBe(true);
    expect(result.output!.schema).toContain('type Query');
    expect(result.output!.documentation).toContain('graphql');
  });

  it('should fail on invalid input', async () => {
    const skill = new ApiDesignSkill();
    const result = await skill.execute({ name: '' }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('name is required');
  });

  it('should handle execution errors gracefully', async () => {
    const skill = new ApiDesignSkill({
      executor: async () => { throw new Error('schema generation failed'); },
    });

    const result = await skill.execute({ name: 'TestAPI' }, context);
    expect(result.success).toBe(false);
    expect(result.error).toBe('schema generation failed');
  });

  it('should create via factory function', () => {
    const skill = createApiDesignSkill();
    expect(skill).toBeInstanceOf(ApiDesignSkill);
    expect(skill.name).toBe('api-design');
  });
});
